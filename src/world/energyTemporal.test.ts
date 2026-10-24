import { describe, it, expect } from "vitest";
import * as T from "three";
import { seed, type Block } from "../domain";
import { scheduleOrbs } from "../constellation/adapter";
import {
  creationPhase,
  routePoint,
  routeNode,
  createEnergyRoutes,
} from "./energyRoutes";
import { createOrbLayer } from "./orbLayer";
import { createOrbLifecycle, MAX_ENERGY_ROUTES } from "./orbLifecycle";
import { createLightEvents } from "./lightEvents";
import type { WorldInput, OrbProjection } from "./contract";

describe("temporal presentation, independent of device timezone", () => {
  it("maps local dates to past/today/future and each six-hour boundary to its gate without angle jitter", () => {
    const state = seed(),
      source = state.blocks.find((b) => b.assignmentId)!;
    const dates = ["2026-12-31", "2027-01-01", "2027-01-02"];
    state.blocks = dates.flatMap((date, lane) =>
      [
        "00:00",
        "05:59",
        "06:00",
        "11:59",
        "12:00",
        "17:59",
        "18:00",
        "23:45",
      ].map(
        (time, i) =>
          ({
            ...source,
            id: `${lane}-${i}`,
            start: `${date}T${time}`,
            end: `${date}T23:59`,
          }) as Block,
      ),
    );
    const orbs = scheduleOrbs(state, "2027-01-01T12:00");
    for (let lane = 0; lane < 3; lane++) {
      expect(orbs.filter((o) => o.lane === lane)).toHaveLength(8);
      for (const [i, angle] of [
        [0, Math.PI / 2],
        [2, 0],
        [4, -Math.PI / 2],
        [6, -Math.PI],
      ])
        expect(orbs.find((o) => o.id === `${lane}-${i}`)!.angle).toBeCloseTo(
          angle,
          12,
        );
    }
    expect(orbs.find((o) => o.id === "0-0")!.overdue).toBe(true);
    expect(orbs.find((o) => o.id === "1-0")!.completed).toBe(false);
    const nextDay = scheduleOrbs(state, "2027-01-02T00:00");
    expect(nextDay.find((o) => o.id === "1-0")!.lane).toBe(0);
    expect(nextDay.find((o) => o.id === "2-0")!.lane).toBe(1);
    expect(nextDay.map((o) => o.id)).toEqual(orbs.map((o) => o.id));
  });
  it("keeps same clock positions across dates while giving coincident sessions bounded depth/radius stacks", () => {
    const state = seed(),
      source = state.blocks.find((b) => b.assignmentId)!;
    state.blocks = Array.from({ length: 300 }, (_, i) => ({
      ...source,
      id: String(i),
      start: `2030-01-${String(1 + (i % 28)).padStart(2, "0")}T06:00`,
    }));
    const nodes = scheduleOrbs(state, "2027-01-01T00:00");
    expect(new Set(nodes.map((n) => n.angle)).size).toBe(1);
    expect(
      new Set(nodes.map((n) => `${n.spread}:${n.radialOffset}`)).size,
    ).toBe(300);
    expect(Math.max(...nodes.map((n) => n.spread))).toBeLessThan(0.6);
  });
});
describe("causal bounded energy routes", () => {
  it("interrupts unmaterialized creation without a bright jump to the destination, even at the same clock tick", () => {
    for (const kind of ["completion", "deletion", "move"] as const) {
      const scene = new T.Scene(),
        orb = scheduleOrbs(seed(), "2099-01-01T00:00")[0];
      const input: WorldInput = {
        area: "week",
        emphasis: false,
        reducedMotion: false,
        orbs: [],
      };
      const layer = createOrbLayer(
        scene,
        input,
        {
          metrics() {},
          error(e) {
            throw e;
          },
        },
        () => {},
      );
      const halos = Array.from({ length: 3 }, () => new T.Group());
      halos.forEach((h) => {
        h.rotation.x = 1.5;
        h.position.y = 5;
      });
      const camera = new T.PerspectiveCamera(43, 1.6, 0.2, 140);
      camera.position.set(0, 7, 26);
      camera.lookAt(0, 6, 0);
      layer.update({ ...input, orbs: [orb] }, 0);
      layer.render(1, halos, camera);
      const before = layer.positionOf(orb.id)!;
      const next =
        kind === "deletion"
          ? []
          : [
              {
                ...orb,
                ...(kind === "completion"
                  ? { completed: true }
                  : { angle: orb.angle + 0.5 }),
              },
            ];
      layer.update({ ...input, orbs: next }, 1);
      layer.render(1, halos, camera);
      const aura = scene.getObjectByName("session-coronas") as T.InstancedMesh,
        matrix = new T.Matrix4();
      aura.getMatrixAt(0, matrix);
      expect(
        new T.Vector3().setFromMatrixPosition(matrix).distanceTo(before),
      ).toBeLessThan(1e-5);
      expect(
        (aura.geometry.getAttribute("aState") as T.BufferAttribute).getX(0),
      ).toBe(0);
      layer.dispose();
    }
  });
  it("traces continuous pedestal/core/rail endpoints before materialization, and fades to zero", () => {
    const target = new T.Vector3(8, 7, 1),
      node = routeNode("session");
    expect(routePoint(0, node, target).length()).toBeCloseTo(
      Math.hypot(5.5, 0.08),
    );
    for (const t of [0.28, 0.55, 0.86])
      expect(
        routePoint(t - 1e-8, node, target).distanceTo(
          routePoint(t + 1e-8, node, target),
        ),
      ).toBeLessThan(1e-5);
    expect(routePoint(0.55, node, target).toArray()).toEqual([0, 6.2, 0]);
    expect(routePoint(0.86, node, target).distanceTo(target)).toBeLessThan(
      1e-10,
    );
    expect(creationPhase(2).materialize).toBe(0);
    expect(creationPhase(4.6)).toMatchObject({ materialize: 1, envelope: 0 });
    expect(creationPhase(0).envelope).toBe(0);
  });
  it("limits simultaneous routed bursts, resets tick activation on cancellation and disposes owned geometry", () => {
    const scene = new T.Scene(),
      ticks = Array.from({ length: 96 }, () => new T.Mesh());
    const originals = ticks.map((t) => t.material),
      routes = createEnergyRoutes(scene, ticks);
    const node = scheduleOrbs(seed(), "2099-01-01T00:00")[0];
    const effects = Array.from({ length: 20 }, (_, i) => ({
      id: String(i),
      kind: "creation" as const,
      time: 0,
      to: { ...node, id: String(i) },
    }));
    routes.render(effects, 2, (_, out) => out.set(8, 6, 0), false);
    const heads = scene.children[0].children.find(
      (o) => o instanceof T.InstancedMesh,
    ) as T.InstancedMesh;
    expect(heads.count).toBe(MAX_ENERGY_ROUTES * 3);
    routes.render(effects, 2, (_, out) => out.set(8, 6, 0), true);
    expect(heads.count).toBe(0);
    expect(ticks.map((t) => t.material)).toEqual(originals);
    routes.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it("keeps the GPU focus and HTML projection on the authoritative transform every frame, including moves and rapid selection", () => {
    const scene = new T.Scene(),
      original = scheduleOrbs(seed(), "2099-01-01T00:00")[0],
      orbs = [original, { ...original, id: "other", angle: 0.4, lane: 2 }];
    const base: WorldInput = {
      area: "week",
      emphasis: false,
      reducedMotion: false,
      orbs,
      selectedOrb: orbs[0].id,
    };
    let targets: OrbProjection[] = [];
    const layer = createOrbLayer(
      scene,
      base,
      {
        metrics() {},
        error(e) {
          throw e;
        },
        projectOrbs(p) {
          targets = p;
        },
      },
      () => {},
    );
    const halos = Array.from({ length: 3 }, () => new T.Group());
    halos.forEach((h, i) => {
      h.rotation.x = 1.5;
      h.position.y = 4 + i;
    });
    const camera = new T.PerspectiveCamera(43, 1.6, 0.2, 140);
    camera.position.set(0, 7, 26);
    camera.lookAt(0, 6, 0);
    for (let frame = 0; frame < 8; frame++) {
      const moved = { ...orbs[frame % 2], angle: frame * 0.13 };
      const frameOrbs = orbs.map((o) => (o.id === moved.id ? moved : o));
      layer.update(
        {
          ...base,
          orbs: frameOrbs,
          selectedOrb: frame === 3 ? null : moved.id,
        },
        frame * 0.016,
      );
      halos[0].rotation.z = frame * 0.1;
      camera.position.x = frame * 0.1;
      layer.render(frame * 0.016, halos, camera);
      if (frame === 3) {
        expect(scene.getObjectByName("session-focus")!.visible).toBe(false);
        continue;
      }
      const focus = scene.getObjectByName("session-focus") as T.InstancedMesh,
        matrix = new T.Matrix4();
      focus.getMatrixAt(0, matrix);
      const p = new T.Vector3().setFromMatrixPosition(matrix),
        actual = layer.positionOf(moved.id)!;
      expect(p.distanceTo(actual)).toBeLessThan(1e-5);
      const projected = p.clone().project(camera),
        html = targets.find((t) => t.id === moved.id)!;
      expect(html.x).toBeCloseTo((projected.x + 1) * 50, 4);
      expect(html.y).toBeCloseTo((1 - projected.y) * 50, 4);
    }
    layer.dispose();
    expect(scene.children).toHaveLength(0);
  });
  it("coalesces rapid waves without stacking, and recovery never replays creations", () => {
    const input: WorldInput = {
      area: "week",
      emphasis: false,
      reducedMotion: false,
    };
    const waves = createLightEvents(input);
    for (let i = 0; i < 100; i++) waves.pulse("save", 1, i * 0.001);
    expect(waves.sample(0.1).events).toHaveLength(1);
    expect(waves.sample(5).events).toHaveLength(0);
    const node = scheduleOrbs(seed(), "2099-01-01T00:00")[0];
    const recovered = createOrbLifecycle([node]);
    expect(recovered.sample(0).effects).toEqual([]);
  });
});
