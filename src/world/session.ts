import type {
  WorldController,
  WorldFactory,
  WorldHooks,
  WorldInput,
} from "./contract";

// A late module load or stale callback cannot resurrect an abandoned WebGL scene.
export function startWorldSession(
  canvas: HTMLCanvasElement,
  hooks: WorldHooks,
  load: () => Promise<{ createWorld: WorldFactory }>,
  failStartup = false,
  initial: WorldInput = { area: "week", emphasis: false, reducedMotion: false },
) {
  let closed = false;
  let controller: WorldController | undefined;
  let input = initial;
  const guarded: WorldHooks = {
    projectOrbs: (value) => {
      if (!closed) hooks.projectOrbs?.(value);
    },
    metrics: (value) => {
      if (!closed) hooks.metrics(value);
    },
    error: (error) => {
      if (!closed) hooks.error(error);
    },
  };
  const ready = Promise.resolve()
    .then(load)
    .then((module) => {
      if (!closed)
        controller = module.createWorld(canvas, guarded, failStartup, input);
    })
    .catch((error) => {
      if (!closed)
        hooks.error(error instanceof Error ? error : new Error(String(error)));
    });
  return {
    ready,
    update: (next: WorldInput) => {
      input = next;
      controller?.update(next);
    },
    loseContext: () => controller?.loseContext(),
    dispose: () => {
      closed = true;
      controller?.dispose();
      controller = undefined;
    },
  };
}
