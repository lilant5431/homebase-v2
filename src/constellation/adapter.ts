import { localISO, minutesBetween, type State } from "../domain";
import type { WorldOrb } from "../world/contract";

const palette: Record<string, string> = {
  lilac: "#c5b4fa",
  mint: "#9be8d5",
  peach: "#f3c5a7",
  blue: "#9edbff",
};
/** Pure read-only projection. IDs and dates remain owned by the academic model. */
export function scheduleOrbs(state: State, now: string): WorldOrb[] {
  const groups = new Map<string, number>();
  return state.blocks
    .filter((b) => !!b.assignmentId)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id))
    .map((b) => {
      const date = new Date(b.start + "Z");
      const day = (date.getUTCDay() + 6) % 7;
      const minute = date.getUTCHours() * 60 + date.getUTCMinutes();
      const lane = day < 4 ? 0 : 1;
      const bucket = `${lane}:${day}:${Math.floor(minute / 90)}`;
      const rank = groups.get(bucket) || 0;
      groups.set(bucket, rank + 1);
      return {
        id: b.id,
        label: `${b.title} · ${b.start.replace("T", " ")}`,
        color: palette[b.color],
        angle:
          ((day + minute / 1440) / 7) * Math.PI * 2 -
          Math.PI / 2 +
          (Math.floor(rank / 12) % 16) * 0.009,
        lane,
        spread: (rank % 12) * 0.055,
        size: 0.32 + Math.min(240, minutesBetween(b.start, b.end)) / 600,
        completed: b.sessionCompleted === true,
        overdue: !b.sessionCompleted && b.end < now,
      };
    });
}
export const wallClockNow = () => {
  const date = new Date();
  return `${localISO(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
