import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Gem,
  Layers3,
  Maximize2,
  Sparkles,
  X,
} from "lucide-react";
import {
  assignments,
  days,
  events,
  type Assignment,
  type Workflow,
} from "./fixtures";
import "./demo.css";
import WorldStage from "../world/WorldStage";

export default function CrystalWorkspace() {
  const [view, setView] = useState<Workflow>("week");
  const [selected, setSelected] = useState<Assignment>(assignments[0]);
  const [detail, setDetail] = useState(false);
  const [filter, setFilter] = useState("All");
  const [proposal, setProposal] = useState<"idle" | "preview" | "approved">(
    "idle",
  );
  const [quiet, setQuiet] = useState(false);
  const [status, setStatus] = useState("");
  const [immersive, setImmersive] = useState(false);
  const main = useRef<HTMLElement>(null);
  const detailClose = useRef<HTMLButtonElement>(null);
  const planAction = useRef<HTMLButtonElement>(null);
  const proposalTitle = useRef<HTMLHeadingElement>(null);
  const previousProposal = useRef(proposal);
  useEffect(() => {
    if (previousProposal.current !== proposal) {
      if (proposal === "idle") planAction.current?.focus();
      else proposalTitle.current?.focus();
    }
    previousProposal.current = proposal;
  }, [proposal]);
  useEffect(() => {
    if (!detail) return;
    const origin = document.activeElement;
    detailClose.current?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDetail(false);
    };
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("keydown", escape);
      if (origin instanceof HTMLElement && origin.isConnected) origin.focus();
    };
  }, [detail]);
  useEffect(() => {
    const previous = document.title;
    document.title = "Lumen World · Lumimark";
    return () => {
      document.title = previous;
    };
  }, []);
  function openAssignment(item: Assignment) {
    setSelected(item);
    setDetail(true);
  }
  function navigate(next: Workflow) {
    setView(next);
    setDetail(false);
    main.current?.focus();
  }
  const nav = (
    <nav className="au-nav" aria-label="Demo workflows">
      {(
        [
          ["week", CalendarDays, "My week"],
          ["assignments", BookOpen, "Assignments"],
          ["planning", Sparkles, "Planning studio"],
        ] as const
      ).map(([key, Icon, label], i) => (
        <button
          key={key}
          aria-current={view === key ? "page" : undefined}
          onClick={() => navigate(key)}
        >
          <span className="au-nav-number">0{i + 1}</span>
          <Icon size={17} />
          <span>{label}</span>
          {key === "assignments" && <b>04</b>}
        </button>
      ))}
    </nav>
  );
  const calendar = (
    <section className="au-calendar au-surface" aria-label="Weekly calendar">
      <div className="au-section-head">
        <div>
          <span className="au-kicker">YOUR TIME, CONSIDERED</span>
          <h2>
            October 19–25 <span>2026</span>
          </h2>
        </div>
        <span className="au-week-label">
          WEEK 43 <CalendarDays size={15} />
        </span>
      </div>
      <div className="au-calendar-scroll">
        <div className="au-calendar-inner">
          <div className="au-day-head">
            <span>GMT−4</span>
            {days.map((day, i) => (
              <div key={day} className={i === 1 ? "au-today" : ""}>
                <span>{day}</span>
                <b>{19 + i}</b>
              </div>
            ))}
          </div>
          <div className="au-time-grid">
            <div className="au-times">
              {Array.from({ length: 9 }, (_, i) => (
                <span key={i}>{String(8 + i).padStart(2, "0")}:00</span>
              ))}
            </div>
            <div className="au-days">
              {days.map((day, i) => (
                <div className="au-day-column" key={day}>
                  {events
                    .filter((e) => e.day === i)
                    .map((e) => (
                      <button
                        key={e.id}
                        className={`au-event ${e.color}`}
                        style={{
                          top: `${(e.hour - 8) * 60}px`,
                          height: `${e.duration * 60 - 7}px`,
                        }}
                        onClick={() => {
                          const item = assignments.find((a) =>
                            e.label.includes(a.course),
                          )!;
                          openAssignment(item);
                        }}
                      >
                        <span>{String(e.hour).padStart(2, "0")}:00</span>
                        <strong>{e.title}</strong>
                        <small>{e.label}</small>
                      </button>
                    ))}
                  {proposal === "approved" && i === 1 && (
                    <button
                      className="au-event blue au-demo-event"
                      style={{ top: 420, height: 83 }}
                      onClick={() => openAssignment(assignments[1])}
                    >
                      <span>15:00 · DEMO</span>
                      <strong>Problem set 04</strong>
                      <small>Approved focus time</small>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="au-calendar-foot">
        <span>
          <i className="au-dot lavender" /> Psychology
        </span>
        <span>
          <i className="au-dot blue" /> Mathematics
        </span>
        <span>
          <i className="au-dot peach" /> Literature
        </span>
        <span>
          <i className="au-dot green" /> Biology
        </span>
        <span className="au-foot-note">Select a session to explore</span>
      </div>
    </section>
  );
  const assignmentList = (
    <section
      className="au-assignments au-surface"
      aria-label="Assignment overview"
    >
      <div className="au-section-head">
        <div>
          <span className="au-kicker">SMALL STEPS, REAL PROGRESS</span>
          <h2>
            On the horizon <span>04</span>
          </h2>
        </div>
        <BookOpen size={21} />
      </div>
      <div className="au-filters" aria-label="Filter assignments">
        {["All", "High", "Medium", "Low"].map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {f === "All" ? "All assignments" : `${f} priority`}
          </button>
        ))}
      </div>
      <div className="au-assignment-list">
        {assignments
          .filter((a) => filter === "All" || a.priority === filter)
          .map((a) => (
            <button
              key={a.id}
              className={`au-assignment ${a.color}`}
              onClick={() => openAssignment(a)}
            >
              <span className="au-course-icon">
                <BookOpen size={20} />
              </span>
              <span className="au-assignment-title">
                <small>
                  {a.course} / {a.category}
                </small>
                <strong>{a.title}</strong>
                <span>{a.due}</span>
              </span>
              <span className="au-progress">
                <span>{a.progress}% complete</span>
                <i>
                  <b style={{ width: `${a.progress}%` }} />
                </i>
              </span>
              <span className="au-priority">{a.priority}</span>
              <ChevronRight size={18} />
            </button>
          ))}
      </div>
    </section>
  );
  const planning = (
    <section
      className="au-planning au-surface"
      aria-label="Demonstration planning studio"
    >
      <span className="au-kicker">
        <Sparkles size={14} /> THE PLANNING STUDIO
      </span>
      <h2>
        A little perspective.
        <br />
        <em>A better next step.</em>
      </h2>
      <p>
        Make space for the work that matters. Explore a considered plan before
        making it yours.
      </p>
      <label htmlFor="au-request">Your intention</label>
      <textarea
        id="au-request"
        value={"Find 90 minutes for Problem set 04 on Tuesday afternoon."}
        readOnly
      />
      <div className="au-demo-note">
        <Layers3 size={14} /> Scripted visual demo · no model runs
      </div>
      {proposal === "idle" ? (
        <button
          ref={planAction}
          className="au-action"
          onClick={() => {
            setProposal("preview");
            setStatus("Demo proposal ready for your review.");
          }}
        >
          Explore a plan <ArrowRight size={17} />
        </button>
      ) : (
        <div className="au-proposal">
          <div className="au-proposal-top">
            <span>
              <i className="au-dot blue" />
              {proposal === "approved"
                ? "DEMO PLAN ADDED"
                : "PROPOSED FOCUS TIME"}
            </span>
            <Check size={17} />
          </div>
          <h3 ref={proposalTitle} tabIndex={-1}>
            Problem set 04
          </h3>
          <p>
            Tuesday, October 20
            <br />
            <strong>15:00–16:30 · 90 minutes</strong>
          </p>
          <ul>
            <li>Fits around your classes</li>
            <li>Finishes before Friday’s deadline</li>
            <li>Keeps your morning open</li>
          </ul>
          {proposal === "preview" ? (
            <div className="au-proposal-actions">
              <button
                className="au-action"
                onClick={() => {
                  setProposal("approved");
                  setStatus(
                    "Added to the demo calendar only. Your saved planner is unchanged.",
                  );
                }}
              >
                Approve demo plan <Check size={16} />
              </button>
              <button
                onClick={() => {
                  setProposal("idle");
                  setStatus("Demo proposal discarded.");
                }}
              >
                Discard
              </button>
            </div>
          ) : (
            <>
              <p className="au-demo-confirmation">
                Added to this demo only. No saved data changed.
              </p>
              <button className="au-action" onClick={() => navigate("week")}>
                See it in your week <ArrowRight size={16} />
              </button>
              <button
                className="au-reset"
                onClick={() => {
                  setProposal("idle");
                  setStatus("Demo plan reset.");
                }}
              >
                Reset demo
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
  return (
    <div
      className={`crystal-workspace au-world crystal-world world-area-${view}${quiet ? " au-quiet" : ""}${immersive ? " world-immersive" : ""}`}
    >
      <a
        className="au-skip"
        href="#au-workspace"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
          main.current?.scrollIntoView({ block: "start" });
        }}
      >
        Skip to workspace
      </a>
      <WorldStage
        area={view}
        emphasis={detail || proposal === "preview"}
        disabled={quiet}
        centered={immersive}
      />
      <div className="world-toolbar">
        <a href="#" className="au-return">
          <ArrowLeft size={14} /> Back to planner
        </a>
        <div className="world-mode-bar">
          <span>LUMEN WORLD / DEMO</span>
          <button
            aria-pressed={immersive}
            onClick={() => setImmersive(!immersive)}
          >
            {immersive ? "Show workbench" : "Explore the crystal"}
          </button>
        </div>
        <button
          className="au-performance"
          aria-pressed={quiet}
          onClick={() => setQuiet(!quiet)}
        >
          <Layers3 size={14} />
          {quiet ? "Enable graphics" : "Disable graphics"}
        </button>
      </div>
      <div className="au-shell">
        <header className="au-header">
          <a
            href="#crystal"
            className="au-brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("week");
            }}
          >
            <Gem size={27} />
            <span>
              lumimark
              <small>LUMEN WORLD / DEMO</small>
            </span>
          </a>
          {nav}
          <div className="au-profile">
            <span className="au-presence" /> Demo workspace <b>AL</b>
          </div>
        </header>
        <main id="au-workspace" ref={main} tabIndex={-1}>
          <section className="au-hero">
            <div>
              <span className="au-kicker">
                A DIFFERENT FACET OF YOUR DAY <span className="au-title-rule" />{" "}
                FALL SEMESTER 2026
              </span>
              <h1>
                {view === "planning"
                  ? "Find your next possibility."
                  : view === "assignments"
                    ? "Ideas, taking shape."
                    : "Time, in a new light."}
              </h1>
              <p>One world. A new perspective on what matters.</p>
            </div>
          </section>
          <div className={`au-workflows au-view-${view}`} key={view}>
            <div className="au-primary">
              {view === "week"
                ? calendar
                : view === "assignments"
                  ? assignmentList
                  : planning}
            </div>
          </div>
          <footer className="au-footer">
            <span>
              <span className="au-presence" /> DEMONSTRATION · FIXTURE DATA ONLY
            </span>
            <span>
              Lumen World / Three perspectives, one place{" "}
              <ArrowDown size={12} />
            </span>
          </footer>
        </main>
      </div>
      {detail && (
        <section
          className="au-detail au-surface"
          aria-label="Assignment details"
        >
          <div className="au-detail-header">
            <span className="au-kicker">ASSIGNMENT / {selected.course}</span>
            <button
              ref={detailClose}
              aria-label="Close assignment details"
              onClick={() => setDetail(false)}
            >
              <X size={20} />
            </button>
          </div>
          <span className={`au-detail-gem ${selected.color}`}>
            <BookOpen size={27} />
          </span>
          <h2>{selected.title}</h2>
          <p>{selected.note}</p>
          <dl>
            <div>
              <dt>Due date</dt>
              <dd>{selected.due}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{selected.priority}</dd>
            </div>
            <div>
              <dt>Progress</dt>
              <dd>{selected.progress}% complete</dd>
            </div>
          </dl>
          <button className="au-action" onClick={() => navigate("planning")}>
            Make space for it <Maximize2 size={16} />
          </button>
          <small>Presentation only. Your academic data is untouched.</small>
        </section>
      )}
      <div className="au-status" role="status">
        {status}
      </div>
    </div>
  );
}
