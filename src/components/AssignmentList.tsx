import { Check, Plus } from "lucide-react";
import {
  localISO,
  floatingDate,
  type State,
  type Block,
  type Assignment,
} from "../domain";
type Props = {
  state: State;
  view: string;
  filter: string;
  setFilter: (filter: string) => void;
  days: Date[];
  open: (
    kind: "assignment" | "block",
    block?: Block | null,
    assignment?: Assignment,
  ) => void;
  onToggle: (id: string) => void;
};
export function AssignmentList({
  state,
  view,
  filter,
  setFilter,
  days,
  open,
  onToggle,
}: Props) {
  const active = state.assignments.filter((a) => !a.completed);
  return (
    <div className="assignment-view">
      <div className="list-heading">
        <h2>
          {view === "overview" ? "Your academic orbit" : "All assignments"}
        </h2>
        <select
          aria-label="Filter assignments"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All assignments</option>
          <option value="open">To do</option>
          <option value="done">Completed</option>
        </select>
      </div>
      {view === "overview" && (
        <div className="overview-metrics">
          <div>
            <strong>
              {state.assignments.filter((a) => a.completed).length}
            </strong>
            <small>Assignments completed</small>
          </div>
          <div>
            <strong>
              {(
                active.reduce((n, a) => n + a.estimatedMinutes, 0) / 60
              ).toFixed(1)}
              h
            </strong>
            <small>Open estimated work</small>
          </div>
          <div>
            <strong>
              {new Set(state.assignments.map((a) => a.course)).size}
            </strong>
            <small>Courses in your orbit</small>
          </div>
        </div>
      )}
      {state.assignments
        .filter(
          (a) =>
            filter === "all" ||
            (filter === "done" ? a.completed : !a.completed),
        )
        .map((a) => (
          <article
            className={`assignment-row ${a.completed ? "completed" : ""}`}
            key={a.id}
          >
            <button
              className="check-box"
              aria-label={`Mark ${a.title} ${a.completed ? "incomplete" : "complete"}`}
              onClick={() => onToggle(a.id)}
            >
              {a.completed && <Check size={14} />}
            </button>
            <div>
              <span className={`course ${a.color}`}>{a.course}</span>
              <h3>{a.title}</h3>
              <small>
                Due{" "}
                {floatingDate(a.dueDate).toLocaleString("en-US", {
                  timeZone: "UTC",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                · {a.estimatedMinutes} min estimated
              </small>
            </div>
            <button
              className="text-button edit-assignment"
              onClick={() => open("assignment", null, a)}
            >
              Edit
            </button>
            <button
              className="icon-button"
              aria-label={`Schedule ${a.title}`}
              onClick={() =>
                open("block", {
                  id: "",
                  title: a.title,
                  assignmentId: a.id,
                  start: `${localISO(days[0])}T15:00`,
                  end: `${localISO(days[0])}T16:00`,
                  color: a.color,
                })
              }
            >
              <Plus size={18} />
            </button>
          </article>
        ))}
      <button className="add-row" onClick={() => open("assignment")}>
        <Plus size={17} />
        Add an assignment
      </button>
    </div>
  );
}
