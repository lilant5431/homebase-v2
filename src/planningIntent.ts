import {
  validDate,
  minutesBetween,
  type Assignment,
  type Proposal,
} from "./domain";

/** Deliberately bounded language. Anything outside the complete grammar asks
 * for clarification; partial parsing must never discard an extra instruction. */
export type PlanningIntent = {
  assignmentId: string;
  date: string;
  windowStart: string;
  windowEnd: string;
  durationMinutes: number;
  exactStart: boolean;
};
type NamedAssignment = Pick<Assignment, "id" | "title">;
export const REQUEST_HELP =
  'Use: Schedule "Exact assignment title" on YYYY-MM-DD at HH:mm for N minutes. Or replace "at HH:mm" with "between HH:mm and HH:mm". One assignment and one block per request; 24-hour local time. Other instructions need clarification.';
export function parseIntent(
  request: string,
  assignments: NamedAssignment[],
): PlanningIntent {
  const match = request
    .trim()
    .match(
      /^Schedule "([^"\r\n]+)" on (\d{4}-\d{2}-\d{2}) (?:at (\d{2}:\d{2})|between (\d{2}:\d{2}) and (\d{2}:\d{2})) for (\d{1,3}) minutes\.?$/i,
    );
  if (!match) throw Error("Clarification needed. " + REQUEST_HELP);
  const [, name, date, at, from, to, duration] = match;
  const matches = assignments.filter(
    (a) => a.title.toLowerCase() === name.toLowerCase() || a.id === name,
  );
  if (matches.length !== 1)
    throw Error(
      "Clarification needed: name exactly one assignment by its unique title or ID.",
    );
  const minutes = Number(duration);
  const start = `${date}T${at || from}`;
  if (
    !Number.isInteger(minutes) ||
    minutes < 15 ||
    minutes > 240 ||
    !validDate(start)
  )
    throw Error(
      "Clarification needed: use a valid local date/time and a duration of 15–240 minutes.",
    );
  const endDate = new Date(+new Date(start + "Z") + minutes * 60000);
  const exactEnd = `${date}T${String(endDate.getUTCHours()).padStart(2, "0")}:${String(endDate.getUTCMinutes()).padStart(2, "0")}`;
  const end = at ? exactEnd : `${date}T${to}`;
  if (
    !validDate(end) ||
    end <= start ||
    minutesBetween(start, end) < minutes ||
    (at && endDate.toISOString().slice(0, 10) !== date)
  )
    throw Error(
      "Clarification needed: the session must fit its time window on one day using the stated local clock times.",
    );
  return {
    assignmentId: matches[0].id,
    date,
    windowStart: start,
    windowEnd: end,
    durationMinutes: minutes,
    exactStart: !!at,
  };
}
export function validateIntent(
  intent: PlanningIntent,
  proposal: Proposal,
): string[] {
  if (
    !proposal ||
    !Array.isArray(proposal.blocks) ||
    proposal.blocks.length !== 1
  )
    return ["Request requires exactly one study block."];
  const b = proposal.blocks[0];
  if (!b || !validDate(b.start) || !validDate(b.end))
    return ["Proposal has invalid dates."];
  const errors: string[] = [];
  if (b.assignmentId !== intent.assignmentId)
    errors.push("Proposal uses an assignment other than the one requested.");
  if (
    b.start.slice(0, 10) !== intent.date ||
    b.end.slice(0, 10) !== intent.date
  )
    errors.push("Proposal uses a day other than the one requested.");
  if (
    b.start < intent.windowStart ||
    b.end > intent.windowEnd ||
    (intent.exactStart && b.start !== intent.windowStart)
  )
    errors.push("Proposal is outside the requested time window.");
  if (minutesBetween(b.start, b.end) !== intent.durationMinutes)
    errors.push("Proposal does not match the requested duration.");
  return errors;
}
