import {
  assertState,
  type Assignment,
  type Block,
  type Proposal,
  type State,
  validateProposal,
} from "./domain";

export function putAssignment(state: State, assignment: Assignment): State {
  const next = {
    ...state,
    assignments: [
      ...state.assignments.filter((a) => a.id !== assignment.id),
      assignment,
    ],
    blocks: state.blocks.map((b) =>
      b.assignmentId === assignment.id
        ? { ...b, title: assignment.title, color: assignment.color }
        : b,
    ),
  };
  assertState(next);
  return next;
}
export function toggleAssignment(state: State, id: string): State {
  const a = state.assignments.find((a) => a.id === id);
  if (!a) throw Error("Assignment no longer exists.");
  return putAssignment(state, { ...a, completed: !a.completed });
}
export function putBlock(state: State, block: Block): State {
  const prior = state.blocks.find((b) => b.id === block.id);
  if (
    prior &&
    (prior.locked || prior.sessionCompleted) &&
    (["assignmentId", "start", "end", "title", "color"] as const).some(
      (key) => prior[key] !== block[key],
    )
  )
    throw Error(
      "Unlock or reopen this session before changing its scheduled time.",
    );
  if (
    prior?.sessionCompleted !== block.sessionCompleted ||
    prior?.locked !== block.locked
  ) {
    if (
      (block.sessionCompleted ?? false) !==
        (prior?.sessionCompleted ?? false) ||
      (block.locked ?? false) !== (prior?.locked ?? false)
    )
      throw Error(
        "Use the session completion or lock operation to change its status.",
      );
  }
  const a = state.assignments.find((a) => a.id === block.assignmentId);
  const priorAssignment = state.assignments.find(
    (a) => a.id === prior?.assignmentId,
  );
  if (
    (a?.completed || priorAssignment?.completed) &&
    (!prior ||
      (["assignmentId", "start", "end", "title", "color"] as const).some(
        (key) => prior[key] !== block[key],
      ))
  )
    throw Error(
      "Reopen this completed assignment before changing its study time.",
    );
  const next = {
    ...state,
    blocks: [...state.blocks.filter((b) => b.id !== block.id), block],
  };
  assertState(next);
  return next;
}
export function removeBlock(state: State, id: string): State {
  if (state.blocks.find((b) => b.id === id)?.locked)
    throw Error("Unlock this session before deleting it.");
  const next = { ...state, blocks: state.blocks.filter((b) => b.id !== id) };
  assertState(next);
  return next;
}
export function setSessionCompleted(
  state: State,
  id: string,
  completed: boolean,
): State {
  const block = state.blocks.find((b) => b.id === id);
  if (!block?.assignmentId) throw Error("Study session no longer exists.");
  const next = {
    ...state,
    blocks: state.blocks.map((b) =>
      b.id === id ? { ...b, sessionCompleted: completed } : b,
    ),
  };
  assertState(next);
  return next;
}
export function setBlockLocked(
  state: State,
  id: string,
  locked: boolean,
): State {
  if (!state.blocks.some((b) => b.id === id))
    throw Error("Session no longer exists.");
  const next = {
    ...state,
    blocks: state.blocks.map((b) => (b.id === id ? { ...b, locked } : b)),
  };
  assertState(next);
  return next;
}
export function applyProposal(state: State, proposal: Proposal): State {
  const errors = validateProposal(state, proposal);
  if (errors.length) throw Error(errors.join(" "));
  const blocks = proposal.blocks.map((b) => {
    const a = state.assignments.find((a) => a.id === b.assignmentId)!;
    return {
      assignmentId: b.assignmentId,
      start: b.start,
      end: b.end,
      id: crypto.randomUUID(),
      title: a.title,
      color: a.color,
    };
  });
  const next = { ...state, blocks: [...state.blocks, ...blocks] };
  assertState(next);
  return next;
}
