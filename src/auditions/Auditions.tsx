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
  concepts,
  days,
  events,
  parseConcept,
  type Assignment,
  type Concept,
  type Workflow,
} from "./fixtures";
import "./auditions.css";
import WorldStage from "../world/WorldStage";

function Environment({ concept }: { concept: Concept }) {
  return (
    <div className="au-environment" aria-hidden="true">
      <div className="au-sun" />
      <div className="au-horizon" />
      <div className="au-architecture">
        <i />
        <i />
        <i />
        <i />
      </div>
      <svg className="au-crystal" viewBox="0 0 700 700" fill="none">
        <defs>
          <linearGradient
            id="facet"
            x1="70"
            y1="20"
            x2="600"
            y2="640"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor={concept === "prism" ? "#c2aaff" : "#fff"} />
            <stop
              offset=".45"
              stopColor={concept === "meridian" ? "#b2d5dc" : "#a4c3e9"}
              stopOpacity=".1"
            />
            <stop offset="1" stopColor="#d2e8fd" stopOpacity=".55" />
          </linearGradient>
        </defs>
        <path
          d="M350 35 570 240 505 560 240 660 105 430 160 180Z"
          fill="url(#facet)"
          stroke="currentColor"
        />
        <path
          d="m350 35-38 286 258-81-192 164 127 156-193-58-72 158 12-256-147 26 207-109-152-141 218 224Z"
          fill="url(#facet)"
          stroke="currentColor"
        />
        <path
          d="m160 180 410 60M105 430l400 130M350 35l28 369-138 256"
          stroke="currentColor"
          opacity=".6"
        />
      </svg>
      <div className="au-grain" />
    </div>
  );
}

export default function Auditions({ world = false }: { world?: boolean }) {
  const [concept, setConcept] = useState<Concept>(() =>
    world ? "meridian" : parseConcept(location.hash),
  );
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
  const identity = concepts[concept];
  useEffect(() => {
    const sync = () =>
      setConcept(world ? "meridian" : parseConcept(location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [world]);
  useEffect(() => {
    const previous = document.title;
    document.title = world
      ? "Gemstone Atelier · Homebase V2.1D"
      : `${identity.name} · Homebase visual auditions`;
    return () => {
      document.title = previous;
    };
  }, [identity.name, world]);
  function selectConcept(next: Concept) {
    location.hash = `auditions/${next}`;
    setConcept(next);
  }
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
      className={`audition au-${concept}${quiet ? " au-quiet" : ""}${world ? ` au-world crystal-world world-area-${view}` : ""}${immersive ? " world-immersive" : ""}`}
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
      {world ? (
        <WorldStage
          area={view}
          emphasis={detail || proposal === "preview"}
          disabled={quiet}
          centered={immersive}
        />
      ) : (
        <Environment concept={concept} />
      )}
      <div className="au-audition-bar">
        <a href="#" className="au-return">
          <ArrowLeft size={14} /> Back to planner
        </a>
        {world ? (
          <div className="world-mode-bar">
            <a href="#auditions/meridian">← V2.1A auditions</a>
            <span>V2.1D / CRYSTAL WORLD</span>
            <button
              aria-pressed={immersive}
              onClick={() => setImmersive(!immersive)}
            >
              {immersive ? "Show workbench" : "Explore the crystal"}
            </button>
          </div>
        ) : (
          <div className="au-selector" role="group" aria-label="Visual concept">
            {(Object.keys(concepts) as Concept[]).map((key, i) => (
              <button
                key={key}
                aria-pressed={concept === key}
                onClick={() => selectConcept(key)}
              >
                <span>0{i + 1}</span>
                {concepts[key].name}
              </button>
            ))}
          </div>
        )}
        <button
          className="au-performance"
          aria-pressed={quiet}
          onClick={() => setQuiet(!quiet)}
        >
          <Layers3 size={14} />
          {world
            ? quiet
              ? "Enable graphics"
              : "Disable graphics"
            : quiet
              ? "Simple environment"
              : "Full environment"}
        </button>
      </div>
      <div className="au-shell">
        <header className="au-header">
          <a
            href="#auditions"
            className="au-brand"
            onClick={(e) => {
              e.preventDefault();
              navigate("week");
            }}
          >
            <Gem size={27} />
            <span>
              homebase
              <small>
                {world
                  ? "CRYSTAL WORLD / V2.1D"
                  : `${identity.name.toUpperCase()} / V2.1A`}
              </small>
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
                {world
                  ? "A DIFFERENT FACET OF YOUR DAY"
                  : identity.subtitle.toUpperCase()}{" "}
                <span className="au-title-rule" /> FALL SEMESTER 2026
              </span>
              <h1>
                {world
                  ? view === "planning"
                    ? "Find your next possibility."
                    : view === "assignments"
                      ? "Ideas, taking shape."
                      : "Time, in a new light."
                  : identity.line}
              </h1>
              <p>
                {world
                  ? "One world. A new perspective on what matters."
                  : identity.description}
              </p>
            </div>
            <div className="au-hero-index">
              <span>
                {concept === "prism" ? "SIGNAL / 043" : "TUESDAY, OCTOBER 20"}
              </span>
              <strong>
                {concept === "meridian"
                  ? "The study, reimagined."
                  : concept === "prism"
                    ? "A clearer trajectory."
                    : "A little structure. A lot of possibility."}
              </strong>
              <span>
                4 assignments <i /> 10 hours of learning
              </span>
            </div>
          </section>
          <div
            className={`au-workflows au-view-${view}`}
            key={`${concept}-${view}`}
          >
            <div className="au-primary">
              {view === "week"
                ? calendar
                : view === "assignments"
                  ? assignmentList
                  : planning}
            </div>
            <aside className="au-secondary">
              {view === "planning" ? (
                <section className="au-context au-surface">
                  <span className="au-kicker">YOUR TUESDAY</span>
                  <h2>
                    Space between
                    <br />
                    the commitments.
                  </h2>
                  <div className="au-timeline">
                    <p>
                      <b>09:00</b>
                      <span>
                        Linear algebra<small>Until 10:30</small>
                      </span>
                    </p>
                    <p>
                      <b>13:00</b>
                      <span>
                        Reading & reflection<small>Until 14:30</small>
                      </span>
                    </p>
                    <p className="au-open-slot">
                      <b>15:00</b>
                      <span>
                        {proposal === "approved"
                          ? "Problem set 04"
                          : "A little room to focus"}
                        <small>90 minutes available</small>
                      </span>
                    </p>
                  </div>
                  <p>
                    All times and constraint notes are prewritten fixture data
                    for this visual audition.
                  </p>
                </section>
              ) : (
                <>
                  <section className="au-focus au-surface">
                    <div className="au-focus-symbol">
                      <Gem size={30} />
                    </div>
                    <span className="au-kicker">
                      {concept === "meridian"
                        ? "A MOMENT OF INTENTION"
                        : concept === "prism"
                          ? "NEXT IN FOCUS"
                          : "MAKE A LITTLE ROOM"}
                    </span>
                    <h2>
                      {concept === "meridian" ? (
                        <>
                          Good work starts
                          <br />
                          with a little space.
                        </>
                      ) : (
                        <>
                          Your next chapter,
                          <br />
                          <em>in focus.</em>
                        </>
                      )}
                    </h2>
                    <p>
                      Let the week unfold with intention. Find a home for your
                      next study session.
                    </p>
                    <button
                      className="au-action"
                      onClick={() => navigate("planning")}
                    >
                      Open planning studio <ArrowRight size={17} />
                    </button>
                  </section>
                  <section className="au-upcoming">
                    <div>
                      <h2>Coming into view</h2>
                      <span>02 / NEXT</span>
                    </div>
                    {[assignments[2], assignments[0]].map((a) => (
                      <button key={a.id} onClick={() => openAssignment(a)}>
                        <i className={`au-dot ${a.color}`} />
                        <span>
                          <strong>{a.title}</strong>
                          <small>{a.due}</small>
                        </span>
                        <ArrowRight size={15} />
                      </button>
                    ))}
                  </section>
                </>
              )}
            </aside>
          </div>
          <footer className="au-footer">
            <span>
              <span className="au-presence" /> VISUAL AUDITION · FIXTURE DATA
              ONLY
            </span>
            <span>
              {world
                ? "Crystal World / Three facets, one place"
                : `${identity.name} / ${identity.subtitle}`}{" "}
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
