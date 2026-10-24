import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Plus,
  LayoutGrid,
  BookOpen,
  Download,
  Upload,
  Undo2,
  X,
  ArrowUpRight,
  ShieldCheck,
  Clock3,
  MoreHorizontal,
  Gem,
  ChevronRight,
} from "lucide-react";
import { monday, minutesBetween, floatingDate } from "./domain";
import { toggleAssignment } from "./academic";
import { useWorkspace } from "./useWorkspace";
import { readBackupFile } from "./backup";
import { READ_ONLY_MESSAGE } from "./storage";
import { usePlanning } from "./usePlanning";
import { useAcademicEditor } from "./useAcademicEditor";
import { CalendarView } from "./components/CalendarView";
import { AssignmentList } from "./components/AssignmentList";
import { PlanningPanel } from "./components/PlanningPanel";
import { AcademicDialog } from "./components/AcademicDialog";
import "./style.css";
function App() {
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
  const [view, setView] = useState("week"),
    [week, setWeek] = useState(monday()),
    [filter, setFilter] = useState("all");
  const file = useRef<HTMLInputElement>(null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    return d;
  });
  const editor = useAcademicEditor(state, save);
  const { open } = editor;
  const planning = usePlanning(state, week, save);
  const active = state.assignments.filter((a) => !a.completed);
  const scheduled = state.blocks
    .filter((b) => b.assignmentId)
    .reduce((n, b) => n + minutesBetween(b.start, b.end) / 60, 0);
  const weekLabel =
    days[0].toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
    " - " +
    days[6].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("week");
          }}
        >
          <span className="brand-icon">
            <Gem size={24} />
          </span>
          lumimark<span className="v2">V2</span>
        </a>
        <div className="workspace">
          <span className="avatar">A</span>
          <div>
            My workspace<small>Fall semester · 2026</small>
          </div>
          <MoreHorizontal size={17} />
        </div>
        <div className="nav-label">YOUR SPACE</div>
        <nav>
          <button
            className={view === "week" ? "selected" : ""}
            onClick={() => setView("week")}
          >
            <CalendarDays size={18} />
            My week
            <span className="nav-dot" />
          </button>
          <button
            className={view === "assignments" ? "selected" : ""}
            onClick={() => setView("assignments")}
          >
            <BookOpen size={18} />
            Assignments<span className="count">{active.length}</span>
          </button>
          <button
            className={view === "overview" ? "selected" : ""}
            onClick={() => setView("overview")}
          >
            <LayoutGrid size={18} />
            Overview
          </button>
        </nav>
        <div className="sidebar-note">
          <div className="mini-crystal">◇</div>
          <p>
            A little structure.
            <br />A lot more space.
          </p>
          <small>Make room for what matters.</small>
        </div>
        <div className="side-bottom">
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
          <button onClick={() => exportData(true)}>Export recovery data</button>
          <div className="local-badge">
            <span />
            LOCAL FIRST <ShieldCheck size={13} />
          </div>
          <small>Your plans stay with you.</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>YOUR PERSONAL ORBIT</span>
          <div>
            <span className="saved-dot" />
            Device-local workspace <span className="profile">A</span>
          </div>
        </header>
        <main>
          <section className="heading">
            <div>
              <div className="eyebrow">A CLEARER HEAD STARTS HERE</div>
              <h1>
                {view === "week"
                  ? "Your week, in balance."
                  : view === "assignments"
                    ? "One thing at a time."
                    : "See the bigger picture."}
              </h1>
              <p>A place for your plans. A little space to breathe.</p>
            </div>
            <button className="primary" onClick={() => open("assignment")}>
              <Plus size={17} />
              New assignment
            </button>
          </section>
          {readOnly && (
            <p className="form-help" role="status">
              {READ_ONLY_MESSAGE}
            </p>
          )}
          <section className="summary">
            <div>
              <span className="stat-icon lilac">
                <BookOpen size={18} />
              </span>
              <div>
                <strong>
                  {active.length} <span>assignments</span>
                </strong>
                <small>On your horizon</small>
              </div>
            </div>
            <div>
              <span className="stat-icon mint">
                <Clock3 size={18} />
              </span>
              <div>
                <strong>
                  {scheduled.toFixed(1)} <span>hours planned</span>
                </strong>
                <small>Space for focused work</small>
              </div>
            </div>
            <div className="summary-message">
              <span className="orb-small" />
              <div>
                <strong>Progress has its own rhythm.</strong>
                <small>You don’t have to do it all today.</small>
              </div>
            </div>
          </section>
          <div className="content-grid">
            <section className="planner panel">
              <div className="panel-toolbar">
                <div className="segmented">
                  <button
                    className={view === "week" ? "active" : ""}
                    onClick={() => setView("week")}
                  >
                    Week
                  </button>
                  <button
                    className={view === "assignments" ? "active" : ""}
                    onClick={() => setView("assignments")}
                  >
                    Assignments
                  </button>
                </div>
                <button className="text-button" onClick={() => open("block")}>
                  <Plus size={15} />
                  Schedule time
                </button>
              </div>
              {view === "week" ? (
                <CalendarView
                  state={state}
                  week={week}
                  days={days}
                  weekLabel={weekLabel}
                  setWeek={setWeek}
                  open={open}
                />
              ) : (
                <AssignmentList
                  state={state}
                  view={view}
                  filter={filter}
                  setFilter={setFilter}
                  days={days}
                  open={open}
                  onToggle={(id) => {
                    void save(toggleAssignment(state, id));
                  }}
                />
              )}
            </section>
            <aside className="right-rail">
              <PlanningPanel state={state} planning={planning} />
              <section className="up-next">
                <div className="list-heading">
                  <h2>On the horizon</h2>
                  <span>{active.length} TO DO</span>
                </div>
                {active
                  .slice()
                  .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                  .slice(0, 3)
                  .map((a) => (
                    <button
                      className="horizon-item"
                      key={a.id}
                      onClick={() => setView("assignments")}
                    >
                      <i className={`legend ${a.color}`} />
                      <div>
                        <strong>{a.title}</strong>
                        <small>
                          {a.course} <span>·</span>{" "}
                          {floatingDate(a.dueDate).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })}
                        </small>
                      </div>
                      <ChevronRight size={14} />
                    </button>
                  ))}
                <button
                  className="text-button view-all"
                  onClick={() => setView("assignments")}
                >
                  View all assignments
                  <ArrowUpRight size={14} />
                </button>
              </section>
              <div className="quiet-note">
                A plan is a starting point.
                <br />
                <em>Leave a little room for life.</em>
              </div>
            </aside>
          </div>
          <div className="mobile-recovery">
            <button onClick={() => exportData()}>
              <Download size={14} />
              Export
            </button>
            <button onClick={() => file.current?.click()}>
              <Upload size={14} />
              Restore
            </button>
            <button onClick={undo}>
              <Undo2 size={14} />
              Undo
            </button>
            <button onClick={() => exportData(true)}>Recovery</button>
          </div>
          <footer>
            DESIGNED FOR A LITTLE MORE CLARITY.
            <span>
              <span className="saved-dot" />
              Schema v3 · Saved locally
            </span>
          </footer>
        </main>
      </div>
      <div className="toast" role="status" hidden={!notice}>
        {notice}
        <button aria-label="Dismiss message" onClick={() => setNotice("")}>
          <X size={14} />
        </button>
      </div>
      <input
        className="hidden"
        type="file"
        accept=".json,application/json"
        ref={file}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await restore(await readBackupFile(f), state.revision);
          } catch (e) {
            setNotice(e instanceof Error ? e.message : String(e));
          } finally {
            if (file.current) file.current.value = "";
          }
        }}
      />
      <AcademicDialog state={state} days={days} editor={editor} />
    </div>
  );
}
const CrystalWorkspace = lazy(() => import("./demo/CrystalWorkspace"));
const ConstellationWorkspace = lazy(
  () => import("./constellation/ConstellationWorkspace"),
);
function Entry() {
  const [route, setRoute] = useState(() => location.hash);
  useEffect(() => {
    const update = () => setRoute(location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const world = route === "#world" || route === "#demo";
  return route === "#crystal" ? (
    <Suspense fallback={<p role="status">Opening your constellation…</p>}>
      <ConstellationWorkspace />
    </Suspense>
  ) : route.startsWith("#auditions") || world ? (
    <Suspense fallback={<p role="status">Opening Lumen World…</p>}>
      <CrystalWorkspace />
    </Suspense>
  ) : (
    <>
      <App />
      <a
        href="#crystal"
        style={{
          position: "fixed",
          bottom: 8,
          right: 16,
          zIndex: 20,
          fontSize: 11,
          padding: "7px 12px",
          background: "#17272e",
          color: "#dfeae7",
          border: "1px solid #69857b",
          borderRadius: 4,
        }}
      >
        Enter the crystal world ↗
      </a>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Entry />
  </React.StrictMode>,
);
