import { lumenDrive } from "./lumenDrive";
import type { WorldInput } from "./contract";
export type LightEvent = { time: number; strength: number; reason: string };
// Eight bounded, non-repeating wavefronts. This boundary sees presentation state only.
export function createLightEvents(initial: WorldInput) {
  let previous = { ...initial };
  let anchor = lumenDrive(initial, 0);
  let events: LightEvent[] = [];
  let count = 0;
  let reason = "Idle · no interaction wave";
  return {
    update(next: WorldInput, time: number) {
      const drive = lumenDrive(next, 0);
      const powerDelta = Math.abs(
        drive.energy - lumenDrive(previous, 0).energy,
      );
      const changedArea = next.area !== previous.area;
      const changedBeam = drive.beacon !== anchor.beacon;
      const energyChange = Math.abs(drive.energy - anchor.energy);
      const focusChange = Math.abs(drive.width - anchor.width);
      const cause = changedArea
        ? "Navigation"
        : changedBeam
          ? "Beacon"
          : energyChange >= 0.075
            ? "Energy"
            : focusChange >= 0.099
              ? "Focus"
              : next.emphasis && !previous.emphasis
                ? "Preview"
                : "";
      const wasQuiet = previous.reducedMotion;
      const quiet = next.reducedMotion;
      // No frozen events may resume as delayed animation.
      if (quiet || wasQuiet) {
        events = [];
        anchor = drive;
      } else if (cause && Number.isFinite(time)) {
        events = [
          ...events.filter((e) => time - e.time < 5),
          {
            time,
            strength: changedArea
              ? 0.95
              : changedBeam
                ? 0.85
                : Math.min(
                    1,
                    0.45 + Math.max(energyChange, focusChange, powerDelta),
                  ),
            reason: cause,
          },
        ].slice(-8);
        count++;
        reason = cause;
        anchor = drive;
      }
      previous = { ...next };
    },
    sample(time: number) {
      events = events.filter((e) => time >= e.time && time - e.time < 5);
      const flash = events.reduce(
        (sum, e) => sum + e.strength * Math.exp(-(time - e.time) * 2.4),
        0,
      );
      return { events, flash: Math.min(flash, 1.5), count, reason };
    },
  };
}
