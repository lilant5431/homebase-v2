import { describe, it, expect, vi, afterEach } from "vitest";
import { evaluationState } from "./testFixtures";
import {
  KEY,
  parseState,
  validateState,
  validDate,
  validateProposal,
  type Proposal,
  type Block,
} from "./domain";
import { putBlock, putAssignment, toggleAssignment } from "./academic";
import { WorkspaceStore, type StoragePort } from "./storage";
import { parseIntent, validateIntent } from "./planningIntent";
import {
  approveProposal,
  reviewIssues,
  type ProposalReview,
} from "./proposalReview";

const proposal = (
  overrides: Partial<Proposal["blocks"][number]> = {},
): Proposal => ({
  summary: "fixture, not model inference",
  blocks: [
    {
      assignmentId: "essay",
      start: "2026-10-20T14:00",
      end: "2026-10-20T15:00",
      ...overrides,
    },
  ],
});
const block = (overrides: Partial<Block> = {}): Block => ({
  id: "study",
  title: "History essay",
  assignmentId: "essay",
  start: "2026-10-20T14:00",
  end: "2026-10-20T15:00",
  color: "lilac",
  ...overrides,
});
const request =
  'Schedule "History essay" on 2026-10-20 at 14:00 for 60 minutes.';
function memory() {
  const values = new Map<string, string>();
  let failKey = "";
  const storage: StoragePort = {
    removeItem: (key) => {
      values.delete(key);
    },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === failKey) throw Error("quota fixture");
      values.set(key, value);
    },
  };
  return {
    values,
    storage,
    fail: (key: string) => {
      failKey = key;
    },
  };
}

describe("shared event and restore rules", () => {
  it.each([
    "2026-02-30T10:00",
    "2026-13-01T10:00",
    "2026-10-20T24:00",
    "2026-10-20T10:00Z",
    "2026-10-20",
    "not a date",
  ])("rejects malformed/non-local date %s", (date) => {
    expect(validDate(date)).toBe(false);
    const s = evaluationState();
    s.blocks[0].start = date;
    expect(() => parseState(JSON.stringify(s))).toThrow();
    expect(() => putBlock(evaluationState(), block({ start: date }))).toThrow();
  });
  it("rejects zero, reverse, and overnight event durations for manual and imports", () => {
    for (const [start, end] of [
      ["2026-10-20T14:00", "2026-10-20T14:00"],
      ["2026-10-20T15:00", "2026-10-20T14:00"],
      ["2026-10-20T23:00", "2026-10-21T01:00"],
    ]) {
      const s = evaluationState();
      s.blocks.push(block({ start, end }));
      expect(() => parseState(JSON.stringify(s))).toThrow();
      expect(() =>
        putBlock(evaluationState(), block({ start, end })),
      ).toThrow();
    }
  });
  it("allows overlapping commitments, but every study session requires free time", () => {
    const s = evaluationState();
    const commitment = {
      ...block({ start: "2026-10-20T10:15", end: "2026-10-20T10:45" }),
      assignmentId: undefined,
    };
    expect(validateState(putBlock(s, commitment))).toEqual([]);
    expect(() =>
      putBlock(
        s,
        block({ start: "2026-10-20T10:15", end: "2026-10-20T10:45" }),
      ),
    ).toThrow(/overlaps/);
    s.blocks.push(
      block({ start: "2026-10-20T10:15", end: "2026-10-20T10:45" }),
    );
    expect(() => parseState(JSON.stringify(s))).toThrow(/overlaps/);
  });
  it("rejects deadline, duration, total-work and reference violations on import", () => {
    for (const b of [
      block({ end: "2026-10-20T14:10" }),
      block({ end: "2026-10-20T19:00" }),
      block({ start: "2026-10-23T17:00", end: "2026-10-23T18:00" }),
      block({ assignmentId: "missing" }),
      block({ assignmentId: "" }),
    ]) {
      const s = evaluationState();
      s.blocks.push(b);
      expect(() => parseState(JSON.stringify(s))).toThrow();
    }
    const s = evaluationState();
    s.blocks.push(
      block(),
      block({
        id: "second",
        start: "2026-10-21T14:00",
        end: "2026-10-21T15:30",
      }),
    );
    expect(() => parseState(JSON.stringify(s))).toThrow(/work/);
  });
  it("allows adjacent sessions, rejects clashes within a proposal", () => {
    const s = putBlock(evaluationState(), block());
    expect(
      validateProposal(
        s,
        proposal({ start: "2026-10-20T15:00", end: "2026-10-20T16:00" }),
      ),
    ).toEqual([]);
    const p = proposal();
    p.blocks.push({ ...p.blocks[0] });
    expect(validateProposal(evaluationState(), p).join()).toMatch(/overlaps/);
  });
  it("proposal scratch IDs cannot collide with legitimate imported event IDs", () => {
    const state = evaluationState();
    state.blocks[0].id = "proposal-0";
    expect(validateProposal(state, proposal())).toEqual([]);
  });
  it("retains completed history and blocks new or changed completed sessions", () => {
    const completed = toggleAssignment(
      putBlock(evaluationState(), block()),
      "essay",
    );
    expect(() => parseState(JSON.stringify(completed))).not.toThrow();
    expect(() => putBlock(completed, block({ id: "new" }))).toThrow(
      /completed/,
    );
    expect(() =>
      putBlock(completed, block({ assignmentId: undefined })),
    ).toThrow(/completed/);
    expect(() =>
      putBlock(completed, block({ end: "2026-10-20T15:15" })),
    ).toThrow(/completed/);
    expect(validateProposal(completed, proposal()).join()).toMatch(/completed/);
  });
  it("assignment editing cannot invalidate scheduled work", () => {
    const s = putBlock(evaluationState(), block());
    expect(() =>
      putAssignment(s, { ...s.assignments[0], estimatedMinutes: 30 }),
    ).toThrow();
    expect(() =>
      putAssignment(s, { ...s.assignments[0], dueDate: "2026-10-20T14:30" }),
    ).toThrow();
  });
  it("rejects malformed roots, duplicate IDs and non-string assignment references", () => {
    for (const value of [
      null,
      [],
      {},
      { ...evaluationState(), revision: Infinity },
    ])
      expect(() => parseState(JSON.stringify(value))).toThrow();
    const s = evaluationState();
    s.assignments.push({ ...s.assignments[0] });
    expect(() => parseState(JSON.stringify(s))).toThrow();
    const other = evaluationState();
    other.blocks.push({ ...block(), assignmentId: 0 } as unknown as Block);
    expect(() => parseState(JSON.stringify(other))).toThrow();
  });
  it("floating clock values remain valid across device zones and DST transitions", () => {
    const state = evaluationState();
    state.blocks[0].start = "2026-03-08T02:30";
    state.blocks[0].end = "2026-03-08T03:30";
    const raw = JSON.stringify(state);
    for (const zone of ["UTC", "America/New_York", "Pacific/Honolulu"]) {
      vi.stubEnv("TZ", zone);
      expect(validDate("2026-03-08T02:30")).toBe(true);
      expect(validDate("2026-11-01T01:30")).toBe(true);
      expect(parseState(raw)).toEqual(state);
    }
  });
  afterEach(() => vi.unstubAllEnvs());
});
describe("storage, recovery, stale writes and restore", () => {
  it("never saves a workspace that would fail the restore size limit", () => {
    const m = memory();
    const state = { ...evaluationState(), revision: 9, padding: "" };
    state.padding = "x".repeat(5_000_000 - JSON.stringify(state).length);
    const raw = JSON.stringify(state);
    expect(raw.length).toBe(5_000_000);
    m.values.set(KEY, raw);
    const store = new WorkspaceStore(m.storage);
    expect(store.snapshot.error).toBe("");
    expect(() => store.save(store.snapshot.state)).toThrow(/5 MB/);
    expect(m.values.get(KEY)).toBe(raw);
    expect(m.values.has(KEY + ".rollback")).toBe(false);
  });
  it("save reload export/restore and undo preserve revision and data", () => {
    const m = memory();
    m.values.set(KEY, JSON.stringify(evaluationState()));
    const store = new WorkspaceStore(m.storage);
    store.save(putBlock(store.snapshot.state, block()));
    const reloaded = new WorkspaceStore(m.storage);
    expect(reloaded.snapshot.state.blocks).toHaveLength(2);
    const before = reloaded.snapshot.state;
    reloaded.restore(JSON.stringify(evaluationState()));
    expect(reloaded.snapshot.state.revision).toBe(2);
    reloaded.undo();
    expect(reloaded.snapshot.state.blocks).toEqual(before.blocks);
    expect(reloaded.snapshot.state.revision).toBe(3);
  });
  it("bad restore never writes current or rollback data", () => {
    const m = memory();
    m.values.set(KEY, JSON.stringify(evaluationState()));
    const store = new WorkspaceStore(m.storage);
    for (const raw of [
      "null",
      "{broken",
      JSON.stringify({
        ...evaluationState(),
        blocks: [
          block({ start: "2026-10-20T10:00", end: "2026-10-20T11:00" }),
          ...evaluationState().blocks,
        ],
      }),
    ]) {
      const before = new Map(m.values);
      expect(() => store.restore(raw)).toThrow();
      expect(m.values).toEqual(before);
    }
  });
  it("detects another tab and a stale async restore revision", () => {
    const m = memory();
    m.values.set(KEY, JSON.stringify(evaluationState()));
    const a = new WorkspaceStore(m.storage),
      b = new WorkspaceStore(m.storage);
    a.save(putBlock(a.snapshot.state, block()));
    const before = m.values.get(KEY);
    expect(() => b.save(b.snapshot.state)).toThrow(/another/);
    expect(() => a.restore(JSON.stringify(evaluationState()), 0)).toThrow(
      /another/,
    );
    expect(m.values.get(KEY)).toBe(before);
  });
  it("preserves corrupt originals even with a previous recovery and allows replacement", () => {
    const m = memory();
    m.values.set(KEY, "{bad");
    m.values.set(KEY + ".recovery", "older");
    const store = new WorkspaceStore(m.storage);
    expect(store.exportRecovery()).toBe("{bad");
    store.restore(JSON.stringify(evaluationState()));
    expect(store.exportRecovery()).toBe("{bad");
    expect([...m.values.values()]).toContain("older");
    expect(store.snapshot.error).toBe("");
    expect(new WorkspaceStore(m.storage).snapshot.error).toBe("");
  });
  it("quota failure leaves primary and visible state unchanged", () => {
    const m = memory();
    m.values.set(KEY, JSON.stringify(evaluationState()));
    const store = new WorkspaceStore(m.storage),
      before = store.snapshot;
    m.fail(KEY);
    expect(() => store.save(putBlock(before.state, block()))).toThrow();
    expect(store.snapshot).toBe(before);
    expect(m.values.get(KEY)).toBe(before.raw);
    expect(m.values.has(KEY + ".rollback")).toBe(false);
  });
  it("store rejects a stale candidate even when a future caller omits expectedRevision", () => {
    const m = memory();
    m.values.set(KEY, JSON.stringify(evaluationState()));
    const store = new WorkspaceStore(m.storage);
    const stale = store.snapshot.state;
    store.save(putBlock(stale, block()));
    expect(() => store.save(stale)).toThrow(/another/);
  });
  it("preservation failure never replaces unreadable current data", () => {
    const m = memory();
    m.values.set(KEY, "unreadable");
    const store = new WorkspaceStore(m.storage);
    m.fail(KEY + ".recovery");
    expect(() => store.restore(JSON.stringify(evaluationState()))).toThrow();
    expect(m.values.get(KEY)).toBe("unreadable");
  });
});
describe("bounded intent and mandatory approval gate (deterministic fixtures)", () => {
  it("accepts an exact request and a window with exactly requested duration", () => {
    const intent = parseIntent(request, evaluationState().assignments);
    expect(validateIntent(intent, proposal())).toEqual([]);
    const window = parseIntent(
      'Schedule "Calculus problem set" on 2026-10-21 between 13:00 and 17:00 for 90 minutes.',
      evaluationState().assignments,
    );
    expect(
      validateIntent(
        window,
        proposal({
          assignmentId: "calculus",
          start: "2026-10-21T14:00",
          end: "2026-10-21T15:30",
        }),
      ),
    ).toEqual([]);
  });
  it.each([
    "Find time for homework",
    'Schedule "History essay" tomorrow at 14:00 for 60 minutes.',
    'Schedule "History essay" on 2026-10-20 at 14:00 for 60 minutes. Keep evenings free.',
    'Schedule "Missing" on 2026-10-20 at 14:00 for 60 minutes.',
    'Schedule "History essay" on 2026-10-20 between 14:00 and 14:30 for 60 minutes.',
    'Schedule "History essay" on 2026-10-20 at 23:30 for 60 minutes.',
  ])("requests clarification rather than ignoring constraints: %s", (text) => {
    expect(() => parseIntent(text, evaluationState().assignments)).toThrow(
      /Clarification/,
    );
  });
  it("duplicate assignment titles require a unique ID", () => {
    const assignments = evaluationState().assignments;
    assignments.push({ ...assignments[0], id: "other" });
    expect(() => parseIntent(request, assignments)).toThrow(/Clarification/);
    expect(
      parseIntent(request.replace("History essay", "essay"), assignments)
        .assignmentId,
    ).toBe("essay");
  });
  it("separately rejects wrong assignment, date, window, duration and extra blocks", () => {
    const intent = parseIntent(request, evaluationState().assignments);
    for (const overrides of [
      { assignmentId: "calculus" },
      { start: "2026-10-21T14:00", end: "2026-10-21T15:00" },
      { start: "2026-10-20T15:00", end: "2026-10-20T16:00" },
      { end: "2026-10-20T14:30" },
    ])
      expect(
        validateIntent(intent, proposal(overrides)).length,
      ).toBeGreaterThan(0);
    const p = proposal();
    p.blocks.push(p.blocks[0]);
    expect(validateIntent(intent, p).join()).toMatch(/one/);
  });
  it("domain-valid 60 minute answer cannot satisfy the 90 minute request", () => {
    const s = evaluationState(),
      r =
        'Schedule "Calculus problem set" on 2026-10-21 between 13:00 and 17:00 for 90 minutes.';
    const p = proposal({
      assignmentId: "calculus",
      start: "2026-10-21T14:30",
      end: "2026-10-21T15:30",
    });
    expect(validateProposal(s, p)).toEqual([]);
    const review: ProposalReview = {
      proposal: p,
      intent: parseIntent(r, s.assignments),
      request: r,
      revision: 0,
      latency: 0,
    };
    expect(() => approveProposal(s, review, r)).toThrow(/duration/);
  });
  it("blocks stale state, edited requests, busy time and allows explicit valid approval only", () => {
    const s = evaluationState();
    const review: ProposalReview = {
      proposal: proposal(),
      intent: parseIntent(request, s.assignments),
      request,
      revision: 0,
      latency: 0,
    };
    const raw = JSON.stringify(s);
    expect(approveProposal(s, review, request).blocks).toHaveLength(2);
    expect(JSON.stringify(s)).toBe(raw);
    expect(reviewIssues({ ...s, revision: 1 }, review, request).join()).toMatch(
      /changed/,
    );
    expect(() =>
      approveProposal(s, review, request.replace("60", "90")),
    ).toThrow(/changed/);
    const busy =
      'Schedule "History essay" on 2026-10-20 at 10:00 for 60 minutes.';
    expect(() =>
      approveProposal(
        s,
        {
          ...review,
          request: busy,
          intent: parseIntent(busy, s.assignments),
          proposal: proposal({
            start: "2026-10-20T10:00",
            end: "2026-10-20T11:00",
          }),
        },
        busy,
      ),
    ).toThrow(/overlaps/);
  });
});
