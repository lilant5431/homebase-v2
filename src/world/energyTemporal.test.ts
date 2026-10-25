import { describe, it, expect } from "vitest";
import * as T from "three";
import { seed, type Block } from "../domain";
import { scheduleOrbs } from "../constellation/adapter";
import { creationPhase, createEnergyRoutes } from "./energyRoutes";
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
  it("orders charge, discharge, rail reception and compression before orb materialization", () => {
    expect(creationPhase(0).envelope).toBe(0);
    const charged = creationPhase(4.6 * 0.43);
    expect(charged.gather).toBe(1);
    expect(charged.rise).toBeGreaterThan(0.99);
    expect(charged.rail).toBe(0);
    expect(charged.materialize).toBe(0);
    expect(creationPhase(4.6 * 0.62).travel).toBe(1);
    expect(creationPhase(4.6 * 0.84)).toMatchObject({
      rail: 1,
      compress: 0,
      materialize: 0,
    });
    expect(creationPhase(4.6 * 0.92).compress).toBeGreaterThan(0.89);
    expect(creationPhase(4.6 * 0.92).materialize).toBeCloseTo(0, 12);
    expect(creationPhase(4.6)).toMatchObject({ materialize: 1, envelope: 0 });
  });
  it("bounds rapid discharges, follows transformed rail geometry, fades and disposes resources", () => {
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
    const halo = new T.Group();
    halo.position.set(3, 5, -2);
    halo.rotation.set(1.3, 0.2, 0.4);
    halo.scale.setScalar(0.82);
    halo.updateMatrixWorld(true);
    const rail = (_: unknown, angle: number, out: T.Vector3) =>
      halo.localToWorld(out.set(Math.cos(angle) * 8, Math.sin(angle) * 8, 0));
    const target = (_: unknown, out: T.Vector3) => rail(null, 0, out);
    const mesh = scene.getObjectByName(
      "electrical-network",
    ) as T.Mesh<T.BufferGeometry>;
    routes.render(effects, 1, target, rail, false);
    expect(ticks.some((t, i) => t.material !== originals[i])).toBe(true);
    const count = mesh.geometry.drawRange.count;
    routes.render(effects.slice(-MAX_ENERGY_ROUTES), 1, target, rail, false);
    expect(mesh.geometry.drawRange.count).toBe(count);
    expect(count).toBeLessThanOrEqual(
      mesh.geometry.getAttribute("position").count,
    );
    // Between discharge and compression ONLY ring-bound electricity is drawn.
    routes.render(effects, 4.6 * 0.76, target, rail, false);
    const vertices = mesh.geometry.getAttribute("position"),
      point = new T.Vector3();
    expect(mesh.geometry.drawRange.count).toBeGreaterThan(0);
    for (let i = 0; i < mesh.geometry.drawRange.count; i++) {
      point.fromBufferAttribute(vertices, i);
      halo.worldToLocal(point);
      expect(Math.abs(point.z)).toBeLessThan(0.055);
      expect(Math.abs(Math.hypot(point.x, point.y) - 8)).toBeLessThan(0.055);
    }
    const strength = mesh.geometry.getAttribute("electrical");
    routes.render(effects, 4.6 * 0.99, target, rail, false);
    expect(
      Math.max(
        ...Array.from({ length: mesh.geometry.drawRange.count }, (_, i) =>
          strength.getY(i),
        ),
      ),
    ).toBeLessThan(0.2);
    routes.render(effects, 4.6, target, rail, false);
    expect(mesh.geometry.drawRange.count).toBe(0);
    routes.render(effects, 1, target, rail, true);
    expect(mesh.geometry.drawRange.count).toBe(0);
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
  it("keeps selected birth opacity synchronized and settles quietly without replay under reduced motion", () => {
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
    const camera = new T.PerspectiveCamera(43, 1.6, 0.2, 140);
    camera.position.set(0, 7, 26);
    camera.lookAt(0, 6, 0);
    const next = { ...input, orbs: [orb], selectedOrb: orb.id };
    layer.update(next, 0);
    layer.render(1, halos, camera);
    const focus = scene.getObjectByName("session-focus") as T.InstancedMesh;
    const aura = scene.getObjectByName("session-coronas") as T.InstancedMesh;
    const opacity = (mesh: T.InstancedMesh) =>
      mesh.geometry.getAttribute("aState").getX(0);
    expect(opacity(focus)).toBe(0);
    expect(opacity(aura)).toBe(0);
    layer.render(4.5, halos, camera);
    expect(opacity(focus)).toBeCloseTo(opacity(aura), 8);
    expect(opacity(focus)).toBeGreaterThan(0.5);
    layer.update({ ...next, reducedMotion: true }, 4.51);
    layer.render(4.51, halos, camera);
    const network = scene.getObjectByName(
      "electrical-network",
    ) as T.Mesh<T.BufferGeometry>;
    expect(network.geometry.drawRange.count).toBe(0);
    expect(opacity(focus)).toBe(1);
    layer.update(next, 4.52);
    layer.render(4.52, halos, camera);
    expect(network.geometry.drawRange.count).toBe(0);
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
