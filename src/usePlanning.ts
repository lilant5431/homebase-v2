import { useEffect, useRef, useState } from "react";
import { loadModel, propose, cancelInference } from "./ai";
import { localISO, type State } from "./domain";
import { parseIntent } from "./planningIntent";
import {
  approveProposal,
  reviewIssues,
  type ProposalReview,
} from "./proposalReview";

export function usePlanning(
  state: State,
  week: Date,
  save: (next: State) => Promise<boolean>,
) {
  const [request, setRequest] = useState(
    () =>
      `Schedule "${state.assignments.find((a) => !a.completed)?.title || "Assignment title"}" on ${localISO(week)} between 15:00 and 18:00 for 60 minutes.`,
  );
  const [aiStatus, setAIStatus] = useState("Model not loaded"),
    [ready, setReady] = useState(false),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ProposalReview | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current++;
      if (inFlight.current) cancelInference();
      inFlight.current = false;
    };
  }, []);
  const issues = preview ? reviewIssues(state, preview, request) : [];
  async function enable() {
    const token = generation.current;
    const current = () => mounted.current && token === generation.current;
    setLoading(true);
    try {
      const result = await loadModel((text) => {
        if (current()) setAIStatus(text);
      });
      if (!current()) return;
      setReady(true);
      setAIStatus(`Ready · loaded in ${(result.loadMs / 1000).toFixed(1)}s`);
    } catch (e) {
      if (current()) setAIStatus(e instanceof Error ? e.message : String(e));
    } finally {
      if (current()) setLoading(false);
    }
  }
  async function plan() {
    if (inFlight.current) return;
    setPreview(null);
    let intent;
    try {
      intent = parseIntent(
        request,
        state.assignments.filter((a) => !a.completed),
      );
    } catch (e) {
      setAIStatus(e instanceof Error ? e.message : String(e));
      return;
    }
    const token = ++generation.current;
    inFlight.current = true;
    setBusy(true);
    setAIStatus("Planning on your device…");
    try {
      const p = await propose(
        {
          ...state,
          assignments: state.assignments.filter((a) => !a.completed),
          weekStart: localISO(week),
        },
        request,
      );
      if (token !== generation.current) return;
      const review = {
        proposal: p,
        intent,
        request,
        revision: state.revision,
        latency: p.latencyMs,
      };
      setPreview(review);
      setAIStatus(
        reviewIssues(state, review, request).length
          ? "Proposal rejected: check validation details."
          : "Proposal ready for review",
      );
    } catch (e) {
      if (token === generation.current)
        setAIStatus(e instanceof Error ? e.message : String(e));
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function cancel() {
    generation.current++;
    cancelInference();
    setReady(false);
    setPreview(null);
    setAIStatus(
      "Planning canceled. No changes saved. Enable on-device AI to start a fresh worker.",
    );
  }
  async function approve() {
    if (!preview) return;
    try {
      const next = approveProposal(state, preview, request);
      if (await save(next)) {
        setPreview(null);
        setAIStatus("Approved study time saved. Undo is available.");
      }
    } catch (e) {
      setAIStatus(e instanceof Error ? e.message : String(e));
    }
  }
  return {
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
  };
}
