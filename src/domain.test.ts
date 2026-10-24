import { describe, it, expect } from "vitest";
import { seed, validateProposal, parseState, commit } from "./domain";
describe("deterministic scheduling boundary", () => {
  it("accepts a free block without mutating the schedule", () => {
    const s = seed(),
      before = JSON.stringify(s);
    const start = s.blocks[0].start.slice(0, 10) + "T15:00";
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          { assignmentId: "a2", start, end: start.slice(0, 11) + "16:00" },
        ],
      }),
    ).toEqual([]);
    expect(JSON.stringify(s)).toBe(before);
  });
  it("rejects overlapping proposed and existing blocks", () => {
    const s = seed();
    const b = {
      assignmentId: "a1",
      start: s.blocks[0].start,
      end: s.blocks[0].end,
    };
    expect(validateProposal(s, { summary: "", blocks: [b] }).join()).toContain(
      "overlaps",
    );
    const day = b.start.slice(0, 10);
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          { ...b, start: day + "T15:00", end: day + "T15:30" },
          { ...b, start: day + "T15:15", end: day + "T15:45" },
        ],
      }).join(),
    ).toContain("overlaps");
  });
  it("rejects deadlines, completed assignments, and overscheduling", () => {
    const s = seed();
    const date = s.assignments[0].dueDate.slice(0, 10);
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          { assignmentId: "a1", start: date + "T22:00", end: date + "T23:30" },
        ],
      }).join(),
    ).toContain("remaining");
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          { assignmentId: "a2", start: date + "T23:30", end: date + "T23:00" },
        ],
      }).join(),
    ).toContain("valid");
    s.assignments[0].completed = true;
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          { assignmentId: "a1", start: date + "T15:00", end: date + "T16:00" },
        ],
      }).join(),
    ).toContain("completed");
  });
  it("rejects invalid calendar dates and malformed backups", () => {
    const s = seed();
    expect(() =>
      parseState(JSON.stringify({ ...s, schemaVersion: 4 })),
    ).toThrow();
    s.assignments[0].dueDate = "2026-02-30T10:00";
    expect(() => parseState(JSON.stringify(s))).toThrow();
    expect(
      validateProposal(seed(), {
        summary: "",
        blocks: [
          {
            assignmentId: "a1",
            start: "2026-02-30T10:00",
            end: "2026-02-30T11:00",
          },
        ],
      }).join(),
    ).toContain("valid");
  });
  it("roundtrips versioned backups and increments revision", () => {
    const s = seed();
    expect(parseState(JSON.stringify(s))).toEqual(s);
    expect(commit(s, s).revision).toBe(1);
    expect(s.revision).toBe(0);
  });
  it("rejects unknown IDs, empty proposals and excessive durations", () => {
    const s = seed();
    expect(validateProposal(s, { summary: "", blocks: [] })).not.toEqual([]);
    expect(
      validateProposal(s, {
        summary: "",
        blocks: [
          {
            assignmentId: "missing",
            start: "2026-10-19T10:00",
            end: "2026-10-19T11:00",
          },
        ],
      }),
    ).not.toEqual([]);
  });
});
