import type { State } from "./domain";
export function evaluationState(): State {
  return {
    schemaVersion: 2,
    revision: 0,
    assignments: [
      {
        id: "essay",
        title: "History essay",
        course: "HIS 101",
        dueDate: "2026-10-23T17:00",
        estimatedMinutes: 120,
        completed: false,
        color: "lilac",
      },
      {
        id: "calculus",
        title: "Calculus problem set",
        course: "MAT 101",
        dueDate: "2026-10-22T17:00",
        estimatedMinutes: 90,
        completed: false,
        color: "mint",
      },
    ],
    blocks: [
      {
        id: "lecture",
        title: "Lecture",
        start: "2026-10-20T10:00",
        end: "2026-10-20T11:00",
        color: "blue",
      },
    ],
  };
}
