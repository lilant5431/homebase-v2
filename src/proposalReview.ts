import { validateProposal, type State, type Proposal } from "./domain";
import { applyProposal } from "./academic";
import {
  parseIntent,
  validateIntent,
  type PlanningIntent,
} from "./planningIntent";

export type ProposalReview = {
  proposal: Proposal;
  intent: PlanningIntent;
  request: string;
  revision: number;
  latency: number;
};
export function reviewIssues(
  state: State,
  review: ProposalReview,
  request: string,
): string[] {
  const errors = [
    ...validateProposal(state, review.proposal),
    ...validateIntent(review.intent, review.proposal),
  ];
  if (review.revision !== state.revision)
    errors.push("Your plan changed. Generate a new proposal.");
  if (review.request !== request)
    errors.push("Your request changed. Generate a new proposal.");
  try {
    if (
      JSON.stringify(
        parseIntent(
          request,
          state.assignments.filter((a) => !a.completed),
        ),
      ) !== JSON.stringify(review.intent)
    )
      errors.push("Planning constraints changed. Generate a new proposal.");
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  return [...new Set(errors)];
}
export function approveProposal(
  state: State,
  review: ProposalReview,
  request: string,
): State {
  const errors = reviewIssues(state, review, request);
  if (errors.length) throw Error(errors.join(" "));
  return applyProposal(state, review.proposal);
}
