import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  Gem,
  Sparkles,
  Plus,
  ArrowUpRight,
  MoreHorizontal,
  Download,
  Upload,
  Undo2,
  X,
  Sun,
} from "lucide-react";
import { monday, minutesBetween, floatingDate, localISO } from "./domain";
import { toggleAssignment } from "./academic";
import { useWorkspace } from "./useWorkspace";
import { useAcademicEditor } from "./useAcademicEditor";
import { usePlanning } from "./usePlanning";
import { readBackupFile } from "./backup";
import { READ_ONLY_MESSAGE } from "./storage";
import { CalendarView } from "./components/CalendarView";
import { AssignmentList } from "./components/AssignmentList";
import { PlanningPanel } from "./components/PlanningPanel";
import { AcademicDialog } from "./components/AcademicDialog";
import "./workspace.css";

export default function Workspace({ route }: { route: string }) {
  const {
    state,
    notice,
    setNotice,
    save,
    undo,
    restore,
    exportData,
    readOnly,
  } = useWorkspace();
  const [week, setWeek] = useState(monday);
  const [filter, setFilter] = useState("all");
  const [atmosphere, setAtmosphere] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  const add = useRef<HTMLDetailsElement>(null);
  const tools = useRef<HTMLDetailsElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const assistant = route === "#assistant";
  const view =
    route === "#assignments"
      ? "assignments"
      : route === "#overview"
        ? "overview"
        : "week";
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(week);
    day.setDate(day.getDate() + i);
    return day;
  });
  const editor = useAcademicEditor(state, save);
  const planning = usePlanning(state, week, save);
  const active = state.assignments.filter((a) => !a.completed);
  const hours = state.blocks
    .filter(
      (b) =>
        b.start.slice(0, 10) >= localISO(days[0]) &&
        b.start.slice(0, 10) <= localISO(days[6]),
    )
    .reduce((n, b) => n + minutesBetween(b.start, b.end) / 60, 0);
  const upcoming = active
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 3);
  const weekLabel =
    days[0].toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
    " — " +
    days[6].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  useEffect(() => {
    document.title = `${assistant ? "Assistant" : view === "week" ? "Calendar" : view === "overview" ? "Overview" : "Assignments"} · Lumimark`;
    heading.current?.focus({ preventScroll: true });
    if (add.current) add.current.open = false;
    if (tools.current) tools.current.open = false;
  }, [route, assistant, view]);
  function quick(kind: "assignment" | "block") {
    if (add.current) {
      add.current.open = false;
      add.current.querySelector("summary")?.focus();
    }
    editor.open(kind);
  }
  return (
    <div
      className="luminous"
      data-atmosphere={atmosphere ? "on" : "off"}
      data-area={assistant ? "assistant" : "calendar"}
    >
      <a
        className="workspace-skip"
        href="#workspace-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("workspace-content")?.focus();
        }}
      >
        Skip to workspace
      </a>
      <aside className="orbit-nav">
        <a
          className="orbit-mark"
          href="#calendar"
          aria-label="Lumimark calendar"
        >
          <Gem size={29} />
        </a>
        <nav aria-label="Main navigation">
          <a href="#calendar" aria-current={!assistant ? "page" : undefined}>
            <CalendarDays size={21} />
            <span>Calendar</span>
          </a>
          <a href="#crystal">
            <Gem size={21} />
            <span>Crystal</span>
          </a>
          <a href="#assistant" aria-current={assistant ? "page" : undefined}>
            <Sparkles size={21} />
            <span>Assistant</span>
          </a>
        </nav>
        <span className="orbit-local" title="Saved on this device">
          <i />
          LOCAL
        </span>
      </aside>
      <div className="workspace-shell">
        <header className="workspace-header">
          <a className="workspace-wordmark" href="#calendar">
            lumimark<span>LUMINOUS WORKSPACE</span>
          </a>
          <div className="workspace-header-actions">
            <span className="workspace-status">
              <i /> On this device
            </span>
            <details
              ref={add}
              className="quick-add"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary>
                <Plus size={17} />
                Quick Add
              </summary>
              <div className="workspace-popover">
                <button onClick={() => quick("assignment")}>
                  <Plus size={16} />
                  <span>
                    New assignment<small>Capture what needs doing</small>
                  </span>
                </button>
                <button onClick={() => quick("block")}>
                  <CalendarDays size={16} />
                  <span>
                    Schedule time<small>Make room on your calendar</small>
                  </span>
                </button>
              </div>
            </details>
          </div>
        </header>
        <main id="workspace-content" tabIndex={-1}>
          <section className="workspace-intro">
            <div>
              <p className="workspace-eyebrow">
                {assistant
                  ? "A LITTLE INTELLIGENCE. A CLEARER DIRECTION."
                  : "YOUR TIME, WITH PERSPECTIVE"}
              </p>
              <h1 ref={heading} tabIndex={-1}>
                {assistant
                  ? "Find your next move."
                  : view === "week"
                    ? "Your week, held in light."
                    : view === "overview"
                      ? "A wider perspective."
                      : "Make room for what matters."}
              </h1>
            </div>
            <span className="workspace-tally">
              {active.length} open assignments <span>·</span> {hours.toFixed(1)}
              h this week
            </span>
          </section>
          {readOnly && (
            <p className="workspace-warning" role="status">
              {READ_ONLY_MESSAGE}
            </p>
          )}
          <div className="workspace-toolbar">
            {!assistant ? (
              <nav aria-label="Calendar views" className="workspace-tabs">
                <a
                  href="#calendar"
                  aria-current={view === "week" ? "page" : undefined}
                >
                  Schedule
                </a>
                <a
                  href="#assignments"
                  aria-current={view === "assignments" ? "page" : undefined}
                >
                  Assignments <span>{active.length}</span>
                </a>
                <a
                  href="#overview"
                  aria-current={view === "overview" ? "page" : undefined}
                >
                  Overview
                </a>
              </nav>
            ) : (
              <p className="assistant-caption">
                Local suggestions. Every change is yours to approve.
              </p>
            )}
            <details
              ref={tools}
              className="workspace-tools"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.currentTarget.open = false;
                  e.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary aria-label="Workspace tools">
                <MoreHorizontal size={19} />
                <span>Workspace</span>
              </summary>
              <div className="workspace-popover">
                <button onClick={() => exportData()}>
                  <Download size={16} />
                  Export backup
                </button>
                <button onClick={() => file.current?.click()}>
                  <Upload size={16} />
                  Restore backup
                </button>
                <button onClick={undo}>
                  <Undo2 size={16} />
                  Undo last save
                </button>
                <button onClick={() => exportData(true)}>
                  Export recovery data
                </button>
                <button
                  aria-pressed={!atmosphere}
                  onClick={() => setAtmosphere((v) => !v)}
                >
                  <Sun size={16} />
                  {atmosphere ? "Pause atmosphere" : "Enable atmosphere"}
                </button>
              </div>
            </details>
          </div>
          {assistant ? (
            <div
              className={`workspace-assistant${planning.preview ? " has-proposal" : ""}`}
            >
              <PlanningPanel state={state} planning={planning} compact />
            </div>
          ) : (
            <>
              <section
                className="workspace-surface"
                aria-label={
                  view === "week" ? "Weekly calendar" : "Assignments workspace"
                }
              >
                {view === "week" ? (
                  <CalendarView
                    state={state}
                    week={week}
                    days={days}
                    weekLabel={weekLabel}
                    setWeek={setWeek}
                    open={editor.open}
                  />
                ) : (
                  <AssignmentList
                    state={state}
                    view={view}
                    filter={filter}
                    setFilter={setFilter}
                    days={days}
                    open={editor.open}
                    onToggle={(id) => {
                      void save(toggleAssignment(state, id));
                    }}
                  />
                )}
              </section>
              {view === "week" && (
                <section
                  className="deadline-ribbon"
                  aria-label="Next assignments"
                >
                  <div className="deadline-label">
                    ON YOUR HORIZON
                    <a href="#assignments">
                      All assignments <ArrowUpRight size={13} />
                    </a>
                  </div>
                  {upcoming.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => editor.open("assignment", null, a)}
                    >
                      <span className={`legend ${a.color}`} />
                      <span>
                        <strong>{a.title}</strong>
                        <small>
                          {a.course} ·{" "}
                          {floatingDate(a.dueDate).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                            month: "short",
                            day: "numeric",
                          })}
                        </small>
                      </span>
                    </button>
                  ))}
                  {!upcoming.length && (
                    <p>
                      Clear skies. Add your next assignment when you’re ready.
                    </p>
                  )}
                </section>
              )}
            </>
          )}
          <footer className="workspace-footer">
            <span>One workspace. A little more clarity.</span>
            <span>Schema v3 · Device-local</span>
          </footer>
        </main>
      </div>
      <div className="toast" role="status" hidden={!notice}>
        {notice}
        <button aria-label="Dismiss message" onClick={() => setNotice("")}>
          <X size={15} />
        </button>
      </div>
      <input
        className="hidden"
        type="file"
        aria-label="Restore workspace backup"
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
      <AcademicDialog state={state} days={days} editor={editor} />
    </div>
  );
}
