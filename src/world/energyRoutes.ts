import * as T from "three";
import type { OrbEffect } from "./orbLifecycle";
import {
  CREATION_SECONDS,
  MAX_ENERGY_ROUTES,
  MAX_FORMATIONS,
  creationAge,
  routedCreations,
} from "./orbLifecycle";
export type RailEnergy = { charge: number; opening: number };
/** Gates retain temporal locations; only their presentation pose opens to Lumen. */
export function poseEnergyGate(
  gate: T.Group,
  angle: number,
  radius: number,
  energy: RailEnergy,
  source: T.Vector3,
) {
  gate.position.set(
    Math.cos(angle) * (radius + energy.opening * 0.85),
    Math.sin(angle) * (radius + energy.opening * 0.85),
    0,
  );
  const idle = new T.Quaternion().setFromUnitVectors(
    new T.Vector3(0, 0, 1),
    new T.Vector3(-Math.sin(angle), Math.cos(angle), 0),
  );
  const facing = new T.Quaternion().setFromUnitVectors(
    new T.Vector3(0, 0, 1),
    source.clone().sub(gate.position).normalize(),
  );
  gate.quaternion.copy(idle).slerp(facing, energy.opening);
  gate.scale.setScalar(1 + energy.charge * 0.45);
}

const smooth = T.MathUtils.smoothstep;
export function creationPhase(age: number) {
  const t = T.MathUtils.clamp(age / CREATION_SECONDS, 0, 1);
  return {
    t,
    gather: smooth(t, 0, 0.18),
    rise: smooth(t, 0.12, 0.34),
    travel: smooth(t, 0.3, 0.5),
    rail: smooth(t, 0.48, 0.75),
    compress: smooth(t, 0.72, 0.88),
    materialize: smooth(t, 0.86, 0.98),
    envelope: smooth(t, 0, 0.035) * (1 - smooth(t, 0.9, 1)),
  };
}
/** Both fronts start at the discharge contact and arrive at the session angle.
 * The return front wraps the remainder of the rail rather than a generic half-ring. */
export function railFronts(progress: number) {
  const contact = 0.9;
  return [
    {
      tip: T.MathUtils.lerp(contact, 0, progress),
      tail: T.MathUtils.lerp(contact, 0, Math.max(0, progress - 0.16)),
    },
    {
      tip: T.MathUtils.lerp(contact, Math.PI * 2, progress),
      tail: T.MathUtils.lerp(
        contact,
        Math.PI * 2,
        Math.max(0, progress - 0.16),
      ),
    },
  ];
}
export function routeNode(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 12) * 8;
}

const vertex = `
attribute vec3 tangent;
attribute vec2 electrical;
attribute float side;
varying vec2 vElectrical;
varying float vSide;
void main(){
 vec3 view=normalize(cameraPosition-position);
 vec3 across=cross(normalize(tangent),view);
 if(length(across)<.01) across=cross(normalize(tangent),vec3(0.,1.,.001));
 vec3 p=position+normalize(across)*side*electrical.x;
 vElectrical=electrical;vSide=side;
 gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
}`;
const fragment = `
varying vec2 vElectrical;varying float vSide;
void main(){
 float d=abs(vSide);
 float sheath=pow(max(0.,1.-d),2.)*.32;
 float core=exp(-d*d*90.);
 vec3 light=(vec3(.22,.78,1.15)*sheath+vec3(2.4,2.8,3.)*core)*vElectrical.y;
 gl_FragColor=vec4(light,clamp((sheath+core)*vElectrical.y,0.,1.));
}`;

/** World-space ribbons keep filaments crisp at any camera angle. No render target,
 * particle emitter, per-event GPU allocation, or academic state is owned here. */
export function createEnergyRoutes(scene: T.Scene, ticks: T.Mesh[]) {
  const capacity = MAX_ENERGY_ROUTES * 1000 * 6 + MAX_FORMATIONS * 170 * 6;
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array(capacity * 3),
    tangents = new Float32Array(capacity * 3),
    electrical = new Float32Array(capacity * 2),
    sides = new Float32Array(capacity);
  for (const [name, array, size] of [
    ["position", positions, 3],
    ["tangent", tangents, 3],
    ["electrical", electrical, 2],
    ["side", sides, 1],
  ] as const)
    geometry.setAttribute(
      name,
      new T.BufferAttribute(array, size).setUsage(T.DynamicDrawUsage),
    );
  const material = new T.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    side: T.DoubleSide,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.name = "electrical-network";
  mesh.frustumCulled = false;
  scene.add(mesh);
  const activeMaterial = new T.MeshBasicMaterial({
    color: new T.Color(1.2, 2.2, 2.7),
  });
  const busMaterial = new T.MeshBasicMaterial();
  // Fixed presentation-only slots, sampled by the crystal's refracted interior.
  const internalBranches = Array.from(
    { length: MAX_ENERGY_ROUTES },
    () => new T.Vector4(),
  );
  const originals = ticks.map((tick) => tick.material);
  const railEnergies: RailEnergy[] = Array.from({ length: 3 }, () => ({
    charge: 0,
    opening: 0,
  }));
  const a = new T.Vector3(),
    b = new T.Vector3(),
    direction = new T.Vector3();
  const end = new T.Vector3(),
    contact = new T.Vector3(),
    start = new T.Vector3();
  const core = new T.Vector3(0, 6.2, 0),
    base = new T.Vector3(0, 0.25, 0);
  let vertexCount = 0;
  // Angular interior branches; endpoints stay fixed to physical conductors.
  function arc(
    sample: (t: number, out: T.Vector3) => T.Vector3,
    strength: number,
    width: number,
    seed: number,
    jitter: number,
    steps = 24,
  ) {
    if (strength < 0.001) return;
    function point(i: number, out: T.Vector3) {
      const t = i / steps;
      sample(t, out);
      const amount = Math.sin(t * Math.PI) * jitter;
      out.x += Math.sin(i * 17.13 + seed * 7.7) * amount;
      out.y += Math.sin(i * 9.71 + seed * 3.1) * amount;
      out.z += Math.sin(i * 13.37 + seed * 5.3) * amount;
    }
    point(0, a);
    for (let i = 1; i <= steps; i++) {
      point(i, b);
      direction.subVectors(b, a);
      if (direction.lengthSq() < 1e-12) continue;
      if (vertexCount + 6 > capacity) return;
      for (const [endpoint, side] of [
        [a, -1],
        [a, 1],
        [b, 1],
        [a, -1],
        [b, 1],
        [b, -1],
      ] as const) {
        endpoint.toArray(positions, vertexCount * 3);
        direction.toArray(tangents, vertexCount * 3);
        electrical[vertexCount * 2] = width;
        electrical[vertexCount * 2 + 1] = strength;
        sides[vertexCount++] = side;
      }
      a.copy(b);
    }
  }
  const line =
    (from: T.Vector3, to: T.Vector3) => (t: number, out: T.Vector3) =>
      out.lerpVectors(from, to, t);
  return {
    internalBranches() {
      return internalBranches;
    },
    railEnergies() {
      return railEnergies;
    },
    render(
      effects: readonly OrbEffect[],
      time: number,
      destination: (effect: OrbEffect, out: T.Vector3) => T.Vector3,
      rail: (
        effect: OrbEffect,
        angleOffset: number,
        out: T.Vector3,
        radialLift?: number,
      ) => T.Vector3,
      quiet: boolean,
    ) {
      ticks.forEach((tick, i) => {
        tick.material = originals[i];
        tick.scale.setScalar(1);
      });
      vertexCount = 0;
      internalBranches.forEach((branch) => branch.set(0, 0, 0, 0));
      railEnergies.forEach((e) => {
        e.charge = 0;
        e.opening = 0;
      });
      let power = 0;
      const routes = quiet ? [] : routedCreations(effects, time);
      // One distribution system per cohort/rail, followed by distinct formation
      // points. No repeated full-rail or pedestal animation per member.
      const systems = [
        ...new Map(
          routes.map((e) => [
            e.batch?.grouped ? `${e.batch.start}:${e.to!.lane}` : e.id,
            e,
          ]),
        ).values(),
      ];
      // Resolve the shared physical gate pose before any cohort draws contacts.
      for (const effect of systems) {
        if (!effect.batch?.grouped) continue;
        const phase = creationPhase(creationAge(effect, time)),
          laneEnergy = railEnergies[effect.to!.lane];
        laneEnergy.charge = Math.max(
          laneEnergy.charge,
          smooth(phase.t, 0.26, 0.46) * (1 - smooth(phase.t, 0.9, 1)),
        );
        laneEnergy.opening = Math.max(
          laneEnergy.opening,
          smooth(phase.t, 0.18, 0.4) * (1 - smooth(phase.t, 0.86, 1)),
        );
      }
      const chargeOf = (t: number) =>
        smooth(t, 0, 0.035) * (1 - smooth(t, 0.36, 0.58));
      const platformCharge = Math.max(
        0,
        ...routes.map((e) => chargeOf(creationPhase(creationAge(e, time)).t)),
      );
      const coreCharge = Math.max(
        0,
        ...routes.map((e) => {
          const phase = creationPhase(creationAge(e, time));
          return chargeOf(phase.t) * phase.rise;
        }),
      );
      const budget = 1 / Math.sqrt(Math.max(1, systems.length));
      // One shared bus and spine, regardless of how many births are in flight.
      // Every instrument participates; selected feeder nodes remain brighter.
      if (platformCharge > 0.001) {
        busMaterial.color.setRGB(
          0.35 * platformCharge,
          1.05 * platformCharge,
          1.4 * platformCharge,
        );
        ticks.forEach((tick) => {
          tick.material = busMaterial;
          tick.scale.setScalar(1 + platformCharge * 0.25);
        });
        for (const radius of [4.9, 5.5])
          arc(
            (t, out) =>
              out.set(
                Math.sin(t * Math.PI * 2) * radius,
                0.08,
                Math.cos(t * Math.PI * 2) * radius,
              ),
            platformCharge * (radius > 5 ? 0.7 : 0.32),
            0.18,
            0,
            0.018,
            192,
          );
        // A circulating front makes the full bus read as routed current.
        for (const direction of [-1, 1])
          arc(
            (t, out) => {
              const angle = direction * time * 4.5 + t * 1.1;
              return out.set(Math.sin(angle) * 5.5, 0.1, Math.cos(angle) * 5.5);
            },
            platformCharge * 0.85,
            0.14,
            0,
            0.025,
            32,
          );
      }
      arc(
        line(base, core),
        coreCharge * 1.1,
        0.25,
        Math.floor(time * 14),
        0.18,
      );
      // Shared branching pedestal lattice and dense intake bundle.
      for (let spoke = 0; spoke < 8; spoke++) {
        const angle = (spoke * Math.PI) / 4,
          seed = spoke + Math.floor(time * 12);
        start.set(Math.sin(angle) * 5.5, 0.08, Math.cos(angle) * 5.5);
        const elbow = new T.Vector3(
          Math.sin(angle + 0.18) * 2.3,
          0.28,
          Math.cos(angle + 0.18) * 2.3,
        );
        arc(line(start, elbow), platformCharge * 0.85, 0.16, seed, 0.28, 24);
        arc(line(elbow, base), platformCharge, 0.2, seed + 2, 0.22, 20);
        const fork = new T.Vector3(
          Math.sin(angle - 0.2) * 3.5,
          0.12,
          Math.cos(angle - 0.2) * 3.5,
        );
        arc(
          line(fork, elbow),
          platformCharge * (0.35 + 0.25 * Math.sin(time * 17 + spoke) ** 2),
          0.1,
          seed + 5,
          0.22,
          14,
        );
      }
      for (let strand = 0; strand < 5; strand++)
        arc(
          (t, out) => {
            const radius = (1 - t) * 0.85 + 0.05,
              angle = strand * Math.PI * 0.4 + t * 1.3;
            return out.set(
              Math.cos(angle) * radius,
              0.2 + t * 2.5,
              Math.sin(angle) * radius,
            );
          },
          coreCharge * 0.85,
          0.15,
          Math.floor(time * 14) + strand,
          0.1,
          22,
        );
      for (const [routeIndex, effect] of systems.entries()) {
        const phase = creationPhase(creationAge(effect, time)),
          node = routeNode(effect.id);
        const seed = node + Math.floor(time * 14);
        // Localized strikes retain a residual charge, never full-screen flashing.
        const strike =
          0.24 +
          0.76 *
            Math.pow(0.5 + 0.5 * Math.sin((time - effect.time) * 25 + node), 6);
        const charge = chargeOf(phase.t) * budget;
        const discharge =
          smooth(phase.t, 0.28, 0.34) *
          (1 - smooth(phase.t, 0.5, 0.57)) *
          budget;
        const reception =
          smooth(phase.t, 0.47, 0.52) * (1 - smooth(phase.t, 0.88, 1)) * budget;
        power = Math.min(1, power + phase.envelope * (0.2 + phase.rise * 0.55));
        destination(effect, end);
        rail(effect, 0.9, contact);
        const internalStrength =
          (smooth(phase.t, 0.08, 0.22) * (1 - smooth(phase.t, 0.45, 0.64))) /
          Math.max(1, routes.length);
        const grouped = effect.batch?.grouped === true;
        const opening = grouped ? railEnergies[effect.to!.lane].opening : 0;
        const gateCharge = grouped
          ? smooth(phase.t, 0.26, 0.46) * (1 - smooth(phase.t, 0.9, 1))
          : 0;
        internalBranches[routeIndex % MAX_ENERGY_ROUTES].set(
          contact.x,
          contact.y,
          contact.z,
          (internalStrength * routes.length) / Math.max(1, systems.length),
        );
        for (let branch = 0; branch < 3; branch++) {
          const n = (node + branch * 32) % 96,
            angle = (n / 96) * Math.PI * 2;
          start.set(Math.sin(angle) * 5.5, 0.08, Math.cos(angle) * 5.5);
          const tick = ticks[n];
          if (tick && charge > 0.01) {
            tick.material = activeMaterial;
            tick.scale.setScalar(1 + charge * 1.3);
          }
        }
        if (grouped) {
          // Four simultaneously opened gates receive ONE fan-out distribution.
          for (let gate = 0; gate < 4; gate++) {
            rail(
              effect,
              Math.PI / 2 - (gate * Math.PI) / 2 - effect.to!.angle,
              contact,
              opening * 0.85,
            );
            arc(
              (t, out) => out.lerpVectors(core, contact, t * phase.travel),
              discharge * 0.7,
              0.16,
              seed + gate,
              0.22,
              32,
            );
            rail(
              effect,
              Math.PI / 2 - (gate * Math.PI) / 2 - effect.to!.angle,
              end,
            );
            arc(
              line(contact, end),
              gateCharge * 0.75,
              0.17,
              seed + gate,
              0.07,
              12,
            );
          }
          arc(
            (t, out) => rail(effect, t * Math.PI * 2, out),
            reception * 0.85,
            0.21,
            seed,
            0.018,
            192,
          );
        }
        // Directed discharge reaches the intended sector, then charges its rail.
        if (!grouped) {
          arc(
            (t, out) => out.lerpVectors(core, contact, t * phase.travel),
            discharge * (0.6 + strike * 0.4),
            0.11,
            seed,
            0.23,
            40,
          );
          arc(
            (t, out) => {
              out.lerpVectors(core, contact, t * phase.travel);
              out.y += Math.sin(t * Math.PI) * 0.4;
              return out;
            },
            discharge * strike * 0.4,
            0.05,
            seed + 3,
            0.15,
            32,
          );
          // Counterpropagating pulses follow the live ring, including world motion.
          for (const [index, front] of railFronts(phase.rail).entries()) {
            arc(
              (t, out) =>
                rail(effect, T.MathUtils.lerp(front.tail, front.tip, t), out),
              reception,
              0.22,
              seed + index,
              0.025,
              32,
            );
            arc(
              (t, out) =>
                rail(effect, T.MathUtils.lerp(0.9, front.tip, t), out),
              reception * 0.24,
              0.11,
              node,
              0,
              48,
            );
          }
        }
      }
      const formationBudget = 1 / Math.sqrt(Math.max(1, routes.length / 4));
      for (const effect of routes) {
        const phase = creationPhase(creationAge(effect, time));
        const node = routeNode(effect.id),
          seed = node + Math.floor(time * 14);
        const strike = 0.65 + 0.35 * Math.sin(time * 19 + node) ** 2;
        const reception =
          smooth(phase.t, 0.55, 0.7) *
          (1 - smooth(phase.t, 0.9, 1)) *
          formationBudget;
        destination(effect, end);
        // A contracting sector highlights the EXACT saved time before the orb
        // appears. It stays on the conductor, including tilted/moving rails.
        const sector = T.MathUtils.lerp(0.34, 0.035, phase.compress);
        arc(
          (t, out) => rail(effect, (t * 2 - 1) * sector, out),
          reception * (0.55 + phase.rail * 0.45),
          0.3,
          node,
          0.012,
          40,
        );
        const compression =
          smooth(phase.t, 0.7, 0.79) *
          (1 - smooth(phase.t, 0.94, 1)) *
          formationBudget;
        // Compression is centered on the conductor, exactly like the orb.
        rail(effect, 0, contact);
        arc(line(contact, end), compression, 0.1, seed, 0.05, 12);
        const knotRadius = 0.95 * (1 - phase.compress) + 0.06;
        arc(
          (t, out) =>
            out
              .copy(end)
              .add(
                new T.Vector3(
                  Math.cos(t * Math.PI * 2) * knotRadius,
                  Math.sin(t * Math.PI * 2) * knotRadius,
                  0,
                ),
              ),
          compression,
          0.12,
          seed,
          0.015,
          40,
        );
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = (spoke / 6) * Math.PI * 2,
            radius = 1.15 * (1 - phase.compress) + 0.06;
          start
            .copy(end)
            .add(
              new T.Vector3(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius,
                Math.sin(angle * 2) * radius * 0.3,
              ),
            );
          arc(
            line(start, end),
            compression * (0.5 + strike * 0.5),
            0.13,
            seed + spoke,
            radius * 0.15,
            10,
          );
        }
      }
      geometry.setDrawRange(0, vertexCount);
      for (const attribute of Object.values(geometry.attributes))
        attribute.needsUpdate = true;
      return power;
    },
    dispose() {
      ticks.forEach((tick, i) => {
        tick.material = originals[i];
        tick.scale.setScalar(1);
      });
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      activeMaterial.dispose();
      busMaterial.dispose();
    },
  };
}
