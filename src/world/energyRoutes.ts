import * as T from "three";
import type { OrbEffect } from "./orbLifecycle";
import { CREATION_SECONDS, MAX_ENERGY_ROUTES } from "./orbLifecycle";

const smooth = T.MathUtils.smoothstep;
export function creationPhase(age: number) {
  const t = T.MathUtils.clamp(age / CREATION_SECONDS, 0, 1);
  return {
    t,
    gather: smooth(t, 0, 0.22),
    rise: smooth(t, 0.18, 0.44),
    travel: smooth(t, 0.44, 0.62),
    rail: smooth(t, 0.62, 0.84),
    compress: smooth(t, 0.84, 0.94),
    materialize: smooth(t, 0.92, 1),
    envelope: smooth(t, 0, 0.035) * (1 - smooth(t, 0.94, 1)),
  };
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
  const capacity = MAX_ENERGY_ROUTES * 1000 * 6;
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
  const originals = ticks.map((tick) => tick.material);
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
    render(
      effects: readonly OrbEffect[],
      time: number,
      destination: (effect: OrbEffect, out: T.Vector3) => T.Vector3,
      rail: (
        effect: OrbEffect,
        angleOffset: number,
        out: T.Vector3,
      ) => T.Vector3,
      quiet: boolean,
    ) {
      ticks.forEach((tick, i) => {
        tick.material = originals[i];
        tick.scale.setScalar(1);
      });
      vertexCount = 0;
      let power = 0;
      const routes = quiet
        ? []
        : effects
            .filter(
              (e) =>
                e.kind === "creation" &&
                e.to &&
                time >= e.time &&
                time - e.time < CREATION_SECONDS,
            )
            .slice(-MAX_ENERGY_ROUTES);
      for (const effect of routes) {
        const phase = creationPhase(time - effect.time),
          node = routeNode(effect.id);
        const seed = node + Math.floor(time * 14);
        // Localized strikes retain a residual charge, never full-screen flashing.
        const strike =
          0.24 +
          0.76 *
            Math.pow(0.5 + 0.5 * Math.sin((time - effect.time) * 25 + node), 6);
        const charge = phase.envelope * (1 - smooth(phase.t, 0.43, 0.64));
        const discharge =
          smooth(phase.t, 0.42, 0.47) * (1 - smooth(phase.t, 0.63, 0.7));
        const reception =
          smooth(phase.t, 0.6, 0.65) * (1 - smooth(phase.t, 0.91, 0.98));
        power = Math.min(1, power + phase.envelope * (0.2 + phase.rise * 0.55));
        destination(effect, end);
        rail(effect, Math.PI, contact);
        for (let branch = 0; branch < 3; branch++) {
          const n = (node + branch * 8) % 96,
            angle = (n / 96) * Math.PI * 2;
          start.set(Math.sin(angle) * 5.5, 0.08, Math.cos(angle) * 5.5);
          arc(line(start, base), charge * strike, 0.065, seed + branch, 0.14);
          // Outer bus ties adjacent instruments together before feeding the core.
          arc(
            (t, out) =>
              out.set(
                Math.sin(angle + (t * Math.PI) / 6) * 5.5,
                0.08,
                Math.cos(angle + (t * Math.PI) / 6) * 5.5,
              ),
            charge * 0.65,
            0.055,
            seed,
            0.035,
            16,
          );
          const tick = ticks[n];
          if (tick && charge > 0.01) {
            tick.material = activeMaterial;
            tick.scale.setScalar(1 + charge * 1.3);
          }
        }
        arc(
          line(base, core),
          charge * phase.rise * (0.45 + strike * 0.55),
          0.09,
          seed,
          0.075,
        );
        // Directed branched discharge reaches the opposite side of the target rail.
        arc(
          line(core, contact),
          discharge * (0.6 + strike * 0.4),
          0.11,
          seed,
          0.23,
          40,
        );
        arc(
          (t, out) => {
            out.lerpVectors(core, contact, t);
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
        for (const sign of [-1, 1]) {
          const tip = Math.PI * (1 - phase.rail);
          arc(
            (t, out) =>
              rail(
                effect,
                sign * T.MathUtils.lerp(Math.min(Math.PI, tip + 0.75), tip, t),
                out,
              ),
            reception,
            0.13,
            seed + sign,
            0.025,
            32,
          );
          arc(
            (t, out) =>
              rail(effect, sign * T.MathUtils.lerp(Math.PI, tip, t), out),
            reception * 0.15,
            0.06,
            node,
            0,
            48,
          );
        }
        const compression =
          smooth(phase.t, 0.82, 0.87) * (1 - smooth(phase.t, 0.95, 1));
        // Bridge the small depth offset to a concentrated six-spoke knot.
        rail(effect, 0, contact);
        arc(line(contact, end), compression, 0.1, seed, 0.05, 12);
        for (let spoke = 0; spoke < 6; spoke++) {
          const angle = (spoke / 6) * Math.PI * 2,
            radius = 0.8 * (1 - phase.compress) + 0.035;
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
            0.075,
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
    },
  };
}
