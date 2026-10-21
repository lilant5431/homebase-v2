import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import {
  viewpoints,
  type WorldController,
  type WorldHooks,
  type WorldInput,
} from "./contract";
import {
  crystalFragment,
  floorFragment,
  hazeFragment,
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
    r.debug.onShaderError = (context, program) => {
      throw new Error(
        `World shader compilation failed: ${context.getProgramInfoLog(program) || "unknown error"}`,
      );
    };
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.toneMapping = T.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.12;
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    r.info.autoReset = false;
    const scene = new T.Scene();
    scene.background = new T.Color("#344c5b");
    scene.fog = new T.FogExp2("#526d78", 0.0105);
    const camera = new T.PerspectiveCamera(48, 1, 0.2, 220);
    camera.position.fromArray(viewpoints.week.eye);
    const look = new T.Vector3().fromArray(viewpoints.week.look);
    const eyeTarget = new T.Vector3(),
      lookTarget = new T.Vector3();
    const smoothPointer = new T.Vector2();
    camera.lookAt(look);

    const room = own(new RoomEnvironment());
    const pmrem = own(new T.PMREMGenerator(r));
    const environment = own(pmrem.fromScene(room, 0.05));
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.45;
    scene.add(new T.HemisphereLight("#c5e6ff", "#5a482e", 1.4));
    const sun = new T.DirectionalLight("#ffe1a2", 2.5);
    sun.position.set(-18, 30, -28);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -35,
      right: 35,
      top: 35,
      bottom: -35,
      far: 130,
    });
    sun.shadow.bias = -0.0005;
    scene.add(sun);
    resources.push(sun.shadow);
    const movingLight = new T.PointLight("#c0efff", 220, 65, 1.6);
    movingLight.position.set(6, 8, 4);
    scene.add(movingLight);
    const farLight = new T.PointLight("#ffd48a", 360, 80, 1.5);
    farLight.position.set(0, 10, -44);
    scene.add(farLight);

    const architecture = new T.Group();
    scene.add(architecture);
    const stone = own(
      new T.MeshStandardMaterial({
        color: "#929384",
        roughness: 0.64,
        metalness: 0.12,
      }),
    );
    const darkStone = own(
      new T.MeshStandardMaterial({
        color: "#353f3c",
        roughness: 0.43,
        metalness: 0.26,
      }),
    );
    const paleStone = own(
      new T.MeshStandardMaterial({
        color: "#bab398",
        roughness: 0.55,
        metalness: 0.16,
      }),
    );
    const gold = own(
      new T.MeshStandardMaterial({
        color: "#bda270",
        roughness: 0.25,
        metalness: 0.86,
      }),
    );
    const glow = own(
      new T.MeshStandardMaterial({
        color: "#d8edec",
        emissive: "#bfe7e9",
        emissiveIntensity: 2.1,
        roughness: 0.24,
      }),
    );
    const box = own(new T.BoxGeometry(1, 1, 1));
    const column = own(new T.CylinderGeometry(0.62, 0.83, 10, 24, 1));
    const torus = own(new T.TorusGeometry(0.9, 0.095, 8, 32));
    const arch = own(new T.TorusGeometry(12, 0.55, 12, 72, Math.PI));
    const rib = own(new T.CylinderGeometry(0.048, 0.048, 9.7, 6));
    function block(
      material: T.Material,
      x: number,
      y: number,
      z: number,
      sx: number,
      sy: number,
      sz: number,
    ) {
      const mesh = new T.Mesh(box, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = mesh.receiveShadow = true;
      architecture.add(mesh);
      return mesh;
    }
    // Twelve layered bays, fluted pillars, capitals, coffered vaults and metal inlays.
    for (let bay = 0; bay < 12; bay++) {
      const z = -bay * 10 - 3;
      const archMesh = new T.Mesh(arch, paleStone);
      archMesh.position.set(0, 10, z);
      architecture.add(archMesh);
      const inset = new T.Mesh(arch, gold);
      inset.position.set(0, 10, z + 0.62);
      inset.scale.set(0.976, 0.976, 0.15);
      architecture.add(inset);
      for (const side of [-1, 1]) {
        const x = side * 12;
        const pillar = new T.Mesh(column, stone);
        pillar.position.set(x, 5, z);
        pillar.castShadow = pillar.receiveShadow = true;
        architecture.add(pillar);
        block(darkStone, x, 0.28, z, 2.5, 0.55, 2.5);
        block(paleStone, x, 0.65, z, 2.1, 0.25, 2.1);
        block(paleStone, x, 10.1, z, 2.5, 0.45, 2.5);
        block(gold, x, 9.76, z, 1.9, 0.12, 1.9);
        for (let flute = 0; flute < 12; flute++) {
          const angle = (flute / 12) * Math.PI * 2;
          const edge = new T.Mesh(rib, gold);
          edge.position.set(
            x + Math.cos(angle) * 0.7,
            5,
            z + Math.sin(angle) * 0.7,
          );
          architecture.add(edge);
        }
        for (const height of [1.1, 9.3]) {
          const ring = new T.Mesh(torus, gold);
          ring.rotation.x = Math.PI / 2;
          ring.position.set(x, height, z);
          architecture.add(ring);
        }
        block(darkStone, side * 15, 6, z - 4, 1.2, 12, 7.8);
        block(gold, side * 14.33, 6, z - 4, 0.08, 9.5, 6.5);
        block(darkStone, side * 14.2, 6, z - 4, 0.12, 9.1, 6.2);
        for (let line = 0; line < 5; line++)
          block(gold, side * 14.05, 2.3 + line * 1.7, z - 4, 0.07, 0.045, 6.1);
      }
      block(gold, 0, 19.9, z, 17, 0.12, 0.2);
      for (let coffer = 0; coffer < 5; coffer++)
        block(darkStone, -8 + coffer * 4, 20.1, z - 4, 3.5, 0.28, 6.5);
      block(glow, 0, 0.02, z - 4, 0.055, 0.025, 9.3);
      block(gold, -8, 0.015, z - 4, 0.06, 0.02, 9.3);
      block(gold, 8, 0.015, z - 4, 0.06, 0.02, 9.3);
    }
    const time = { value: 0 };
    const floorMaterial = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: floorFragment,
        uniforms: { uTime: time },
      }),
    );
    const floor = new T.Mesh(own(new T.PlaneGeometry(180, 220)), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.04, -60);
    scene.add(floor);
    // Far portal gives an unambiguous vanishing point and a scale reference.
    block(darkStone, 0, 8, -119, 27, 16, 2);
    block(glow, 0, 8, -117.8, 7, 12, 0.1);
    for (let step = 0; step < 7; step++)
      block(
        paleStone,
        0,
        0.14 + step * 0.22,
        -42 - step * 0.8,
        9 - step * 0.6,
        0.28,
        0.8,
      );
    const portal = new T.Mesh(
      own(new T.TorusGeometry(4.2, 0.1, 12, 100)),
      glow,
    );
    portal.position.set(0, 5.8, -48);
    scene.add(portal);

    const sceneTarget = own(
      new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType }),
    );
    const glass = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: crystalFragment,
        uniforms: {
          uScene: { value: sceneTarget.texture },
          uResolution: { value: new T.Vector2(1, 1) },
          uTime: time,
          uEmphasis: { value: 0 },
          uLight: { value: movingLight.position },
        },
        side: T.DoubleSide,
      }),
    );
    const crystalGroup = new T.Group();
    scene.add(crystalGroup);
    const crystalGeometry = own(new T.DodecahedronGeometry(2.6, 0));
    const edgeGeometry = own(new T.EdgesGeometry(crystalGeometry));
    const edgeMaterial = own(
      new T.LineBasicMaterial({
        color: "#d7f4ff",
        transparent: true,
        opacity: 0.46,
        blending: T.AdditiveBlending,
      }),
    );
    const crystals: T.Group[] = [];
    for (const [x, y, z, scale] of [
      [6, 9, 4, 1],
      [-6.4, 4.1, -11, 0.58],
      [1.5, 6.8, -25, 0.8],
      [8, 3, -36, 0.4],
    ]) {
      const group = new T.Group();
      group.position.set(x, y, z);
      group.scale.set(scale, scale * 1.5, scale);
      const solid = new T.Mesh(crystalGeometry, glass);
      group.add(solid, new T.LineSegments(edgeGeometry, edgeMaterial));
      group.rotation.set(0.2, 0.4, 0.18);
      group.userData.baseY = y;
      crystalGroup.add(group);
      crystals.push(group);
    }
    const random = (i: number) => {
      const n = Math.sin(i * 127.1 + 17.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const particleGeometry = own(new T.BufferGeometry());
    const positions = new Float32Array(2200 * 3),
      seeds = new Float32Array(2200);
    for (let i = 0; i < 2200; i++) {
      positions[i * 3] = (random(i + 1) - 0.5) * 35;
      positions[i * 3 + 1] = random(i + 3000) * 16;
      positions[i * 3 + 2] = 8 - random(i + 6000) * 120;
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
          uniforms: { uTime: time, uPixelRatio: { value: r.getPixelRatio() } },
          transparent: true,
          depthWrite: false,
          blending: T.AdditiveBlending,
        }),
      ),
    );
    dust.frustumCulled = false;
    scene.add(dust);
    const hazeMaterial = own(
      new T.ShaderMaterial({
        vertexShader: worldVertex,
        fragmentShader: hazeFragment,
        uniforms: { uTime: time },
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
      }),
    );
    const hazeGeometry = own(new T.ConeGeometry(5.5, 24, 48, 1, true));
    for (let i = 0; i < 5; i++) {
      const beam = new T.Mesh(hazeGeometry, hazeMaterial);
      beam.position.set(-3, 9, -i * 22 - 4);
      beam.rotation.z = -0.4;
      scene.add(beam);
    }

    const composer = own(new EffectComposer(r));
    const renderPass = own(new RenderPass(scene, camera));
    composer.addPass(renderPass);
    const bloom = own(new UnrealBloomPass(new T.Vector2(1, 1), 0.55, 0.6, 1.0));
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
      const size = r.getDrawingBufferSize(new T.Vector2());
      sceneTarget.setSize(size.x, size.y);
      r.setRenderTarget(sceneTarget);
      const framebufferStatus = gl!.checkFramebufferStatus(gl!.FRAMEBUFFER);
      r.setRenderTarget(null);
      if (framebufferStatus !== gl!.FRAMEBUFFER_COMPLETE)
        throw new Error(
          "HDR framebuffer allocation failed. The workbench remains available.",
        );
      glass.uniforms.uResolution.value.copy(size);
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
        eyeTarget.fromArray(pose.eye);
        lookTarget.fromArray(pose.look);
        smoothPointer.lerp(pointer, 1 - Math.exp(-delta * 2));
        if (!input.reducedMotion) {
          eyeTarget.x +=
            smoothPointer.x * 1.3 + Math.sin(elapsed * 0.13) * 0.28;
          eyeTarget.y +=
            smoothPointer.y * 0.65 + Math.sin(elapsed * 0.19) * 0.13;
        }
        camera.position.lerp(
          eyeTarget,
          input.reducedMotion ? 1 : 1 - Math.exp(-delta * 0.85),
        );
        look.lerp(
          lookTarget,
          input.reducedMotion ? 1 : 1 - Math.exp(-delta * 0.85),
        );
        camera.lookAt(look);
        movingLight.position.set(
          5 + smoothPointer.x * 8 + Math.sin(time.value * 0.3) * 5,
          8 + smoothPointer.y * 3,
          3 + Math.cos(time.value * 0.22) * 4,
        );
        movingLight.color.set(
          input.area === "planning"
            ? "#c6b5ff"
            : input.area === "assignments"
              ? "#a5e9ed"
              : "#e2eaff",
        );
        glass.uniforms.uEmphasis.value = input.emphasis ? 1 : 0;
        crystals.forEach((crystal, i) => {
          crystal.position.y =
            crystal.userData.baseY + Math.sin(time.value * 0.4 + i) * 0.24;
          crystal.rotation.y = 0.4 + time.value * 0.035 + i * 0.6;
          crystal.rotation.z = 0.18 + Math.sin(time.value * 0.17 + i) * 0.06;
        });
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
        r.setRenderTarget(sceneTarget);
        r.render(scene, camera);
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
            bufferEstimateMB: (size.x * size.y * 8 * 3.917) / 1048576,
            gpu,
            frames,
            elapsed,
            camera: camera.position
              .toArray()
              .map((v) => v.toFixed(2))
              .join(", "),
            motion: input.reducedMotion ? "Reduced — static" : "Live",
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
