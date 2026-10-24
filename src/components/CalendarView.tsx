import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  monday,
  localISO,
  minutesBetween,
  floatingDate,
  type State,
  type Block,
} from "../domain";
type Props = {
  state: State;
  week: Date;
  days: Date[];
  weekLabel: string;
  setWeek: (week: Date) => void;
  open: (kind: "block", block?: Block) => void;
};
// Presentation-only lane layout: overlapping commitments stay individually
// clickable. Academic conflict policy belongs to the domain validator.
function lanes(blocks: Block[]) {
  const result: { block: Block; lane: number; columns: number }[] = [];
  const sorted = blocks.slice().sort((a, b) => a.start.localeCompare(b.start));
  let group: typeof result = [];
  let ends: string[] = [];
  let groupEnd = "";
  const finish = () => {
    for (const item of group) {
      item.columns = ends.length;
      result.push(item);
    }
    group = [];
    ends = [];
  };
  for (const block of sorted) {
    if (group.length && block.start >= groupEnd) finish();
    let lane = ends.findIndex((end) => end <= block.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = block.end;
    groupEnd = group.length
      ? block.end > groupEnd
        ? block.end
        : groupEnd
      : block.end;
    group.push({ block, lane, columns: 1 });
  }
  finish();
  return result;
}
export function CalendarView({
  state,
  week,
  days,
  weekLabel,
  setWeek,
  open,
}: Props) {
  return (
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
                className={localISO(d) === localISO(new Date()) ? "today" : ""}
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
                {lanes(
                  state.blocks.filter((b) => b.start.startsWith(localISO(d))),
                ).map(({ block: b, lane, columns }) => {
                  const date = floatingDate(b.start);
                  const top =
                    ((date.getUTCHours() * 60 + date.getUTCMinutes()) / 60) *
                    64;
                  const height = (minutesBetween(b.start, b.end) / 60) * 64;
                  return (
                    <button
                      key={b.id}
                      className={`event ${b.color}`}
                      style={{
                        left: `calc(${(lane * 100) / columns}% + 4px)`,
                        right: `calc(${((columns - lane - 1) * 100) / columns}% + 4px)`,
                        top: Math.max(0, top),
                        height: Math.max(30, height),
                      }}
                      onClick={() => open("block", b)}
                    >
                      <small>
                        {b.sessionCompleted
                          ? "SESSION COMPLETE"
                          : b.assignmentId
                            ? "FOCUS TIME"
                            : "CLASS"}
                        {b.locked ? " · LOCKED" : ""}
                      </small>
                      <strong>{b.title}</strong>
                      <span>
                        {date.toLocaleTimeString("en-US", {
                          timeZone: "UTC",
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
  );
}
