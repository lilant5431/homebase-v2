export type Assignment = {
  id: string;
  title: string;
  course: string;
  dueDate: string;
  estimatedMinutes: number;
  completed: boolean;
  color: string;
};
export type Block = {
  id: string;
  assignmentId?: string;
  title: string;
  start: string;
  end: string;
  color: string;
};
export type State = {
  schemaVersion: 2;
  revision: number;
  assignments: Assignment[];
  blocks: Block[];
};
export type Proposal = {
  blocks: { assignmentId: string; start: string; end: string }[];
  summary: string;
};
export const KEY = "homebase.v2";
export const localISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export function monday(date = new Date()) {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}
export function seed(): State {
  const m = monday();
  const day = (n: number, time: string) => {
    const d = new Date(m);
    d.setDate(d.getDate() + n);
    return `${localISO(d)}T${time}`;
  };
  return {
    schemaVersion: 2,
    revision: 0,
    assignments: [
      {
        id: "a1",
        title: "The architecture of memory",
        course: "PSY 204",
        dueDate: day(3, "23:59"),
        estimatedMinutes: 120,
        completed: false,
        color: "lilac",
      },
      {
        id: "a2",
        title: "Problem set 04",
        course: "MAT 201",
        dueDate: day(4, "17:00"),
        estimatedMinutes: 90,
        completed: false,
        color: "mint",
      },
      {
        id: "a3",
        title: "Reading response: Modernism",
        course: "ENG 210",
        dueDate: day(2, "23:59"),
        estimatedMinutes: 60,
        completed: false,
        color: "peach",
      },
      {
        id: "a4",
        title: "Ecosystems field notes",
        course: "BIO 110",
        dueDate: day(6, "23:59"),
        estimatedMinutes: 75,
        completed: false,
        color: "blue",
      },
    ],
    blocks: [
      {
        id: "b1",
        title: "Cognitive psychology",
        start: day(0, "10:00"),
        end: day(0, "11:30"),
        color: "lilac",
      },
      {
        id: "b2",
        title: "Linear algebra",
        start: day(1, "09:00"),
        end: day(1, "10:30"),
        color: "mint",
      },
      {
        id: "b3",
        title: "Literature seminar",
        start: day(2, "11:00"),
        end: day(2, "12:30"),
        color: "peach",
      },
      {
        id: "b4",
        title: "Cognitive psychology",
        start: day(3, "10:00"),
        end: day(3, "11:30"),
        color: "lilac",
      },
      {
        id: "b5",
        title: "Biology lab",
        start: day(4, "13:00"),
        end: day(4, "15:00"),
        color: "blue",
      },
      {
        id: "b6",
        assignmentId: "a1",
        title: "The architecture of memory",
        start: day(0, "13:00"),
        end: day(0, "14:00"),
        color: "lilac",
      },
    ],
  };
}
// Schema v2 stores floating wall-clock values, not instants or a device zone.
// Gregorian validation and duration arithmetic must not change when travelling.
export function validDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))
    return false;
  const d = new Date(s + "Z");
  return Number.isFinite(+d) && d.toISOString().slice(0, 16) === s;
}
export const minutesBetween = (start: string, end: string) =>
  (+new Date(end + "Z") - +new Date(start + "Z")) / 60000;
export const floatingDate = (value: string) => new Date(value + "Z");
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number): v is string =>
  typeof v === "string" && !!v.trim() && v.length <= max;
const colors = ["lilac", "mint", "peach", "blue"];

/** One rule set for whole calendars (including imported history). Completed
 * assignments may retain existing sessions; operations forbid new/changed ones. */
export function validateState(value: unknown): string[] {
  if (
    !object(value) ||
    value.schemaVersion !== 2 ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.assignments) ||
    !Array.isArray(value.blocks) ||
    value.assignments.length > 1000 ||
    value.blocks.length > 5000
  )
    return ["Unsupported or invalid backup. Expected schema version 2."];
  const errors: string[] = [];
  const assignments = new Map<string, Assignment>();
  const ids = new Set<string>();
  for (const a of value.assignments) {
    if (
      !object(a) ||
      !text(a.id, 200) ||
      assignments.has(a.id) ||
      !text(a.title, 120) ||
      !text(a.course, 40) ||
      !validDate(a.dueDate) ||
      !Number.isInteger(a.estimatedMinutes) ||
      (a.estimatedMinutes as number) < 15 ||
      (a.estimatedMinutes as number) > 10080 ||
      typeof a.completed !== "boolean" ||
      !colors.includes(a.color as string)
    ) {
      errors.push("Invalid assignment in backup.");
      continue;
    }
    assignments.set(a.id, a as unknown as Assignment);
  }
  const blocks: Block[] = [];
  for (const b of value.blocks) {
    if (
      !object(b) ||
      !text(b.id, 200) ||
      ids.has(b.id) ||
      !text(b.title, 120) ||
      !validDate(b.start) ||
      !validDate(b.end) ||
      b.end <= b.start ||
      b.start.slice(0, 10) !== b.end.slice(0, 10) ||
      !colors.includes(b.color as string) ||
      (b.assignmentId !== undefined &&
        (!text(b.assignmentId, 200) || !assignments.has(b.assignmentId)))
    ) {
      errors.push(
        "Invalid calendar event: check IDs, dates, title and assignment.",
      );
      continue;
    }
    ids.add(b.id);
    blocks.push(b as unknown as Block);
  }
  const totals = new Map<string, number>();
  for (const b of blocks) {
    if (!b.assignmentId) continue;
    const a = assignments.get(b.assignmentId)!;
    const minutes = minutesBetween(b.start, b.end);
    if (minutes < 15 || minutes > 240)
      errors.push(
        `${a.title}: study blocks must be 15�240 minutes on one day.`,
      );
    if (b.end > a.dueDate)
      errors.push(`${a.title}: block ends after its deadline.`);
    totals.set(a.id, (totals.get(a.id) || 0) + minutes);
  }
  // Commitments may overlap each other (e.g. a lecture and an all-day reminder).
  // A linked focus session must be free of every other event, including history.
  const sorted = blocks.slice().sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length; i++)
    for (
      let j = i + 1;
      j < sorted.length && sorted[j].start < sorted[i].end;
      j++
    ) {
      if (sorted[i].assignmentId || sorted[j].assignmentId)
        errors.push("Study time overlaps another event.");
    }
  for (const [id, total] of totals)
    if (total > assignments.get(id)!.estimatedMinutes)
      errors.push(
        `${assignments.get(id)!.title}: exceeds remaining estimated work.`,
      );
  return [...new Set(errors)];
}
export function assertState(value: unknown): asserts value is State {
  const errors = validateState(value);
  if (errors.length) throw Error(errors.join(" "));
}
export const MAX_BACKUP_BYTES = 5_000_000;
export function assertBackupSize(raw: string) {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw Error(
      "Workspace exceeds the 5 MB UTF-8 backup limit. Export and reduce it before saving.",
    );
}
/** The same compact JSON encoding is used for persisted state and backups. */
export function serializeState(state: State): string {
  assertState(state);
  const raw = JSON.stringify(state);
  assertBackupSize(raw);
  return raw;
}
export function parseState(raw: string): State {
  assertBackupSize(raw);
  const value: unknown = JSON.parse(raw);
  assertState(value);
  return value;
}
export function validateProposal(state: State, proposal: Proposal): string[] {
  if (
    !proposal ||
    typeof proposal.summary !== "string" ||
    !Array.isArray(proposal.blocks) ||
    !proposal.blocks.length ||
    proposal.blocks.length > 40
  )
    return ["A proposal must contain 1�40 study blocks."];
  const errors: string[] = [];
  const blocks: Block[] = [];
  const ids = new Set(state.blocks.map((b) => b.id));
  for (const [i, b] of proposal.blocks.entries()) {
    if (!object(b)) {
      errors.push("Invalid proposed block.");
      continue;
    }
    const a = state.assignments.find((a) => a.id === b.assignmentId);
    if (!a || a.completed) {
      errors.push("Assignment is missing or completed.");
      continue;
    }
    let id = `proposal-${i}`;
    while (ids.has(id)) id += "-";
    ids.add(id);
    blocks.push({
      id,
      assignmentId: a.id,
      title: a.title,
      color: a.color,
      start: b.start,
      end: b.end,
    });
  }
  return [
    ...new Set([
      ...errors,
      ...validateState({ ...state, blocks: [...state.blocks, ...blocks] }),
    ]),
  ];
}
export function commit(current: State, next: State): State {
  const updated = { ...next, revision: current.revision + 1 };
  assertState(updated);
  return updated;
}
