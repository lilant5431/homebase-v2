import * as T from "three";
import { lumenDrive } from "./lumenDrive";
import { createLightEvents } from "./lightEvents";
import { createOrbLayer } from "./orbLayer";
import { Reflector } from "three/addons/objects/Reflector.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { makeCrystalGeometry } from "./crystalGeometry";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  viewpoints,
  type WorldController,
  type WorldHooks,
  type WorldInput,
} from "./contract";
import {
  receiverVertex,
  receiverFragment,
  crystalFragment,
  beaconFragment,
  resonanceFragment,
  floorFragment,
  backdropFragment,
  particleFragment,
  particleVertex,
  worldVertex,
} from "./shaders";

type Disposable = { dispose: () => void };
export function requireHDR(
  context: Pick<WebGL2RenderingContext, "getExtension">,
) {
  if (
    !context.getExtension("EXT_color_buffer_float") &&
    !context.getExtension("EXT_color_buffer_half_float")
  ) {
    throw new Error(
      "This world requires HDR half-float render targets. Your browser's WebGL2 context does not support them. The workbench remains available.",
    );
  }
}
export function createWorld(
  canvas: HTMLCanvasElement,
  hooks: WorldHooks,
  failStartup = false,
  initial: WorldInput = { area: "week", emphasis: false, reducedMotion: false },
  makeRenderer = () =>
    new T.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    }),
): WorldController {
  const started = performance.now();
  const resources: Disposable[] = [];
  const own = <R extends Disposable>(resource: R): R => {
    resources.push(resource);
    return resource;
  };
  let renderer: T.WebGLRenderer | undefined;
  let disposed = false;
  let compiled = false;
  let input: WorldInput = initial;
  let observer: ResizeObserver | undefined;
  let pendingQuery: WebGLQuery | null = null;
  let gl: WebGL2RenderingContext | undefined;
  function dispose() {
    if (disposed) return;
    disposed = true;
    renderer?.setAnimationLoop(null);
    observer?.disconnect();
    window.removeEventListener("pointermove", pointerMoved);
    document.removeEventListener("visibilitychange", visibilityChanged);
    canvas.removeEventListener("webglcontextlost", contextLost);
    if (pendingQuery) gl?.deleteQuery(pendingQuery);
    for (const resource of resources.reverse()) resource.dispose();
    renderer?.dispose();
    renderer?.forceContextLoss();
  }
  function fail(error: unknown) {
    if (disposed) return;
    dispose();
    hooks.error(error instanceof Error ? error : new Error(String(error)));
  }
  function contextLost(event: Event) {
    event.preventDefault();
    fail(
      new Error(
        "The WebGL context was lost. The workbench is still available.",
      ),
    );
  }
  const pointer = new T.Vector2();
  function pointerMoved(event: PointerEvent) {
    if (!input.reducedMotion)
      pointer.set(
        (event.clientX / window.innerWidth) * 2 - 1,
        1 - (event.clientY / window.innerHeight) * 2,
      );
  }
  let renderFrame: () => void = () => {};
  let resumeClock = () => {};
  let paused = true;
  function visibilityChanged() {
    if (!compiled || disposed) return;
    const nextPaused = document.hidden || input.reducedMotion;
    if (paused && !nextPaused) {
      resumeClock();
    }
    paused = nextPaused;
    renderer!.setAnimationLoop(
      document.hidden || input.reducedMotion ? null : renderFrame,
    );
    if (!document.hidden) renderFrame();
  }
  try {
    renderer = makeRenderer();
    if (failStartup)
      throw new Error(
        "Injected renderer initialization failure. Retry to rebuild the world.",
      );
    const r = renderer;
    // Three r186 is WebGL2-only; the declarations retain a legacy union.
    gl = r.getContext() as WebGL2RenderingContext;
    requireHDR(gl);
    const sampleCounts = gl.getInternalformatParameter(
      gl.RENDERBUFFER,
      gl.RGBA16F,
      gl.SAMPLES,
    ) as Int32Array;
    if (!Array.from(sampleCounts).includes(4))
      throw new Error(
        "Lumimark optics requires 4× multisampled HDR targets. The workbench remains available.",
      );
    r.debug.onShaderError = (context, program) => {
      throw new Error(
        `World shader compilation failed: ${context.getProgramInfoLog(program) || "unknown error"}`,
      );
    };
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.info.autoReset = false;
    const scene = new T.Scene();
    scene.background = new T.Color("#06111d");
    const camera = new T.PerspectiveCamera(43, 1, 0.2, 140);
    const initialPose = viewpoints[initial.area];
    let orbitAngle: number = initialPose.angle;
    let orbitRadius: number = initialPose.radius * (initial.orbs ? 1.18 : 1);
    let orbitHeight: number = initialPose.height;
    let compositionOffset = initial.centered ? 0 : initial.orbs ? 3.8 : 7.6;
    const look = new T.Vector3();
    let lookHeight = initial.centered ? 8 : 6.1;
    const smoothPointer = new T.Vector2();
    const room = own(new RoomEnvironment());
    const pmrem = own(new T.PMREMGenerator(r));
    const environment = own(pmrem.fromScene(room, 0.04));
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.6;
    const hemisphere = new T.HemisphereLight("#b2e4ff", "#07131b", 1.2);
    scene.add(hemisphere);
    const movingLight = new T.PointLight("#c0efff", 320, 65, 1.6);
    movingLight.position.set(6, 8, 4);
    scene.add(movingLight);
    const rimLight = new T.PointLight("#bed8e3", 290, 60, 1.5);
    rimLight.position.set(-7, 12, -7);
    scene.add(rimLight);
    const time = { value: 0 };
    const tint = { value: new T.Color("#8cdeef") };
    const targetTint = new T.Color();
    const circuit = {
      uFlash: { value: 0 },
      uEvents: {
        value: Array.from({ length: 8 }, () => new T.Vector4(-100, 0, 0, 0)),
      },
      uEnergy: { value: 1 },
      uPhase: { value: 0 },
      uBeamWidth: { value: 0.55 },
    };
    const common = { uTime: time, uTint: tint, ...circuit };
    const sourceLight = new T.PointLight("#a7e9ff", 100, 30, 2);
    const pedestalLight = new T.PointLight("#b5ecff", 60, 22, 2);
    const crownLight = new T.PointLight("#b5ecff", 30, 25, 2);
    scene.add(sourceLight, pedestalLight, crownLight);

    const floorMaterial = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: floorFragment,
        uniforms: common,
      }),
    );
    const floor = new T.Mesh(own(new T.PlaneGeometry(100, 100)), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.32;
    scene.add(floor);
    const backdrop = new T.Mesh(
      own(new T.CylinderGeometry(31, 31, 46, 160, 1, true)),
      own(
        new T.ShaderMaterial({
          vertexShader: worldVertex,
          fragmentShader: backdropFragment,
          uniforms: common,
          side: T.BackSide,
        }),
      ),
    );
    backdrop.position.y = 13;
    scene.add(backdrop);
    const metal = own(
      new T.MeshStandardMaterial({
        color: "#6e878f",
        roughness: 0.23,
        metalness: 0.92,
      }),
    );
    const whiteLight = own(
      new T.MeshBasicMaterial({ color: new T.Color(0.9, 1.4, 1.8) }),
    );
    const receiver = own(
      new Reflector(own(new T.CircleGeometry(12, 192)), {
        textureWidth: 1536,
        textureHeight: 1536,
        multisample: 4,
        clipBias: 0.003,
        shader: {
          name: "Lumimark receiver",
          uniforms: {
            tDiffuse: { value: null },
            textureMatrix: { value: new T.Matrix4() },
            color: { value: new T.Color() },
          },
          vertexShader: receiverVertex,
          fragmentShader: receiverFragment,
        },
      }),
    );
    Object.assign((receiver.material as T.ShaderMaterial).uniforms, common);
    receiver.rotation.x = -Math.PI / 2;
    receiver.position.y = -0.285;
    scene.add(receiver);
    const receiverHousing = new T.Group();
    const platinum = own(
      new T.MeshStandardMaterial({
        color: "#6c8b96",
        metalness: 0.96,
        roughness: 0.24,
      }),
    );
    const ceramic = own(
      new T.MeshStandardMaterial({
        color: "#07131b",
        metalness: 0.65,
        roughness: 0.27,
      }),
    );
    for (const [radius, tube, y] of [
      [4.85, 0.14, -0.18],
      [5.1, 0.055, -0.22],
      [11.95, 0.09, -0.28],
    ]) {
      const lip = new T.Mesh(
        own(new T.TorusGeometry(radius, tube, 12, 256)),
        radius < 5 ? platinum : ceramic,
      );
      lip.rotation.x = Math.PI / 2;
      lip.position.y = y;
      receiverHousing.add(lip);
    }
    scene.add(receiverHousing);
    // Near-field light instruments provide high-contrast, real scene geometry
    // for refraction. Their bent images are visible through multiple facets.
    const resonance = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: resonanceFragment,
        uniforms: common,
      }),
    );
    const halos: T.Group[] = [];
    for (let i = 0; i < 3; i++) {
      const halo = new T.Group();
      const radius = 7.1 + i * 0.9;
      const rails = new T.Group();
      const arcGeometry = own(
        new T.TorusGeometry(radius, 0.085, 12, 80, Math.PI / 2 - 0.075),
      );
      const channelGeometry = own(
        new T.TorusGeometry(radius + 0.13, 0.028, 10, 80, Math.PI / 2 - 0.12),
      );
      const collarGeometry = own(new T.BoxGeometry(0.3, 0.5, 0.18));
      for (let j = 0; j < 4; j++) {
        const segment = new T.Mesh(arcGeometry, platinum);
        segment.rotation.z = (j * Math.PI) / 2 + 0.04;
        rails.add(segment);
        const channel = new T.Mesh(channelGeometry, resonance);
        channel.rotation.z = (j * Math.PI) / 2 + 0.06;
        rails.add(channel);
        const a = Math.PI / 2 - (j * Math.PI) / 2;
        const collar = new T.Mesh(collarGeometry, ceramic);
        collar.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
        collar.rotation.z = a;
        rails.add(collar);
        // Four readable quarter-day gates, with one to four small luminous pins.
        for (let pin = 0; pin <= j; pin++) {
          const marker = new T.Mesh(
            own(new T.BoxGeometry(0.065, 0.12, 0.22)),
            whiteLight,
          );
          marker.position.set(
            Math.cos(a) * (radius + 0.2) + Math.sin(a) * (pin - j / 2) * 0.12,
            Math.sin(a) * (radius + 0.2) - Math.cos(a) * (pin - j / 2) * 0.12,
            0.12,
          );
          marker.rotation.z = a;
          rails.add(marker);
        }
      }
      halo.add(rails);
      halo.position.set(0, 6.1 + i * 0.4, 0);
      halo.rotation.set(1.1 + i * 0.44, 0.15 + i * 0.9, 0.3);
      scene.add(halo);
      halos.push(halo);
    }
    const tickGeometry = own(new T.BoxGeometry(0.018, 0.12, 0.12));
    const latticeTicks: T.Mesh[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const tick = new T.Mesh(tickGeometry, i % 8 === 0 ? whiteLight : metal);
      tick.position.set(Math.sin(a) * 5.5, 0, Math.cos(a) * 5.5);
      tick.rotation.y = a;
      scene.add(tick);
      latticeTicks.push(tick);
    }
    for (const radius of [4.7, 5.7, 10.5]) {
      const ring = new T.Mesh(
        own(new T.TorusGeometry(radius, 0.012, 8, 192)),
        resonance,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.15;
      scene.add(ring);
    }
    const cubeTarget = own(
      new T.WebGLCubeRenderTarget(1024, {
        type: T.HalfFloatType,
        generateMipmaps: true,
        minFilter: T.LinearMipmapLinearFilter,
        magFilter: T.LinearFilter,
      }),
    );
    const probe = new T.CubeCamera(0.1, 100, cubeTarget);
    probe.position.set(0, 6, 0);
    const crystalGroup = new T.Group();
    scene.add(crystalGroup);
    const { geometry, planes } = makeCrystalGeometry();
    own(geometry);
    const glass = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: crystalFragment,
        defines: { PLANE_COUNT: planes.length },
        uniforms: {
          uEnvironment: {
            value: cubeTarget.texture,
          },
          uPlanes: { value: planes },
          uWorldMatrix: { value: new T.Matrix4() },
          uInverseWorld: { value: new T.Matrix4() },
          ...common,
          uTint: tint,
          uLight: { value: movingLight.position },
          uEmphasis: { value: 0 },
        },
        side: T.FrontSide,
      }),
    );
    const gem = new T.Mesh(geometry, glass);
    crystalGroup.add(gem);
    const random = (i: number) => {
      const n = Math.sin(i * 127.1 + 17.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const particleGeometry = own(new T.BufferGeometry());
    const positions = new Float32Array(1600 * 3),
      seeds = new Float32Array(1600);
    for (let i = 0; i < 1600; i++) {
      positions[i * 3] = (random(i + 1) - 0.5) * 34;
      positions[i * 3 + 1] = random(i + 3000) * 16;
      positions[i * 3 + 2] = (random(i + 6000) - 0.5) * 34;
      seeds[i] = random(i + 9000);
    }
    particleGeometry.setAttribute(
      "position",
      new T.BufferAttribute(positions, 3),
    );
    particleGeometry.setAttribute("aSeed", new T.BufferAttribute(seeds, 1));
    const dust = new T.Points(
      particleGeometry,
      own(
        new T.ShaderMaterial({
          vertexShader: particleVertex,
          fragmentShader: particleFragment,
          uniforms: { ...common, uPixelRatio: { value: r.getPixelRatio() } },
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      ),
    );
    dust.frustumCulled = false;
    scene.add(dust);
    const beamMaterial = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: beaconFragment,
        uniforms: { ...common, uInverseBeam: { value: new T.Matrix4() } },
        transparent: true,
        depthWrite: false,
        side: T.BackSide,
        premultipliedAlpha: true,
      }),
    );
    const beam = new T.Mesh(
      own(new T.CylinderGeometry(3.6, 3.6, 28, 64, 1, false)),
      beamMaterial,
    );
    beam.frustumCulled = false;
    const beamAxis = new T.Vector3(),
      beamOrigin = new T.Vector3();
    const up = new T.Vector3(0, 1, 0);
    scene.add(beam);
    const hdrTarget = new T.WebGLRenderTarget(1, 1, {
      type: T.HalfFloatType,
      samples: 4,
    });
    const composer = own(new EffectComposer(r, hdrTarget));
    const renderPass = own(new RenderPass(scene, camera));
    composer.addPass(renderPass);
    const bloom = own(
      new UnrealBloomPass(new T.Vector2(1, 1), 0.18, 0.35, 1.6),
    );
    composer.addPass(bloom);
    const output = own(new OutputPass());
    composer.addPass(output);
    let width = 1,
      height = 1;
    function resize() {
      if (disposed) return;
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      r.setSize(width, height, false);
      composer.setSize(width, height);
      for (const target of [
        composer.renderTarget1,
        composer.renderTarget2,
        receiver.getRenderTarget(),
      ]) {
        r.setRenderTarget(target);
        if (
          gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) !==
          gl!.FRAMEBUFFER_COMPLETE
        )
          throw new Error(
            "Multisampled HDR framebuffer allocation failed. The workbench remains available.",
          );
      }
      r.setRenderTarget(null);
      // Validate all six probe attachments too; capability flags alone do not
      // establish that allocations succeeded on this GPU.
      for (const target of [cubeTarget])
        for (let face = 0; face < 6; face++) {
          r.setRenderTarget(target, face);
          if (
            gl!.checkFramebufferStatus(gl!.FRAMEBUFFER) !==
            gl!.FRAMEBUFFER_COMPLETE
          )
            throw new Error(
              "HDR cube probe allocation failed. The workbench remains available.",
            );
        }
      r.setRenderTarget(null);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (compiled && input.reducedMotion) renderFrame();
    }
    observer = new ResizeObserver(() => {
      try {
        resize();
      } catch (error) {
        fail(error);
      }
    });
    observer.observe(canvas);
    resize();
    canvas.addEventListener("webglcontextlost", contextLost);
    window.addEventListener("pointermove", pointerMoved, { passive: true });
    document.addEventListener("visibilitychange", visibilityChanged);

    const timer = gl.getExtension("EXT_disjoint_timer_query_webgl2") as {
      TIME_ELAPSED_EXT: number;
      GPU_DISJOINT_EXT: number;
    } | null;
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const gpu = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
    let gpuMs: number | null = null;
    let last = performance.now(),
      sampleStart = last,
      elapsed = 0,
      frames = 0,
      startupMs = 0,
      worstFrame = 0;
    const lightEvents = createLightEvents(initial);
    const orbLayer = own(
      createOrbLayer(
        scene,
        initial,
        hooks,
        (kind, strength, time) =>
          lightEvents.pulse(kind, strength, time, input.reducedMotion),
        latticeTicks,
      ),
    );
    let railPhase = 0,
      constellation = "";
    let selectionAngle: number | null = null;
    let frameTimes: number[] = [],
      submitTimes: number[] = [];
    resumeClock = () => {
      last = performance.now();
      sampleStart = last;
      frameTimes = [];
      submitTimes = [];
    };
    renderFrame = () => {
      if (disposed || !compiled) return;
      let queryStarted = false;
      try {
        const begin = performance.now(),
          rawDelta = (begin - last) / 1000,
          delta = Math.min(rawDelta, 0.1);
        last = begin;
        if (!input.reducedMotion) {
          elapsed += delta;
          frameTimes.push(rawDelta * 1000);
          worstFrame = Math.max(worstFrame, rawDelta * 1000);
        }
        time.value = elapsed;
        const pose = viewpoints[input.area];
        const ease = input.reducedMotion ? 1 : 1 - Math.exp(-delta * 1.25);
        const aimAngle = selectionAngle ?? pose.angle;
        const turn = Math.atan2(
          Math.sin(aimAngle - orbitAngle),
          Math.cos(aimAngle - orbitAngle),
        );
        orbitAngle += turn * ease;
        orbitRadius +=
          (pose.radius * (input.centered ? 1.22 : input.orbs ? 1.18 : 1) -
            orbitRadius) *
          ease;
        lookHeight += ((input.centered ? 8 : 6.1) - lookHeight) * ease;
        orbitHeight += (pose.height - orbitHeight) * ease;
        // A narrow viewport gets the centered sculpture; the HTML then stacks.
        const offset =
          input.centered || input.selectedOrb || width < 1000
            ? 0
            : input.orbs
              ? 3.8
              : 7.6;
        compositionOffset += (offset - compositionOffset) * ease;
        if (input.reducedMotion) smoothPointer.set(0, 0);
        else smoothPointer.lerp(pointer, 1 - Math.exp(-delta * 2));
        const angle =
          orbitAngle +
          (input.orbit || 0) +
          (input.reducedMotion
            ? 0
            : smoothPointer.x * 0.035 + Math.sin(elapsed * 0.12) * 0.012);
        camera.position.set(
          Math.sin(angle) * orbitRadius,
          orbitHeight + (input.elevation || 0) + smoothPointer.y * 0.35,
          Math.cos(angle) * orbitRadius,
        );
        look.set(
          -Math.cos(angle) * compositionOffset,
          lookHeight,
          Math.sin(angle) * compositionOffset,
        );
        camera.lookAt(look);
        camera.updateMatrixWorld();
        movingLight.position.set(
          6 + smoothPointer.x * 7 + Math.sin(time.value * 0.3) * 4,
          9 + smoothPointer.y * 3,
          5 + Math.cos(time.value * 0.22) * 4,
        );
        targetTint.set(
          input.area === "planning"
            ? "#c4afff"
            : input.area === "assignments"
              ? "#96efd9"
              : "#8cdeef",
        );
        tint.value.lerp(targetTint, input.reducedMotion ? 1 : ease);
        const drive = lumenDrive(input, elapsed, smoothPointer.length());
        if (!input.reducedMotion)
          railPhase += delta * (input.selectedOrb?.length ? 0.08 : 1);
        const response = lightEvents.sample(elapsed);
        circuit.uFlash.value = response.flash;
        circuit.uEvents.value.forEach((value, i) => {
          const event = response.events[i];
          value.set(event?.time ?? -100, event?.strength ?? 0, 0, 0);
        });
        circuit.uEnergy.value = drive.energy;
        circuit.uPhase.value = drive.phase;
        circuit.uBeamWidth.value = drive.width;
        gem.position.set(0, 6.2 + Math.sin(elapsed * 0.38) * 0.08, 0);
        gem.rotation.set(
          Math.sin(elapsed * 0.17) * 0.012,
          0.22 + Math.sin(elapsed * 0.09) * 0.04,
          0.02,
        );
        gem.updateMatrixWorld(true);
        glass.uniforms.uWorldMatrix.value.copy(gem.matrixWorld);
        glass.uniforms.uInverseWorld.value.copy(gem.matrixWorld).invert();
        glass.uniforms.uEmphasis.value = input.emphasis ? 1 : 0;
        beamOrigin.set(0, 6.3, 0).applyMatrix4(gem.matrixWorld);
        beamAxis.copy(up).transformDirection(gem.matrixWorld);
        beam.position.copy(beamOrigin).addScaledVector(beamAxis, 14);
        beam.quaternion.setFromUnitVectors(up, beamAxis);
        beam.updateMatrixWorld(true);
        beamMaterial.uniforms.uInverseBeam.value
          .copy(beam.matrixWorld)
          .invert();
        beam.visible = drive.beacon;
        sourceLight.position.copy(gem.position);
        pedestalLight.position.set(0, 2.4, 0);
        crownLight.position.copy(beamOrigin).addScaledVector(beamAxis, 2);
        for (const light of [sourceLight, pedestalLight, crownLight]) {
          light.color.copy(tint.value);
        }
        sourceLight.intensity = 80 * drive.energy * (1 + response.flash * 0.4);
        pedestalLight.intensity = 35 * drive.energy;
        crownLight.intensity = 24 * drive.energy;
        movingLight.intensity = 90 + drive.energy * 35;
        whiteLight.color
          .copy(tint.value)
          .multiplyScalar(0.4 + drive.energy * 0.55);
        halos.forEach((halo, i) => {
          if (input.orbs) {
            // Inner/low = past dates; middle = today; outer/high = future dates.
            halo.scale.setScalar(0.82);
            halo.position.set(
              0,
              4.7 + i * 1.1 + Math.sin(drive.phase) * 0.04,
              0,
            );
            halo.rotation.set(
              Math.PI / 2 + [-0.16, 0.08, 0.28][i],
              0,
              railPhase * 0.025,
            );
          } else if (i === 2) {
            halo.scale.setScalar(0.32);
            halo.position.copy(beamOrigin).addScaledVector(beamAxis, 0.2);
            halo.quaternion.setFromUnitVectors(
              new T.Vector3(0, 0, 1),
              beamAxis,
            );
            halo.rotateZ(drive.phase * 0.12);
          } else {
            halo.scale.setScalar(i === 0 ? 0.88 : 0.85);
            halo.position.set(
              0,
              gem.position.y +
                (i === 0 ? -0.4 : 0.5) +
                Math.sin(drive.phase) * 0.06,
              0,
            );
            halo.rotation.set(
              Math.PI / 2 + (i === 0 ? -0.12 : 0.33),
              0,
              (input.orbs ? railPhase : drive.phase) *
                (i === 0 ? 0.045 : -0.035),
            );
          }
        });
        constellation = orbLayer.render(elapsed, halos, camera);
        const routedEnergy = orbLayer.energy();
        circuit.uFlash.value = Math.min(
          1.5,
          response.flash + routedEnergy * 0.65,
        );
        pedestalLight.intensity = 35 * drive.energy * (1 + routedEnergy * 1.2);
        sourceLight.intensity *= 1 + routedEnergy * 0.45;
        if (
          timer &&
          pendingQuery &&
          gl!.getQueryParameter(pendingQuery, gl!.QUERY_RESULT_AVAILABLE)
        ) {
          if (!gl!.getParameter(timer.GPU_DISJOINT_EXT))
            gpuMs = gl!.getQueryParameter(pendingQuery, gl!.QUERY_RESULT) / 1e6;
          gl!.deleteQuery(pendingQuery);
          pendingQuery = null;
        }
        if (timer && !pendingQuery && frames % 45 === 0) {
          pendingQuery = gl!.createQuery();
          if (pendingQuery) {
            gl!.beginQuery(timer.TIME_ELAPSED_EXT, pendingQuery);
            queryStarted = true;
          }
        }
        r.info.reset();
        crystalGroup.visible = false;
        // Capture all six faces every frame. Exclude the refractor to prevent
        // texture feedback; its reflection/refraction samples this live probe.
        // Prevent recursive planar captures and texture feedback in the six-face probe.
        receiver.visible = false;
        probe.update(r, scene);
        receiver.visible = true;

        crystalGroup.visible = true;
        r.setRenderTarget(null);
        composer.render(delta);
        if (queryStarted) {
          gl!.endQuery(timer!.TIME_ELAPSED_EXT);
          queryStarted = false;
        }
        frames++;
        if (!startupMs) startupMs = performance.now() - started;
        submitTimes.push(performance.now() - begin);
        if (begin - sampleStart > 1500 || frames === 1 || input.reducedMotion) {
          const sorted = frameTimes.slice().sort((a, b) => a - b),
            n = frameTimes.length;
          const size = r.getDrawingBufferSize(new T.Vector2());
          hooks.metrics({
            startupMs,
            fps:
              input.reducedMotion || begin - sampleStart < 500
                ? 0
                : n / Math.max(0.001, (begin - sampleStart) / 1000),
            frameP95: sorted[Math.min(n - 1, Math.floor(n * 0.95))] || 0,
            worstFrame,
            submitMs:
              submitTimes.reduce((a, b) => a + b, 0) / submitTimes.length,
            gpuMs,
            calls: r.info.render.calls,
            triangles: r.info.render.triangles,
            geometries: r.info.memory.geometries,
            textures: r.info.memory.textures,
            programs: r.info.programs?.length || 0,
            width: size.x,
            height: size.y,
            bufferEstimateMB:
              (size.x * size.y * 8 * (2.917 + 8) +
                (6 * 1024 * 1024 * 8 * 4) / 3 +
                1536 * 1536 * 8 * 5) /
              1048576,
            gpu,
            frames,
            elapsed,
            camera: camera.position
              .toArray()
              .map((v) => v.toFixed(2))
              .join(", "),
            motion: input.reducedMotion ? "Reduced — static" : "Live",
            response: `${response.count} events · ${response.reason} · ${response.events.length} active`,
            constellation,
          });
          frameTimes = [];
          submitTimes = [];
          sampleStart = begin;
        }
      } catch (error) {
        if (queryStarted) gl!.endQuery(timer!.TIME_ELAPSED_EXT);
        fail(error);
      }
    };
    void r
      .compileAsync(scene, camera)
      .then(() => {
        if (disposed) return;
        compiled = true;
        last = performance.now();
        sampleStart = last;
        visibilityChanged();
      })
      .catch(fail);
    return {
      update(next) {
        if (disposed) return;
        if (next.selectedOrb !== input.selectedOrb) {
          const focus = next.selectedOrb
            ? orbLayer.positionOf(next.selectedOrb)
            : undefined;
          selectionAngle = focus ? Math.atan2(focus.x, focus.z) + 0.65 : null;
        }
        lightEvents.update(next, elapsed);
        orbLayer.update(next, elapsed);
        input = next;
        if (compiled) visibilityChanged();
      },
      dispose,
      loseContext() {
        r.forceContextLoss();
      },
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
