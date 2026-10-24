import type { WorldOrb } from "./contract";
export const CREATION_SECONDS = 4.6;
export const MAX_ENERGY_ROUTES = 4;
export type OrbEffect = {
  id: string;
  kind: "creation" | "move" | "completion" | "deletion" | "selection";
  time: number;
  from?: WorldOrb;
  to?: WorldOrb;
};
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
        : effects.filter(
            (effect) =>
              time - effect.time <
              (effect.kind === "creation" ? CREATION_SECONDS : 2.8),
          );
      const emit = (effect: OrbEffect) => {
        effects = [...effects.filter((e) => e.id !== effect.id), effect].slice(
          -48,
        );
        count++;
        last = effect.kind;
      };
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
            (old.angle !== orb.angle ||
              old.lane !== orb.lane ||
              old.spread !== orb.spread ||
              old.radialOffset !== orb.radialOffset)
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
          time - e.time < (e.kind === "creation" ? CREATION_SECONDS : 2.8),
      );
      return { effects, count, last };
    },
    clear() {
      effects = [];
    },
  };
}
