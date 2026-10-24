import * as T from "three";
import type { WorldInput, WorldHooks, WorldOrb } from "./contract";
import { createOrbLifecycle } from "./orbLifecycle";

const vertex = `
attribute vec4 aState;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vState;
void main(){
 vUv=uv; vColor=instanceColor; vState=aState;
 vec4 center=modelViewMatrix*instanceMatrix*vec4(0.,0.,0.,1.);
 float size=length(instanceMatrix[0].xyz);
 center.xy+=position.xy*size;
 gl_Position=projectionMatrix*center;
}`;
const fragment = `
uniform float uTime;
varying vec2 vUv; varying vec3 vColor; varying vec4 vState;
void main(){
 vec2 p=(vUv-.5)*2.; float r=length(p);
 float a=atan(p.y,p.x);
 float core=exp(-r*r*65.);
 float lens=exp(-pow((r-.28)*16.,2.))*.43;
 float corona=exp(-r*r*7.)*.24;
 float filaments=pow(max(0.,cos(a*5.+r*30.-uTime*1.5+vState.w)),18.)*exp(-r*5.)*.22;
 float reticle=exp(-pow((r-.72)*65.,2.))*vState.y*.65;
 float light=(core*4.+lens+corona+filaments+reticle)*vState.x;
 vec3 tint=mix(vColor,vec3(1.,.66,.35),vState.z*.35);
 gl_FragColor=vec4(tint*light,clamp(light,0.,1.));
}`;

/** GPU presentation resources only. The snapshot diff never owns academic state. */
export function createOrbLayer(
  scene: T.Scene,
  initial: WorldInput,
  hooks: WorldHooks,
  pulse: (kind: string, strength: number, time: number) => void,
) {
  const capacity = 5050;
  const geometry = new T.PlaneGeometry(2, 2);
  const states = new T.InstancedBufferAttribute(
    new Float32Array(capacity * 4),
    4,
  );
  states.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute("aState", states);
  const material = new T.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: { uTime: { value: 0 } },
    vertexColors: true,
    transparent: true,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  });
  const aura = new T.InstancedMesh(geometry, material, capacity);
  aura.frustumCulled = false;
  aura.instanceMatrix.setUsage(T.DynamicDrawUsage);
  const coreGeometry = new T.OctahedronGeometry(0.12, 0);
  const coreMaterial = new T.MeshBasicMaterial({
    color: new T.Color(2.4, 2.9, 3.1),
  });
  const cores = new T.InstancedMesh(coreGeometry, coreMaterial, capacity);
  cores.frustumCulled = false;
  cores.instanceMatrix.setUsage(T.DynamicDrawUsage);
  aura.setColorAt(0, new T.Color());
  cores.setColorAt(0, new T.Color());
  aura.count = cores.count = 0;
  const focusGeometry = new T.PlaneGeometry(2, 2);
  const focusState = new T.InstancedBufferAttribute(
    new Float32Array([1, 1, 0, 0]),
    4,
  );
  focusGeometry.setAttribute("aState", focusState);
  const focusMaterial = material.clone();
  focusMaterial.depthTest = false;
  const focus = new T.InstancedMesh(focusGeometry, focusMaterial, 1);
  focus.setColorAt(0, new T.Color());
  focus.frustumCulled = false;
  focus.visible = false;
  focus.renderOrder = 5;
  const arcGeometry = new T.BufferGeometry();
  const arcPositions = new Float32Array(48 * 18 * 6);
  arcGeometry.setAttribute(
    "position",
    new T.BufferAttribute(arcPositions, 3).setUsage(T.DynamicDrawUsage),
  );
  const arcMaterial = new T.LineBasicMaterial({
    color: new T.Color(0.8, 1.8, 2.2),
    transparent: true,
    opacity: 0.75,
    blending: T.AdditiveBlending,
    depthWrite: false,
  });
  const arcs = new T.LineSegments(arcGeometry, arcMaterial);
  arcs.frustumCulled = false;
  const group = new T.Group();
  group.add(aura, cores, arcs, focus);
  scene.add(group);
  const life = createOrbLifecycle(initial.orbs || [], initial.selectedOrb);
  let input = initial,
    lastReport = -1,
    eventCount = 0;
  const matrix = new T.Matrix4(),
    rotation = new T.Quaternion(),
    scale = new T.Vector3(),
    pos = new T.Vector3();
  const target = new T.Vector3(),
    from = new T.Vector3();
  const color = new T.Color();
  const source = new T.Vector3(0, 6.2, 0);
  const positions = new Map<string, T.Vector3>();
  function at(orb: WorldOrb, halos: T.Group[], out: T.Vector3) {
    // Weekday and nominal wall-clock minute determine position. Crowds form
    // small stacks along the same rail instead of losing identity in one point.
    const radius = 7.1 + orb.lane * 0.9;
    out.set(
      Math.cos(orb.angle) * radius,
      Math.sin(orb.angle) * radius,
      0.2 + orb.spread,
    );
    return halos[orb.lane].localToWorld(out);
  }
  return {
    positionOf(id: string) {
      return positions.get(id)?.clone();
    },
    update(next: WorldInput, time: number) {
      life.update(
        next.orbs || [],
        next.selectedOrb,
        time,
        next.reducedMotion || input.reducedMotion,
      );
      input = next;
      const sample = life.sample(time);
      if (sample.count !== eventCount) {
        eventCount = sample.count;
        pulse(
          `Session ${sample.last}`,
          sample.last === "deletion"
            ? 0.25
            : sample.last === "completion"
              ? 1.15
              : 0.9,
          time,
        );
      }
    },
    render(time: number, halos: T.Group[], camera: T.Camera, force = false) {
      if (input.reducedMotion) life.clear();
      material.uniforms.uTime.value = time;
      focusMaterial.uniforms.uTime.value = time;
      focus.visible = false;
      halos.forEach((halo) => halo.updateMatrixWorld(true));
      const { effects, count, last } = life.sample(time);
      const effectsById = new Map(effects.map((e) => [e.id, e]));
      const nodes = (input.orbs || []).filter((orb) => !orb.completed);
      for (const e of effects)
        if (
          (e.kind === "completion" || e.kind === "deletion") &&
          e.from &&
          !nodes.some((n) => n.id === e.id)
        )
          nodes.push(e.from);
      positions.clear();
      let index = 0,
        arcIndex = 0;
      for (const orb of nodes.slice(0, capacity)) {
        const effect = effectsById.get(orb.id);
        const age = effect ? time - effect.time : 100;
        const selected = input.selectedOrb === orb.id;
        const birth = effect?.kind === "creation";
        const complete = effect?.kind === "completion";
        const deleting = effect?.kind === "deletion";
        at(orb, halos, target);
        pos.copy(target);
        let alpha = 1;
        if (birth) {
          const t = T.MathUtils.smoothstep(age, 0.28, 1.65);
          pos.lerpVectors(source, target, t);
          alpha = T.MathUtils.smoothstep(age, 0, 0.35);
        }
        if (effect?.kind === "move" && effect.from) {
          const t = T.MathUtils.smoothstep(age, 0, 1.6);
          const difference = orb.angle - effect.from.angle;
          const angle =
            effect.from.angle +
            Math.atan2(Math.sin(difference), Math.cos(difference)) * t;
          at({ ...effect.from, angle }, halos, from);
          at({ ...orb, angle }, halos, target);
          pos.lerpVectors(from, target, t);
        }
        if (complete) {
          pos.lerp(source, T.MathUtils.smoothstep(age, 0.18, 1.85));
          alpha = 1 - T.MathUtils.smoothstep(age, 1.35, 2.4);
        }
        if (deleting) alpha = 1 - T.MathUtils.smoothstep(age, 0, 1.05);
        const size =
          orb.size *
          (selected ? 1.5 : 1) *
          (complete
            ? 1 + Math.sin(Math.min(age / 2.4, 1) * Math.PI) * 0.65
            : 1);
        scale.setScalar(size);
        matrix.compose(pos, rotation, scale);
        aura.setMatrixAt(index, matrix);
        scale.setScalar((selected ? 1.4 : 1) * alpha);
        matrix.compose(pos, rotation, scale);
        cores.setMatrixAt(index, matrix);
        color.set(orb.color);
        aura.setColorAt(index, color);
        cores.setColorAt(index, color);
        if (selected && !complete && !deleting) {
          scale.setScalar(size * 1.15);
          matrix.compose(pos, rotation, scale);
          focus.setMatrixAt(0, matrix);
          focus.setColorAt(0, color);
          focus.instanceMatrix.needsUpdate = true;
          focus.instanceColor!.needsUpdate = true;
          focus.visible = true;
        }
        states.setXYZW(
          index,
          alpha,
          selected ? 1 : 0,
          orb.overdue ? 1 : 0,
          index * 0.73,
        );
        if (!complete && !deleting) positions.set(orb.id, pos.clone());
        if ((birth || complete) && age < 1.9 && arcIndex < 48) {
          const end = pos.clone();
          const start = source;
          for (let step = 0; step < 18; step++) {
            for (let side = 0; side < 2; side++) {
              const t = (step + side) / 18;
              from.lerpVectors(start, end, t);
              const bend =
                Math.sin(t * Math.PI) * 0.13 * Math.sin(step * 2.7 + time * 29);
              from.x += bend;
              from.z += bend * 0.6;
              from.toArray(
                arcPositions,
                (arcIndex * 18 * 2 + step * 2 + side) * 3,
              );
            }
          }
          arcIndex++;
        }
        index++;
      }
      aura.count = cores.count = index;
      aura.instanceMatrix.needsUpdate = cores.instanceMatrix.needsUpdate = true;
      if (aura.instanceColor) aura.instanceColor.needsUpdate = true;
      if (cores.instanceColor) cores.instanceColor.needsUpdate = true;
      states.needsUpdate = true;
      arcGeometry.setDrawRange(0, arcIndex * 18 * 2);
      arcGeometry.attributes.position.needsUpdate = true;
      if (force || time - lastReport > 0.1) {
        lastReport = time;
        hooks.projectOrbs?.(projectOrbs(positions, camera, input.selectedOrb));
      }
      return `${positions.size} active / ${(input.orbs || []).length} sessions · ${count} transitions · ${last}`;
    },
    dispose() {
      scene.remove(group);
      aura.dispose();
      cores.dispose();
      focus.dispose();
      focusGeometry.dispose();
      focusMaterial.dispose();
      geometry.dispose();
      material.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      arcGeometry.dispose();
      arcMaterial.dispose();
    },
  };
}

// Also used for a single static frame: lookAt must be committed before projection.
export function projectOrbs(
  positions: ReadonlyMap<string, T.Vector3>,
  camera: T.Camera,
  selected?: string | null,
) {
  camera.updateMatrixWorld();
  const projected = new T.Vector3(),
    occupied: Array<[number, number]> = [];
  return [...positions]
    .sort(([a], [b]) => (a === selected ? -1 : b === selected ? 1 : 0))
    .flatMap(([id, position]) => {
      projected.copy(position).project(camera);
      const x = (projected.x + 1) * 50,
        y = (1 - projected.y) * 50;
      if (
        projected.z < -1 ||
        projected.z > 1 ||
        x < 26 ||
        x > 97 ||
        y < 13 ||
        y > 88 ||
        occupied.length >= 64 ||
        occupied.some(
          ([ox, oy]) => Math.abs(ox - x) < 4 && Math.abs(oy - y) < 5,
        )
      )
        return [];
      occupied.push([x, y]);
      return [{ id, x, y, visible: true }];
    });
}
