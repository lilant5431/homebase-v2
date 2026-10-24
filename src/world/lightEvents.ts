import { lumenDrive } from "./lumenDrive";
import type { WorldInput } from "./contract";
export type LightEvent = { time: number; strength: number; reason: string };
// Four bounded, non-repeating wavefronts; rapid inputs share one wavefront.
export function createLightEvents(initial: WorldInput) {
  let previous = { ...initial };
  let anchor = lumenDrive(initial, 0);
  let events: LightEvent[] = [];
  let count = 0;
  let reason = "Idle · no interaction wave";
  function emit(event: LightEvent) {
    events = events.filter((e) => event.time - e.time < 5);
    const last = events.at(-1);
    if (last && event.time - last.time >= 0 && event.time - last.time < 0.22) {
      events[events.length - 1] = {
        ...last,
        strength: Math.max(last.strength, event.strength),
        reason: event.reason,
      };
    } else events = [...events, event].slice(-4);
  }
  return {
    pulse(cause: string, strength: number, time: number, quiet = false) {
      if (quiet || !Number.isFinite(time)) return;
      emit({
        time,
        strength: Math.min(1.15, Math.max(0, strength)),
        reason: cause,
      });
      count++;
      reason = cause;
    },
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
        emit({
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
        });
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
