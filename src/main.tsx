import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Sparkles,
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
} from "lucide-react";
import {
  type State,
  type Assignment,
  type Block,
  type Proposal,
  KEY,
  seed,
  monday,
  localISO,
  parseState,
  validateProposal,
  commit,
} from "./domain";
import { loadModel, propose, cancelInference, MODEL_INFO } from "./ai";
import "./style.css";
function App() {
  const initial = useRef<{ state: State; error: string }>(
    (() => {
      try {
        const raw = localStorage.getItem(KEY);
        return { state: raw ? parseState(raw) : seed(), error: "" };
      } catch {
        return {
          state: seed(),
          error:
            "Saved data could not be read. Your original data is preserved; export it before saving new changes.",
        };
      }
    })(),
  );
  const [state, setState] = useState(initial.current.state),
    [notice, setNotice] = useState(initial.current.error),
    [view, setView] = useState("week"),
    [week, setWeek] = useState(monday()),
    [modal, setModal] = useState<"assignment" | "block" | null>(null),
    [editing, setEditing] = useState<Block | null>(null),
    [history, setHistory] = useState<State | null>(null),
    [filter, setFilter] = useState("all");
  const [editAssignment, setEditAssignment] = useState<Assignment | null>(null);
  const [formError, setFormError] = useState("");
  const [aiStatus, setAIStatus] = useState("Model not loaded"),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [request, setRequest] = useState(
      "Find time for my remaining assignments this week. Keep my evenings free.",
    ),
    [preview, setPreview] = useState<{
      proposal: Proposal;
      revision: number;
      latency: number;
    } | null>(null);
  const file = useRef<HTMLInputElement>(null),
    dialog = useRef<HTMLDialogElement>(null);
  const lastSavedRaw = useRef<string | null>(null);
  const storageObserved = useRef(false);
  if (!storageObserved.current) {
    try {
      lastSavedRaw.current = localStorage.getItem(KEY);
    } catch {
      /* save reports unavailable storage */
    }
    storageObserved.current = true;
  }
  const save = (next: State) => {
    try {
      parseState(JSON.stringify(next));
      const updated = commit(state, next);
      const stored = localStorage.getItem(KEY);
      if (stored !== lastSavedRaw.current) {
        setNotice(
          "This workspace changed in another tab. Reload before saving.",
        );
        return false;
      }
      if (stored) {
        let valid = true;
        try {
          parseState(stored);
        } catch {
          valid = false;
        }
        if (!valid) {
          const previous = localStorage.getItem(KEY + ".recovery");
          if (previous && previous !== stored)
            localStorage.setItem(KEY + ".recovery." + Date.now(), previous);
          localStorage.setItem(KEY + ".recovery", stored);
        }
      }
      localStorage.setItem(KEY + ".rollback", JSON.stringify(state));
      localStorage.setItem(KEY, JSON.stringify(updated));
      lastSavedRaw.current = JSON.stringify(updated);
      setHistory(state);
      setState(updated);
      setNotice("Saved on this device");
      return true;
    } catch {
      setNotice(
        "Storage is unavailable or full. Changes were not saved. Export a backup to protect your work.",
      );
      return false;
    }
  };
  const undo = () => {
    try {
      const old =
        history || parseState(localStorage.getItem(KEY + ".rollback") || "");
      if (save(old)) {
        setHistory(null);
        setNotice("Previous save restored");
      }
    } catch {
      setNotice("No previous save is available.");
    }
  };
  const exportData = (recovery = false) => {
    let raw: string | null = null;
    try {
      raw = recovery
        ? localStorage.getItem(KEY + ".recovery") ||
          (initial.current.error ? localStorage.getItem(KEY) : null)
        : null;
    } catch {
      /* export visible state if storage is unavailable */
    }
    if (recovery && !raw) {
      setNotice("No unreadable recovery data is available.");
      return;
    }
    const url = URL.createObjectURL(
      new Blob([raw || JSON.stringify(state, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `homebase-${recovery ? "recovery" : "backup"}-${localISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const open = (
    kind: "assignment" | "block",
    block: Block | null = null,
    assignment: Assignment | null = null,
  ) => {
    setFormError("");
    setEditAssignment(assignment);
    setEditing(block);
    setModal(kind);
    dialog.current?.showModal();
  };
  const close = () => {
    dialog.current?.close();
    setModal(null);
  };
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week);
    d.setDate(d.getDate() + i);
    return d;
  });
  const active = state.assignments.filter((a) => !a.completed),
    scheduled = state.blocks
      .filter((b) => b.assignmentId)
      .reduce(
        (n, b) => n + (+new Date(b.end) - +new Date(b.start)) / 3600000,
        0,
      );
  const weekLabel =
    days[0].toLocaleDateString("en-US", { month: "long", day: "numeric" }) +
    " – " +
    days[6].toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  const issues = preview ? validateProposal(state, preview.proposal) : [];
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (modal === "assignment") {
      const a: Assignment = {
        id: editAssignment?.id || crypto.randomUUID(),
        title: String(f.get("title")).trim(),
        course: String(f.get("course")).trim(),
        dueDate: String(f.get("due")),
        estimatedMinutes: Number(f.get("minutes")),
        completed: editAssignment?.completed || false,
        color: String(f.get("color")),
      };
      if (
        !a.title ||
        !a.course ||
        !Number.isInteger(a.estimatedMinutes) ||
        a.estimatedMinutes < 15
      )
        return;
      const linked = state.blocks.filter((b) => b.assignmentId === a.id);
      if (
        linked.some((b) => b.end > a.dueDate) ||
        linked.reduce(
          (n, b) => n + (+new Date(b.end) - +new Date(b.start)) / 60000,
          0,
        ) > a.estimatedMinutes
      ) {
        setFormError(
          "Scheduled work exceeds this deadline or estimate. Adjust its time blocks first.",
        );
        return;
      }
      if (
        save({
          ...state,
          assignments: [...state.assignments.filter((x) => x.id !== a.id), a],
          blocks: state.blocks.map((b) =>
            b.assignmentId === a.id
              ? { ...b, title: a.title, color: a.color }
              : b,
          ),
        })
      )
        close();
    } else {
      const a = state.assignments.find((a) => a.id === f.get("assignment"));
      const start = String(f.get("start")),
        end = String(f.get("end"));
      const base = {
        ...state,
        blocks: state.blocks.filter((b) => b.id !== editing?.id),
      };
      const errors = a
        ? validateProposal(base, {
            summary: "Manual block",
            blocks: [{ assignmentId: a.id, start, end }],
          })
        : !start || !end || end <= start
          ? ["End must be after start."]
          : base.blocks.some((b) => start < b.end && end > b.start)
            ? ["This time overlaps another event."]
            : [];
      if (errors.length) {
        setFormError(errors.join(" "));
        return;
      }
      const b: Block = {
        id: editing?.id || crypto.randomUUID(),
        assignmentId: a?.id,
        title: a?.title || String(f.get("title")).trim(),
        start,
        end,
        color: a?.color || "blue",
      };
      if (!b.title) {
        setFormError("Enter an event title.");
        return;
      }
      if (b.start.slice(0, 10) !== b.end.slice(0, 10)) {
        setFormError("Create separate events for each day.");
        return;
      }
      if (save({ ...state, blocks: [...base.blocks, b] })) close();
    }
  };
  async function plan() {
    setBusy(true);
    setPreview(null);
    setAIStatus("Planning on your device…");
    try {
      const p = await propose(
        { ...state, assignments: active, weekStart: localISO(week) },
        request,
      );
      setPreview({
        proposal: p,
        revision: state.revision,
        latency: p.latencyMs,
      });
      setAIStatus("Proposal ready for review");
    } catch (e) {
      setAIStatus(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }
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
          homebase<span className="v2">V2</span>
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
                <>
                  <div className="calendar-toolbar">
                    <div>
                      <h2>{weekLabel}</h2>
                      <small>Every commitment, a little more considered.</small>
                    </div>
                    <div className="date-nav">
                      <button
                        aria-label="Previous week"
                        onClick={() => {
                          const d = new Date(week);
                          d.setDate(d.getDate() - 7);
                          setWeek(d);
                        }}
                      >
                        <ChevronLeft size={17} />
                      </button>
                      <button onClick={() => setWeek(monday())}>Today</button>
                      <button
                        aria-label="Next week"
                        onClick={() => {
                          const d = new Date(week);
                          d.setDate(d.getDate() + 7);
                          setWeek(d);
                        }}
                      >
                        <ChevronRight size={17} />
                      </button>
                    </div>
                  </div>
                  <div
                    className="calendar-scroll"
                    ref={(el) => {
                      if (el && !el.dataset.ready) {
                        el.scrollTop = 512;
                        el.dataset.ready = "1";
                      }
                    }}
                  >
                    <div className="calendar">
                      <div className="day-head">
                        <span className="timezone">LOCAL</span>
                        {days.map((d) => (
                          <div
                            key={localISO(d)}
                            className={
                              localISO(d) === localISO(new Date())
                                ? "today"
                                : ""
                            }
                          >
                            <small>
                              {d.toLocaleDateString("en-US", {
                                weekday: "short",
                              })}
                            </small>
                            <b>{d.getDate()}</b>
                          </div>
                        ))}
                      </div>
                      <div className="calendar-body">
                        <div className="times">
                          {Array.from({ length: 24 }, (_, i) => (
                            <span key={i}>
                              {i % 12 || 12}
                              <small>{i >= 12 ? "PM" : "AM"}</small>
                            </span>
                          ))}
                        </div>
                        {days.map((d) => (
                          <div className="day-column" key={localISO(d)}>
                            {Array.from({ length: 24 }, (_, i) => (
                              <button
                                className="empty-slot"
                                key={i}
                                aria-label={`Schedule ${localISO(d)} at ${i}:00`}
                                onClick={() =>
                                  open("block", {
                                    id: "",
                                    title: "",
                                    start: `${localISO(d)}T${String(i).padStart(2, "0")}:00`,
                                    end: `${localISO(d)}T${i === 23 ? "23:59" : String(i + 1).padStart(2, "0") + ":00"}`,
                                    color: "blue",
                                  })
                                }
                              />
                            ))}
                            {state.blocks
                              .filter((b) => b.start.startsWith(localISO(d)))
                              .map((b) => {
                                const date = new Date(b.start);
                                const top =
                                  ((date.getHours() * 60 + date.getMinutes()) /
                                    60) *
                                  64;
                                const height =
                                  ((+new Date(b.end) - +date) / 3600000) * 64;
                                return (
                                  <button
                                    key={b.id}
                                    className={`event ${b.color}`}
                                    style={{
                                      top: Math.max(0, top),
                                      height: Math.max(30, height),
                                    }}
                                    onClick={() => open("block", b)}
                                  >
                                    <small>
                                      {b.assignmentId ? "FOCUS TIME" : "CLASS"}
                                    </small>
                                    <strong>{b.title}</strong>
                                    <span>
                                      {date.toLocaleTimeString("en-US", {
                                        hour: "numeric",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  </button>
                                );
                              })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="calendar-footer">
                    <span>
                      <i className="legend lilac" />
                      Psychology
                    </span>
                    <span>
                      <i className="legend mint" />
                      Mathematics
                    </span>
                    <span>
                      <i className="legend peach" />
                      Literature
                    </span>
                    <span>
                      <i className="legend blue" />
                      Biology
                    </span>
                  </div>
                </>
              ) : (
                <div className="assignment-view">
                  <div className="list-heading">
                    <h2>
                      {view === "overview"
                        ? "Your academic orbit"
                        : "All assignments"}
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
                            active.reduce((n, a) => n + a.estimatedMinutes, 0) /
                            60
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
                          onClick={() =>
                            save({
                              ...state,
                              assignments: state.assignments.map((x) =>
                                x.id === a.id
                                  ? { ...x, completed: !x.completed }
                                  : x,
                              ),
                            })
                          }
                        >
                          {a.completed && <Check size={14} />}
                        </button>
                        <div>
                          <span className={`course ${a.color}`}>
                            {a.course}
                          </span>
                          <h3>{a.title}</h3>
                          <small>
                            Due{" "}
                            {new Date(a.dueDate).toLocaleString("en-US", {
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
                  <button
                    className="add-row"
                    onClick={() => open("assignment")}
                  >
                    <Plus size={17} />
                    Add an assignment
                  </button>
                </div>
              )}
            </section>
            <aside className="right-rail">
              <section className="ai-panel panel">
                <div className="ai-top">
                  <span className="spark-icon">
                    <Sparkles size={18} />
                  </span>
                  <span>Intelligence, in your corner.</span>
                  <span className="beta">LAB</span>
                </div>
                <div className="crystal-scene" aria-hidden="true">
                  <div className="halo" />
                  <div className="crystal c1" />
                  <div className="crystal c2" />
                  <div className="crystal c3" />
                  <div className="crystal-floor" />
                </div>
                <h2>Find your flow.</h2>
                <p>
                  Explore a plan with experimental local AI.
                  <br />
                  Check every proposed time before approving.
                </p>
                <label className="sr-only" htmlFor="request">
                  Planning request
                </label>
                <textarea
                  id="request"
                  value={request}
                  maxLength={1500}
                  onChange={(e) => setRequest(e.target.value)}
                />
                <div className="ai-status" role="status">
                  {aiStatus}
                </div>
                {!ready ? (
                  <button
                    disabled={loading}
                    className="ai-button"
                    onClick={async () => {
                      setLoading(true);
                      try {
                        const result = await loadModel(setAIStatus);
                        setReady(true);
                        setAIStatus(
                          `Ready · loaded in ${(result.loadMs / 1000).toFixed(1)}s`,
                        );
                      } catch (e) {
                        setAIStatus(e instanceof Error ? e.message : String(e));
                      } finally {
                        setLoading(false);
                      }
                    }}
                  >
                    <Sparkles size={16} />
                    {loading ? "Loading local model…" : "Enable on-device AI"}
                    <ArrowUpRight size={16} />
                  </button>
                ) : (
                  <button disabled={busy} className="ai-button" onClick={plan}>
                    <Sparkles size={16} />
                    {busy ? "Thinking locally…" : "Propose a plan"}
                    <ArrowUpRight size={16} />
                  </button>
                )}
                {busy && (
                  <button
                    className="text-button"
                    onClick={() => {
                      cancelInference();
                      setAIStatus("Cancel requested");
                    }}
                  >
                    Cancel planning
                  </button>
                )}
                <div className="privacy">
                  <ShieldCheck size={13} />
                  <span>On your device. Under your control.</span>
                </div>
                <details>
                  <summary>Model & compatibility</summary>
                  <p>
                    Qwen2.5 1.5B · {MODEL_INFO.parameters} parameters.
                    Approximately {MODEL_INFO.estimatedDownloadMB} MB download.
                    Requires WebGPU with shader-f16 and HTTPS or localhost. The
                    first load downloads model files; requests run locally.
                    Manual planning works independently.
                  </p>
                </details>
              </section>
              {preview && (
                <section className="proposal panel">
                  <div className="list-heading">
                    <h2>Review proposed time</h2>
                    <button
                      className="icon-button"
                      aria-label="Dismiss proposal"
                      onClick={() => setPreview(null)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <p>{preview.proposal.summary}</p>
                  <small>
                    {(preview.latency / 1000).toFixed(1)}s inference ·{" "}
                    {preview.proposal.blocks.length} proposed blocks
                  </small>
                  {preview.proposal.blocks.map((b, i) => (
                    <div className="proposal-block" key={i}>
                      <strong>
                        {state.assignments.find((a) => a.id === b.assignmentId)
                          ?.title || "Unknown assignment"}
                      </strong>
                      <small>
                        {b.start.replace("T", " ")} → {b.end.slice(11)}
                      </small>
                    </div>
                  ))}
                  {issues.map((i) => (
                    <p className="error" key={i}>
                      {i}
                    </p>
                  ))}
                  {preview.revision !== state.revision && (
                    <p className="error">
                      Your plan changed. Generate a new proposal.
                    </p>
                  )}
                  <button
                    className="primary"
                    disabled={
                      issues.length > 0 || preview.revision !== state.revision
                    }
                    onClick={() => {
                      if (
                        preview.revision !== state.revision ||
                        validateProposal(state, preview.proposal).length
                      )
                        return;
                      const blocks = preview.proposal.blocks.map((b) => {
                        const a = state.assignments.find(
                          (a) => a.id === b.assignmentId,
                        )!;
                        return {
                          ...b,
                          id: crypto.randomUUID(),
                          title: a.title,
                          color: a.color,
                        };
                      });
                      if (
                        save({ ...state, blocks: [...state.blocks, ...blocks] })
                      ) {
                        setPreview(null);
                        setNotice(
                          "Approved study blocks added. Undo is available.",
                        );
                      }
                    }}
                  >
                    <Check size={16} />
                    Approve changes
                  </button>
                </section>
              )}
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
                          {new Date(a.dueDate).toLocaleDateString("en-US", {
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
              Schema v2 · Saved locally
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
            if (f.size > 5_000_000)
              throw Error("Backup is too large (5 MB limit).");
            const imported = parseState(await f.text());
            if (save(imported))
              setNotice("Backup restored. Undo last save is available.");
          } catch (e) {
            setNotice(e instanceof Error ? e.message : String(e));
          } finally {
            if (file.current) file.current.value = "";
          }
        }}
      />
      <dialog
        aria-labelledby="dialog-title"
        ref={dialog}
        onCancel={() => setModal(null)}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MAKE A LITTLE SPACE</span>
            <h2 id="dialog-title">
              {modal === "assignment"
                ? editAssignment
                  ? "Edit assignment"
                  : "New assignment"
                : editing?.id
                  ? "Edit scheduled time"
                  : "Schedule time"}
            </h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={close}
          >
            <X size={20} />
          </button>
        </div>
        <form
          key={
            modal + (editAssignment?.id || editing?.id || editing?.start || "")
          }
          onSubmit={submit}
        >
          {modal === "assignment" ? (
            <>
              <label>
                Assignment title
                <input
                  name="title"
                  required
                  maxLength={120}
                  placeholder="What are you working on?"
                  defaultValue={editAssignment?.title}
                  autoFocus
                />
              </label>
              <label>
                Course
                <input
                  name="course"
                  required
                  maxLength={40}
                  placeholder="e.g. PSY 204"
                  defaultValue={editAssignment?.course}
                />
              </label>
              <label>
                Due date & time
                <input
                  type="datetime-local"
                  name="due"
                  required
                  defaultValue={
                    editAssignment?.dueDate || `${localISO(days[4])}T17:00`
                  }
                />
              </label>
              <div className="form-grid">
                <label>
                  Estimated minutes
                  <input
                    type="number"
                    name="minutes"
                    required
                    defaultValue={editAssignment?.estimatedMinutes || 60}
                    min={15}
                    max={10080}
                    step={15}
                  />
                </label>
                <label>
                  Color
                  <select
                    name="color"
                    defaultValue={editAssignment?.color || "lilac"}
                  >
                    <option value="lilac">Amethyst</option>
                    <option value="mint">Sea glass</option>
                    <option value="peach">Rose quartz</option>
                    <option value="blue">Aquamarine</option>
                  </select>
                </label>
              </div>
            </>
          ) : (
            <>
              <label>
                Assignment
                <select
                  name="assignment"
                  defaultValue={editing?.assignmentId || ""}
                >
                  <option value="">Personal / class event</option>
                  {state.assignments
                    .filter(
                      (a) => !a.completed || a.id === editing?.assignmentId,
                    )
                    .map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.title}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Event title (for personal / class events)
                <input
                  name="title"
                  maxLength={120}
                  defaultValue={editing?.title || "Study time"}
                  required
                />
              </label>
              <label>
                Start
                <input
                  type="datetime-local"
                  name="start"
                  required
                  defaultValue={editing?.start || `${localISO(days[0])}T15:00`}
                />
              </label>
              <label>
                End
                <input
                  type="datetime-local"
                  name="end"
                  required
                  defaultValue={editing?.end || `${localISO(days[0])}T16:00`}
                />
              </label>
              <p className="form-help">
                Conflicts and assignment deadlines are checked before saving.
              </p>
            </>
          )}
          {formError && (
            <p role="alert" className="error">
              {formError}
            </p>
          )}
          <div className="modal-actions">
            {editing?.id && (
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (
                    save({
                      ...state,
                      blocks: state.blocks.filter((b) => b.id !== editing.id),
                    })
                  )
                    close();
                }}
              >
                Remove event
              </button>
            )}
            <button type="button" className="text-button" onClick={close}>
              Cancel
            </button>
            <button className="primary" type="submit">
              {modal === "assignment"
                ? editAssignment
                  ? "Save assignment"
                  : "Add assignment"
                : "Save time"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
