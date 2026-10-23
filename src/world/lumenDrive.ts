import type { WorldInput } from "./contract";
// Presentation-only light circuit. One bounded source feeds every material/light.
export function lumenDrive(input: WorldInput, time: number, pointer = 0) {
  const clamp = (
    v: number | undefined,
    fallback: number,
    lo: number,
    hi: number,
  ) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v! : fallback));
  const living = input.living !== false;
  const phase = Number.isFinite(time) ? time * 0.7 : 0;
  const power = clamp(input.power, 1, 0.3, 1.8);
  const beacon = living && input.beacon !== false;
  const energy =
    power * (0.91 + 0.09 * Math.sin(phase)) * (beacon ? 1 : 0.65) +
    (input.emphasis ? 0.14 : 0) +
    clamp(pointer, 0, 0, 1.5) * 0.035;
  return {
    living: living ? 1 : 0,
    energy,
    width: clamp(input.beamWidth, 0.55, 0.25, 1.1),
    phase,
    beacon,
  };
}
