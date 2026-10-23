// Presentation-only boundary. No academic data, persistence or inference enters the world.
export type WorldArea = "week" | "assignments" | "planning";
export type WorldInput = {
  area: WorldArea;
  emphasis: boolean;
  reducedMotion: boolean;
  refraction?: boolean;
  centered?: boolean;
  design?: "original" | "lumen" | "vesper";
  comparison?: boolean;
  dispersion?: number;
  orbit?: number;
  elevation?: number;
  refined?: boolean;
  living?: boolean;
  beacon?: boolean;
  power?: number;
  beamWidth?: number;
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
  response?: string;
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

// Unwrapped polar angles travel along the outside of the crystal, never through
// its solid interior as a Cartesian camera lerp between opposite sides would.
export const viewpoints = {
  week: {
    angle: 0.35,
    radius: 22.5,
    height: 7.5,
    label: "01 / MERIDIAN",
    description: "The week, held in light.",
  },
  assignments: {
    angle: 2.35,
    radius: 21,
    height: 8.7,
    label: "02 / ARCHIVE",
    description: "Ideas, taking shape.",
  },
  planning: {
    angle: 4.4,
    radius: 19.7,
    height: 6.6,
    label: "03 / POSSIBLE",
    description: "Room for what comes next.",
  },
} as const;

export function comparisonOffset(
  index: number,
  angle: number,
): [number, number] {
  const distance = (index - 1) * 7;
  return [Math.cos(angle) * distance, -Math.sin(angle) * distance];
}
