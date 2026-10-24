import { useEffect, useMemo, useRef, useState } from "react";
import {
  Gem,
  ArrowLeft,
  Plus,
  Download,
  Undo2,
  Layers,
  Check,
  LockKeyhole,
} from "lucide-react";
import { monday, minutesBetween, type State } from "../domain";
import {
  removeBlock,
  setSessionCompleted,
  setBlockLocked,
  toggleAssignment,
} from "../academic";
import { readBackupFile } from "../backup";
import { useWorkspace } from "../useWorkspace";
import { useAcademicEditor } from "../useAcademicEditor";
import { usePlanning } from "../usePlanning";
import { AcademicDialog } from "../components/AcademicDialog";
import { PlanningPanel } from "../components/PlanningPanel";
import { AssignmentList } from "../components/AssignmentList";
import WorldStage from "../world/WorldStage";
import type { WorldArea } from "../world/contract";
import { scheduleOrbs, wallClockNow } from "./adapter";
import "./constellation.css";

export default function ConstellationWorkspace() {
  const workspace = useWorkspace();
  const {
    state,
    save,
    notice,
    setNotice,
    undo,
    restore,
    exportData,
    readOnly,
  } = workspace;
  const [area, setArea] = useState<WorldArea>("week");
  const [graphicsOff, setGraphicsOff] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("unfinished");
  const [assignmentFilter, setAssignmentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(wallClockNow);
  const [week] = useState(monday);
  const file = useRef<HTMLInputElement>(null),
    detail = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null),
    listHeading = useRef<HTMLHeadingElement>(null),
    title = useRef<HTMLHeadingElement>(null);
  function returnFocus() {
    requestAnimationFrame(() => {
      const target = origin.current?.isConnected
        ? origin.current
        : listHeading.current || title.current;
      target?.focus({ preventScroll: window.innerWidth > 1120 });
    });
  }
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    return d;
  });
  const editor = useAcademicEditor(state, save);
  const planning = usePlanning(state, week, save);
  const orbs = useMemo(() => scheduleOrbs(state, now), [state, now]);
  const selectedBlock = state.blocks.find(
    (b) => b.id === selected && b.assignmentId,
  );
  const assignment = state.assignments.find(
    (a) => a.id === selectedBlock?.assignmentId,
  );
  const sessions = state.blocks
    .filter((b) => b.assignmentId)
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  const unfinished = sessions.filter((b) => !b.sessionCompleted);
  const overdue = unfinished.filter((b) => b.end < now).length;
  const filtered = sessions.filter(
    (b) =>
      filter === "all" ||
      (filter === "completed"
        ? b.sessionCompleted
        : filter === "overdue"
          ? !b.sessionCompleted && b.end < now
          : !b.sessionCompleted),
  );
  const lastPage = Math.max(0, Math.ceil(filtered.length / 20) - 1);
  const currentPage = Math.min(page, lastPage);
  useEffect(() => {
    document.title = "Living Schedule · Lumimark";
    const timer = setInterval(() => setNow(wallClockNow()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (selected && !selectedBlock) {
      setSelected(null);
      returnFocus();
    }
  }, [selected, selectedBlock]);
  function select(id: string) {
    origin.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setSelected(id);
    requestAnimationFrame(() =>
      detail.current?.focus({ preventScroll: window.innerWidth > 1120 }),
    );
  }
  async function act(operation: () => State) {
    try {
      await save(operation());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error));
    }
  }
  return (
    <div
      className={`constellation-workspace world-area-${area}${graphicsOff ? " graphics-off" : ""}`}
    >
      <WorldStage
        area={area}
        emphasis={!!selectedBlock}
        disabled={graphicsOff}
        centered={false}
        orbs={orbs}
        selectedOrb={selected}
        onSelectOrb={select}
      />
      <header className="constellation-header">
        <a href="#" className="constellation-back">
          <ArrowLeft size={14} /> Back to planner
        </a>
        <a className="constellation-brand" href="#crystal">
          <Gem size={22} />
          lumimark <span>LIVING SCHEDULE</span>
        </a>
        <button
          onClick={() => setGraphicsOff(!graphicsOff)}
          aria-pressed={graphicsOff}
        >
          <Layers size={15} />
          {graphicsOff ? "Enable graphics" : "Disable graphics"}
        </button>
      </header>
      <nav className="constellation-nav" aria-label="Workspace views">
        {(
          [
            ["week", "Constellation"],
            ["assignments", "Assignments"],
            ["planning", "Planning studio"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            aria-pressed={area === value}
            onClick={() => {
              setArea(value);
              setSelected(null);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="constellation-main">
        <section className="constellation-intro">
          <span className="constellation-eyebrow">
            YOUR WORK, HELD IN LIGHT
          </span>
          <h1 ref={title} tabIndex={-1}>
            A little focus.
            <br />
            <em>A wider universe.</em>
          </h1>
          <p>
            {unfinished.length} unfinished{" "}
            {unfinished.length === 1 ? "session" : "sessions"} · {overdue} past
            scheduled time
          </p>
        </section>
        <section
          className="constellation-rail"
          aria-label="Saved study schedule"
        >
          {readOnly && (
            <p role="alert">
              Read-only: safe saves require Web Locks. You can inspect and
              export your data.
            </p>
          )}
          <div className="constellation-actions">
            <button
              className="primary"
              disabled={readOnly}
              onClick={() => editor.open("block")}
            >
              <Plus size={14} /> Schedule time
            </button>
            <button
              disabled={readOnly}
              onClick={() => editor.open("assignment")}
            >
              New assignment
            </button>
          </div>
          {area === "week" ? (
            <>
              <div className="constellation-section-title">
                <h2 ref={listHeading} tabIndex={-1}>
                  Study sessions
                </h2>
                <span>{sessions.length} SAVED</span>
              </div>
              <label className="constellation-filter">
                Show sessions
                <select
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setPage(0);
                  }}
                >
                  <option value="unfinished">Unfinished</option>
                  <option value="overdue">Past scheduled time</option>
                  <option value="completed">Completed sessions</option>
                  <option value="all">All sessions</option>
                </select>
              </label>
              <p className="constellation-guide">
                Monday–Thursday follow the inner rail; Friday–Sunday follow the
                outer rail. Angle marks the day and time. Larger lights hold
                longer sessions.
              </p>
              <ul
                className="constellation-list"
                aria-label="Study session list"
              >
                {filtered
                  .slice(currentPage * 20, currentPage * 20 + 20)
                  .map((block) => {
                    const a = state.assignments.find(
                      (a) => a.id === block.assignmentId,
                    )!;
                    return (
                      <li key={block.id}>
                        <button
                          data-session-id={block.id}
                          aria-pressed={selected === block.id}
                          onClick={() => select(block.id)}
                        >
                          <i className={`legend ${block.color}`} />
                          <span>
                            <strong>{a.title}</strong>
                            <small>
                              {block.start.replace("T", " · ")} ·{" "}
                              {minutesBetween(block.start, block.end)} min
                            </small>
                            <small>
                              {block.sessionCompleted
                                ? "Session complete"
                                : block.end < now
                                  ? "Past scheduled time · unfinished"
                                  : "Scheduled"}
                              {block.locked ? " · Locked" : ""}
                            </small>
                          </span>
                          <span className="constellation-list-marker">
                            {block.sessionCompleted ? (
                              <Check size={16} />
                            ) : block.locked ? (
                              <LockKeyhole size={14} />
                            ) : (
                              "↗"
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
              </ul>
              {!filtered.length && (
                <p className="constellation-empty">
                  {sessions.length
                    ? "No sessions in this view. Your history is available under All sessions."
                    : "A clear sky. Schedule your first study session to gather its light."}
                </p>
              )}
              {filtered.length > 20 && (
                <div className="constellation-pages">
                  <button
                    disabled={currentPage === 0}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    Previous sessions
                  </button>
                  <span>
                    {currentPage + 1} / {lastPage + 1}
                  </span>
                  <button
                    disabled={currentPage === lastPage}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    Next sessions
                  </button>
                </div>
              )}
            </>
          ) : area === "assignments" ? (
            <AssignmentList
              state={state}
              view="assignments"
              filter={assignmentFilter}
              setFilter={setAssignmentFilter}
              days={days}
              open={editor.open}
              onToggle={(id) => void act(() => toggleAssignment(state, id))}
            />
          ) : (
            <PlanningPanel state={state} planning={planning} />
          )}
          <div className="constellation-backups">
            <button onClick={() => exportData()}>
              <Download size={13} /> Export backup
            </button>
            <button onClick={() => file.current?.click()}>
              Restore backup
            </button>
            <button onClick={undo} disabled={readOnly}>
              <Undo2 size={13} /> Undo last save
            </button>
            <button onClick={() => exportData(true)}>Recovery data</button>
            <button onClick={() => exportData("legacy")}>
              Export pre-migration v2
            </button>
          </div>
          <small className="constellation-local">
            SCHEMA v3 · SAVED ON THIS DEVICE
          </small>
        </section>
        {selectedBlock && assignment && (
          <aside
            className="constellation-detail"
            aria-label="Selected study session"
          >
            <div className="constellation-section-title">
              <span>SELECTED LIGHT</span>
              <button
                aria-label="Close session details"
                onClick={() => {
                  setSelected(null);
                  returnFocus();
                }}
              >
                ×
              </button>
            </div>
            <span className="constellation-eyebrow">{assignment.course}</span>
            <h2 ref={detail} tabIndex={-1}>
              {assignment.title}
            </h2>
            <dl>
              <dt>Date</dt>
              <dd>{selectedBlock.start.slice(0, 10)}</dd>
              <dt>Time</dt>
              <dd>
                {selectedBlock.start.slice(11)}–{selectedBlock.end.slice(11)}
              </dd>
              <dt>Duration</dt>
              <dd>
                {minutesBetween(selectedBlock.start, selectedBlock.end)} minutes
              </dd>
              <dt>Session status</dt>
              <dd>
                {selectedBlock.sessionCompleted
                  ? "Complete"
                  : selectedBlock.end < now
                    ? "Past scheduled time · unfinished"
                    : "Scheduled"}
              </dd>
              <dt>Assignment status</dt>
              <dd>{assignment.completed ? "Complete" : "In progress"}</dd>
              <dt>Schedule lock</dt>
              <dd>{selectedBlock.locked ? "Locked" : "Unlocked"}</dd>
            </dl>
            <p>
              Completing this session records its history. It does not complete
              the assignment or erase the scheduled time.
            </p>
            <div className="constellation-detail-actions">
              <button
                className="primary"
                disabled={readOnly}
                onClick={() =>
                  void act(() =>
                    setSessionCompleted(
                      state,
                      selectedBlock.id,
                      !selectedBlock.sessionCompleted,
                    ),
                  )
                }
              >
                {selectedBlock.sessionCompleted
                  ? "Reopen session"
                  : "Complete session"}
              </button>
              <button
                disabled={
                  readOnly ||
                  selectedBlock.locked ||
                  selectedBlock.sessionCompleted ||
                  assignment.completed
                }
                onClick={() => editor.open("block", selectedBlock)}
              >
                Reschedule session
              </button>
              <button
                disabled={readOnly}
                onClick={() =>
                  void act(() =>
                    setBlockLocked(
                      state,
                      selectedBlock.id,
                      !selectedBlock.locked,
                    ),
                  )
                }
              >
                {selectedBlock.locked ? "Unlock session" : "Lock session"}
              </button>
              <button
                className="danger"
                disabled={readOnly || selectedBlock.locked}
                onClick={() =>
                  void act(() => removeBlock(state, selectedBlock.id))
                }
              >
                Delete session
              </button>
            </div>
          </aside>
        )}
        <p className="constellation-legend">
          One light, one saved session.
          <br />
          Completed work stays in your history. Unfinished work stays visible.
        </p>
      </main>
      <AcademicDialog state={state} days={days} editor={editor} />
      <input
        hidden
        type="file"
        accept=".json,application/json"
        ref={file}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await restore(await readBackupFile(f), state.revision);
          } catch (error) {
            setNotice(error instanceof Error ? error.message : String(error));
          } finally {
            if (file.current) file.current.value = "";
          }
        }}
      />
      {notice && (
        <div role="status" className="constellation-notice">
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
