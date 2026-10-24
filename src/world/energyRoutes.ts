import * as T from "three";
import type { OrbEffect } from "./orbLifecycle";
import { CREATION_SECONDS, MAX_ENERGY_ROUTES } from "./orbLifecycle";

export function creationPhase(age: number) {
  const t = T.MathUtils.clamp(age / CREATION_SECONDS, 0, 1);
  return {
    t,
    gather: T.MathUtils.smoothstep(t, 0, 0.28),
    rise: T.MathUtils.smoothstep(t, 0.28, 0.55),
    travel: T.MathUtils.smoothstep(t, 0.55, 0.86),
    materialize: T.MathUtils.smoothstep(t, 0.86, 1),
    envelope:
      T.MathUtils.smoothstep(t, 0, 0.04) *
      (1 - T.MathUtils.smoothstep(t, 0.88, 1)),
  };
}
export function routeNode(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 12) * 8;
}
/** One organized path, shared by the electrical trace and the moving light. */
export function routePoint(
  t: number,
  node: number,
  destination: T.Vector3,
  out = new T.Vector3(),
) {
  const a = (node / 96) * Math.PI * 2;
  if (t <= 0.28) {
    const p = t / 0.28,
      radius = 5.5 * (1 - p);
    // Concentric feeder followed by a radial conductor; no random beam spawn.
    const turn = a + Math.min(p * 3, 1) * 0.22;
    return out.set(
      Math.sin(turn) * radius,
      0.08 + p * 0.12,
      Math.cos(turn) * radius,
    );
  }
  if (t <= 0.55) return out.set(0, 0.2 + ((t - 0.28) / 0.27) * 6, 0);
  const p = T.MathUtils.clamp((t - 0.55) / 0.31, 0, 1),
    q = 1 - p;
  // A directed exit above the core, bending into the exact live rail transform.
  return out.set(
    destination.x * p * p,
    6.2 * q * q + 2 * q * p * 8.4 + destination.y * p * p,
    destination.z * p * p,
  );
}

/** Bounded GPU presentation only. Reuses the existing 96 pedestal instruments. */
export function createEnergyRoutes(scene: T.Scene, ticks: T.Mesh[]) {
  const segments = 96,
    branches = 3,
    capacity = MAX_ENERGY_ROUTES * branches * segments * 2;
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array(capacity * 3),
    colors = new Float32Array(capacity * 3);
  geometry.setAttribute(
    "position",
    new T.BufferAttribute(positions, 3).setUsage(T.DynamicDrawUsage),
  );
  geometry.setAttribute(
    "color",
    new T.BufferAttribute(colors, 3).setUsage(T.DynamicDrawUsage),
  );
  const material = new T.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new T.LineSegments(geometry, material);
  lines.frustumCulled = false;
  const headGeometry = new T.OctahedronGeometry(0.16, 0);
  const headMaterial = new T.MeshBasicMaterial({
    color: new T.Color(2, 3.2, 3.5),
  });
  const heads = new T.InstancedMesh(
    headGeometry,
    headMaterial,
    MAX_ENERGY_ROUTES * branches,
  );
  heads.frustumCulled = false;
  heads.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const activeMaterial = new T.MeshBasicMaterial({
    color: new T.Color(1.2, 2.2, 2.7),
  });
  const originals = ticks.map((t) => t.material);
  const matrix = new T.Matrix4(),
    point = new T.Vector3(),
    tint = new T.Color();
  const group = new T.Group();
  group.add(lines, heads);
  scene.add(group);
  let power = 0;
  return {
    render(
      effects: readonly OrbEffect[],
      time: number,
      destination: (effect: OrbEffect, out: T.Vector3) => T.Vector3,
      quiet: boolean,
    ) {
      ticks.forEach((tick, i) => {
        tick.material = originals[i];
        tick.scale.setScalar(1);
      });
      const routes = quiet
        ? []
        : effects
            .filter((e) => e.kind === "creation" && e.to)
            .slice(-MAX_ENERGY_ROUTES);
      let vertex = 0,
        head = 0;
      power = 0;
      for (const effect of routes) {
        const phase = creationPhase(time - effect.time),
          node = routeNode(effect.id);
        const end = destination(effect, new T.Vector3());
        power = Math.min(1, power + phase.envelope * 0.45);
        for (let branch = 0; branch < branches; branch++) {
          const n = (node + branch * 8) % 96,
            lag = branch * 0.018;
          const progress = T.MathUtils.clamp(phase.t - lag, 0, 1);
          const tick = ticks[n];
          if (tick) {
            tick.material = activeMaterial;
            tick.scale.setScalar(1 + phase.envelope * 1.8);
          }
          tint.set(effect.to!.color);
          for (let i = 0; i < segments; i++)
            for (let side = 0; side < 2; side++) {
              const t = (i + side) / segments;
              routePoint(t, n, end, point).toArray(positions, vertex * 3);
              const distance = progress - t;
              const trail =
                Math.exp(-Math.pow(distance / 0.065, 2)) * phase.envelope;
              const trace = t < progress ? 0.035 * phase.envelope : 0;
              colors[vertex * 3] = tint.r * (trail * 3 + trace);
              colors[vertex * 3 + 1] = tint.g * (trail * 3 + trace);
              colors[vertex * 3 + 2] = tint.b * (trail * 3 + trace);
              vertex++;
            }
          routePoint(progress, n, end, point);
          matrix
            .makeScale(phase.envelope, phase.envelope, phase.envelope)
            .setPosition(point);
          heads.setMatrixAt(head++, matrix);
        }
      }
      geometry.setDrawRange(0, vertex);
      geometry.attributes.position.needsUpdate =
        geometry.attributes.color.needsUpdate = true;
      heads.count = head;
      heads.instanceMatrix.needsUpdate = true;
      return power;
    },
    dispose() {
      ticks.forEach((t, i) => {
        t.material = originals[i];
        t.scale.setScalar(1);
      });
      scene.remove(group);
      heads.dispose();
      geometry.dispose();
      material.dispose();
      headGeometry.dispose();
      headMaterial.dispose();
      activeMaterial.dispose();
    },
  };
}
