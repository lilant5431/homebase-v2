import type { WorldOrb } from "./contract";
export const CREATION_SECONDS = 5.6;
export const MAX_ENERGY_ROUTES = 4;
export const MAX_FORMATIONS = 24;
type CreationBatch = {
  start: number;
  last: number;
  duration: number;
  grouped: boolean;
};
export type OrbEffect = {
  id: string;
  kind: "creation" | "move" | "completion" | "deletion" | "selection";
  time: number;
  from?: WorldOrb;
  to?: WorldOrb;
  batch?: CreationBatch;
};
export function creationAge(effect: OrbEffect, time: number) {
  return (
    ((time - (effect.batch?.start ?? effect.time)) * CREATION_SECONDS) /
    (effect.batch?.duration ?? CREATION_SECONDS)
  );
}
export function routedCreations(effects: readonly OrbEffect[], time: number) {
  const active = effects.filter(
    (e) =>
      e.kind === "creation" &&
      e.to &&
      creationAge(e, time) >= 0 &&
      creationAge(e, time) < CREATION_SECONDS,
  );
  const recent = active.slice(-MAX_ENERGY_ROUTES);
  const batches = new Set(
    recent.filter((e) => e.batch?.grouped).map((e) => e.batch),
  );
  return active
    .filter((e) => recent.includes(e) || (e.batch && batches.has(e.batch)))
    .slice(-MAX_FORMATIONS);
}
/** Diff committed snapshots only; first load/recovery is a baseline, never a birth. */
export function createOrbLifecycle(
  initial: readonly WorldOrb[],
  selected?: string | null,
) {
  let previous = new Map(initial.map((orb) => [orb.id, orb]));
  let selection = selected;
  let effects: OrbEffect[] = [];
  let count = 0;
  let last = "Existing schedule · no arrival effects";
  let batch: CreationBatch | undefined;
  return {
    update(
      next: readonly WorldOrb[],
      chosen: string | null | undefined,
      time: number,
      quiet: boolean,
    ) {
      const current = new Map(next.map((orb) => [orb.id, orb]));
      // One latest transition per ID: rapid edits replace rather than queue ghosts.
      effects = quiet
        ? []
        : effects.filter((effect) =>
            effect.kind === "creation"
              ? creationAge(effect, time) < CREATION_SECONDS
              : time - effect.time < 2.8,
          );
      const emit = (effect: OrbEffect) => {
        if (effect.kind === "creation") {
          // Presentation grouping only. A stable shared clock survives interruption
          // of another member; joining never queues independent full sequences.
          if (!batch || time - batch.last > 0.9 || time - batch.start > 2.8) {
            batch = {
              start: time,
              last: time,
              duration: CREATION_SECONDS,
              grouped: false,
            };
          } else {
            batch.last = time;
            batch.grouped = true;
            batch.duration = CREATION_SECONDS + (time - batch.start) * 0.35;
          }
          effect.batch = batch;
        }
        effects = [...effects.filter((e) => e.id !== effect.id), effect].slice(
          -48,
        );
        count++;
        last = effect.kind;
      };
      if (quiet) batch = undefined;
      if (!quiet) {
        for (const orb of next) {
          const old = previous.get(orb.id);
          if (!old && !orb.completed)
            emit({ id: orb.id, kind: "creation", time, to: orb });
          else if (old && !old.completed && orb.completed)
            emit({ id: orb.id, kind: "completion", time, from: old, to: orb });
          else if (old?.completed && !orb.completed)
            emit({ id: orb.id, kind: "creation", time, to: orb });
          else if (
            old &&
            !orb.completed &&
            (old.angle !== orb.angle || old.lane !== orb.lane)
          )
            emit({ id: orb.id, kind: "move", time, from: old, to: orb });
        }
        for (const [id, old] of previous)
          if (!current.has(id) && !old.completed)
            emit({ id, kind: "deletion", time, from: old });
        if (
          chosen &&
          chosen !== selection &&
          current.has(chosen) &&
          !effects.some((e) => e.id === chosen)
        )
          emit({
            id: chosen,
            kind: "selection",
            time,
            to: current.get(chosen),
          });
      }
      previous = current;
      selection = chosen;
    },
    sample(time: number) {
      effects = effects.filter(
        (e) =>
          time >= e.time &&
          (e.kind === "creation"
            ? creationAge(e, time) < CREATION_SECONDS
            : time - e.time < 2.8),
      );
      return { effects, count, last };
    },
    clear() {
      effects = [];
      batch = undefined;
    },
  };
}
