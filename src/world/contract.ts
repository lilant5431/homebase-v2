// Presentation-only boundary. No academic data, persistence or inference enters the world.
export type WorldArea = "week" | "assignments" | "planning";
export type WorldInput = {
  area: WorldArea;
  emphasis: boolean;
  reducedMotion: boolean;
};
export type WorldMetrics = {
  startupMs: number;
  fps: number;
  frameP95: number;
  worstFrame: number;
  submitMs: number;
  gpuMs: number | null;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  width: number;
  height: number;
  bufferEstimateMB: number;
  gpu: string;
  frames: number;
  elapsed: number;
  camera: string;
  motion: string;
};
export type WorldHooks = {
  metrics: (value: WorldMetrics) => void;
  error: (error: Error) => void;
};
export type WorldController = {
  update: (input: WorldInput) => void;
  dispose: () => void;
  loseContext: () => void;
};
export type WorldFactory = (
  canvas: HTMLCanvasElement,
  hooks: WorldHooks,
  failStartup?: boolean,
  initial?: WorldInput,
) => WorldController;

export const viewpoints = {
  week: { eye: [17, 8, 27], look: [1, 5, -15] },
  assignments: { eye: [-12, 6.5, 18], look: [2, 5, -15] },
  planning: { eye: [4, 6, 9], look: [0, 5, -22] },
} as const;
