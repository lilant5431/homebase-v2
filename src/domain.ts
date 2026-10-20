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
const validDate = (s: unknown): s is string => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s))
    return false;
  const d = new Date(s);
  return (
    Number.isFinite(+d) &&
    `${localISO(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` ===
      s
  );
};
export function validateProposal(state: State, proposal: Proposal): string[] {
  const errors: string[] = [];
  if (
    !proposal ||
    !Array.isArray(proposal.blocks) ||
    !proposal.blocks.length ||
    proposal.blocks.length > 40
  )
    return ["A proposal must contain 1–40 study blocks."];
  const accepted: Block[] = [...state.blocks];
  const totals: Record<string, number> = {};
  for (const b of proposal.blocks) {
    const a = state.assignments.find((a) => a.id === b.assignmentId);
    if (!a || a.completed) {
      errors.push("Assignment is missing or completed.");
      continue;
    }
    if (!validDate(b.start) || !validDate(b.end) || b.end <= b.start) {
      errors.push("Every block needs a valid start and end.");
      continue;
    }
    const minutes = (+new Date(b.end) - +new Date(b.start)) / 60000;
    if (
      minutes < 15 ||
      minutes > 240 ||
      b.start.slice(0, 10) !== b.end.slice(0, 10)
    )
      errors.push("Study blocks must be 15–240 minutes on one day.");
    if (b.end > a.dueDate)
      errors.push(`${a.title}: block ends after its deadline.`);
    if (accepted.some((x) => b.start < x.end && b.end > x.start))
      errors.push(`${a.title}: time overlaps another event.`);
    totals[a.id] = (totals[a.id] || 0) + minutes;
    accepted.push({ ...b, id: "preview", title: a.title, color: a.color });
  }
  for (const [id, minutes] of Object.entries(totals)) {
    const a = state.assignments.find((a) => a.id === id)!;
    const existing = state.blocks
      .filter((b) => b.assignmentId === id)
      .reduce((n, b) => n + (+new Date(b.end) - +new Date(b.start)) / 60000, 0);
    if (minutes + existing > a.estimatedMinutes)
      errors.push(`${a.title}: exceeds remaining estimated work.`);
  }
  return [...new Set(errors)];
}
export function parseState(raw: string): State {
  const s = JSON.parse(raw);
  if (
    s.schemaVersion !== 2 ||
    !Number.isInteger(s.revision) ||
    s.revision < 0 ||
    !Array.isArray(s.assignments) ||
    !Array.isArray(s.blocks) ||
    s.assignments.length > 1000 ||
    s.blocks.length > 5000
  )
    throw Error("Unsupported or invalid backup. Expected schema version 2.");
  const colors = ["lilac", "mint", "peach", "blue"];
  const ids = new Set();
  for (const a of s.assignments) {
    if (
      !a ||
      typeof a.id !== "string" ||
      ids.has(a.id) ||
      typeof a.title !== "string" ||
      !a.title.trim() ||
      typeof a.course !== "string" ||
      !validDate(a.dueDate) ||
      !Number.isInteger(a.estimatedMinutes) ||
      a.estimatedMinutes < 15 ||
      a.estimatedMinutes > 10080 ||
      typeof a.completed !== "boolean" ||
      !colors.includes(a.color)
    )
      throw Error("Invalid assignment in backup.");
    ids.add(a.id);
  }
  const blockIds = new Set();
  for (const b of s.blocks) {
    if (
      !b ||
      typeof b.id !== "string" ||
      blockIds.has(b.id) ||
      typeof b.title !== "string" ||
      !validDate(b.start) ||
      !validDate(b.end) ||
      b.end <= b.start ||
      b.start.slice(0, 10) !== b.end.slice(0, 10) ||
      !colors.includes(b.color) ||
      (b.assignmentId && !ids.has(b.assignmentId))
    )
      throw Error("Invalid calendar event in backup.");
    blockIds.add(b.id);
  }
  return s;
}
export function commit(current: State, next: State) {
  return { ...next, revision: current.revision + 1 } as State;
}
