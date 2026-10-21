import { Sparkles, ArrowUpRight, ShieldCheck, X, Check } from "lucide-react";
import type { State } from "../domain";
import { MODEL_INFO } from "../ai";
import { REQUEST_HELP } from "../planningIntent";
import type { usePlanning } from "../usePlanning";
import { CrystalArtwork } from "./CrystalArtwork";
export function PlanningPanel({
  state,
  planning,
}: {
  state: State;
  planning: ReturnType<typeof usePlanning>;
}) {
  const {
    request,
    setRequest,
    aiStatus,
    ready,
    loading,
    busy,
    preview,
    setPreview,
    issues,
    enable,
    plan,
    cancel,
    approve,
  } = planning;
  return (
    <>
      <section className="ai-panel panel">
        <div className="ai-top">
          <span className="spark-icon">
            <Sparkles size={18} />
          </span>
          <span>Intelligence, in your corner.</span>
          <span className="beta">LAB</span>
        </div>
        <CrystalArtwork />
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
        <details className="request-help">
          <summary>Supported requests & clarification</summary>
          <p>{REQUEST_HELP}</p>
          <p>
            Example: Schedule "Problem set 04" on 2026-10-21 between 13:00 and
            17:00 for 90 minutes.
          </p>
        </details>
        <div className="ai-status" role="status">
          {aiStatus}
        </div>
        {!ready ? (
          <button disabled={loading} className="ai-button" onClick={enable}>
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
          <button className="text-button" onClick={cancel}>
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
            Qwen2.5 1.5B · {MODEL_INFO.parameters} parameters. Approximately{" "}
            {MODEL_INFO.estimatedDownloadMB} MB download. Requires WebGPU with
            shader-f16 and HTTPS or localhost. The first load downloads model
            files; requests run locally. Manual planning works independently.
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
          <p className="form-help">
            Requested: {preview.intent.date},{" "}
            {preview.intent.windowStart.slice(11)}-
            {preview.intent.windowEnd.slice(11)}, exactly{" "}
            {preview.intent.durationMinutes} minutes. Existing busy time is
            always protected.
          </p>
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
            <p className="error">Your plan changed. Generate a new proposal.</p>
          )}
          <button
            className="primary"
            disabled={issues.length > 0}
            onClick={approve}
          >
            <Check size={16} />
            Approve changes
          </button>
        </section>
      )}
    </>
  );
}
