import { useEffect, useRef, useState } from "react";
import { startWorldSession } from "./session";
import { recordWorld } from "./recording";
import { viewpoints, type WorldArea, type WorldMetrics } from "./contract";
import "./world.css";

export default function WorldStage({
  area,
  emphasis,
  disabled,
  centered,
}: {
  area: WorldArea;
  emphasis: boolean;
  disabled: boolean;
  centered: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const session = useRef<ReturnType<typeof startWorldSession>>(null);
  const recording = useRef<ReturnType<typeof recordWorld>>(null);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState("");
  const [stats, setStats] = useState<WorldMetrics | null>(null);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === "function" &&
      matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [still, setStill] = useState(false);
  const [straight, setStraight] = useState(false);
  const [recordStatus, setRecordStatus] = useState("");
  const failNext = useRef(false);
  const latest = useRef({
    area,
    emphasis,
    reducedMotion: reduced || still,
    refraction: !straight,
    centered,
  });
  latest.current = {
    area,
    emphasis,
    reducedMotion: reduced || still,
    refraction: !straight,
    centered,
  };
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (disabled || !canvas.current) return;
    setFailure("");
    setStats(null);
    const started = performance.now();
    let startup = 0;
    const current = startWorldSession(
      canvas.current,
      {
        metrics(value) {
          if (!startup) startup = performance.now() - started;
          setStats({ ...value, startupMs: startup });
        },
        error(error) {
          recording.current?.cancel();
          recording.current = null;
          setFailure(error.message);
        },
      },
      () => import("./renderer"),
      failNext.current,
      latest.current,
    );
    failNext.current = false;
    session.current = current;
    return () => {
      current.dispose();
      recording.current?.cancel();
      recording.current = null;
      session.current = null;
    };
  }, [disabled, attempt]);
  useEffect(() => {
    session.current?.update(latest.current);
  }, [area, emphasis, reduced, still, straight, centered]);
  async function record() {
    if (!canvas.current || recording.current) return;
    let capture: ReturnType<typeof recordWorld> | undefined;
    try {
      capture = recordWorld(canvas.current);
      recording.current = capture;
      setRecordStatus("Recording 8 seconds of the world…");
      const blob = await capture.finished;
      if (recording.current !== capture) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "homebase-crystal-world.webm";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setRecordStatus(
        `World recording saved · ${(blob.size / 1048576).toFixed(1)} MB`,
      );
    } catch (error) {
      if (!capture || recording.current === capture)
        setRecordStatus(error instanceof Error ? error.message : String(error));
    } finally {
      if (recording.current === capture) recording.current = null;
    }
  }
  return (
    <>
      <div className="world-render-surface" aria-hidden="true">
        {!disabled && (
          <canvas
            key={attempt}
            ref={canvas}
            className={failure ? "world-canvas-failed" : ""}
          />
        )}
      </div>
      <div className="world-caption">
        <span>{viewpoints[area].label} / CRYSTAL WORLD</span>
        <span>
          {disabled
            ? "GRAPHICS OFF"
            : failure
              ? "RENDERER UNAVAILABLE"
              : stats
                ? `${stats.motion.toUpperCase()} · WEBGL 2`
                : "BUILDING THE WORLD"}
        </span>
      </div>
      <details className="world-diagnostics">
        <summary>
          World instrument panel{" "}
          <span>
            {stats && !failure && !disabled
              ? stats.fps
                ? `${stats.fps.toFixed(0)} FPS`
                : stats.motion === "Live"
                  ? "Warming up"
                  : "Paused"
              : "Graphics"}
          </span>
        </summary>
        <div className="world-instruments">
          <p>
            Convex facet ray tracing · 3 spectral bands · 3 internal segments ·
            live 512² × 6 HDR probe
          </p>
          {stats && !failure && !disabled && (
            <dl>
              <div>
                <dt>Startup / first rendered frame</dt>
                <dd>{stats.startupMs.toFixed(0)} ms</dd>
              </div>
              <div>
                <dt>Rendered frame rate</dt>
                <dd>{stats.fps.toFixed(1)} FPS</dd>
              </div>
              <div>
                <dt>Frame interval p95 / worst</dt>
                <dd>
                  {stats.frameP95.toFixed(1)} / {stats.worstFrame.toFixed(1)} ms
                </dd>
              </div>
              <div>
                <dt>CPU update + render submission</dt>
                <dd>{stats.submitMs.toFixed(1)} ms</dd>
              </div>
              <div>
                <dt>GPU timer (sampled)</dt>
                <dd>
                  {stats.gpuMs === null
                    ? "Unavailable"
                    : `${stats.gpuMs.toFixed(1)} ms`}
                </dd>
              </div>
              <div>
                <dt>Draw calls / triangles incl. passes</dt>
                <dd>
                  {stats.calls} / {stats.triangles.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt>Geometries / textures / programs</dt>
                <dd>
                  {stats.geometries} / {stats.textures} / {stats.programs}
                </dd>
              </div>
              <div>
                <dt>Render buffer resolution</dt>
                <dd>
                  {stats.width} × {stats.height}
                </dd>
              </div>
              <div>
                <dt>Estimated HDR color buffers only</dt>
                <dd>~{stats.bufferEstimateMB.toFixed(1)} MB</dd>
              </div>
              <div>
                <dt>Rendered frames / world time</dt>
                <dd>
                  {stats.frames} / {stats.elapsed.toFixed(1)} s
                </dd>
              </div>
              <div>
                <dt>Camera position</dt>
                <dd>{stats.camera}</dd>
              </div>
              <div>
                <dt>Motion</dt>
                <dd>{stats.motion}</dd>
              </div>
            </dl>
          )}
          {stats && <p className="world-gpu">{stats.gpu}</p>}
          <div className="world-diagnostic-actions">
            <button
              aria-pressed={straight}
              onClick={() => setStraight(!straight)}
              disabled={!stats || !!failure || disabled}
            >
              {straight
                ? "Restore crystal refraction"
                : "Compare without refraction"}
            </button>
            <button
              aria-pressed={still}
              onClick={() => setStill(!still)}
              disabled={disabled || reduced}
            >
              {reduced
                ? "System reduced motion"
                : still
                  ? "Resume world motion"
                  : "Freeze world motion"}
            </button>
            <button
              onClick={() => void record()}
              disabled={
                !stats ||
                !!failure ||
                disabled ||
                !!recording.current ||
                reduced ||
                still
              }
            >
              Record 8s world
            </button>
            <button
              onClick={() => {
                failNext.current = true;
                setAttempt((a) => a + 1);
              }}
              disabled={disabled}
            >
              Test startup failure
            </button>
            <button
              onClick={() => session.current?.loseContext()}
              disabled={!stats || !!failure || disabled}
            >
              Test context loss
            </button>
          </div>
          <p role="status">{recordStatus}</p>
          <small>
            FPS measures submitted frames, not display scanout. Color-buffer
            estimate excludes depth, shadows, environment maps and driver
            overhead. No automatic quality downgrade.
          </small>
        </div>
      </details>
      <div className="crystal-orientation" aria-hidden="true">
        <span>ONE WORLD / THREE PERSPECTIVES</span>
        <strong>{viewpoints[area].label}</strong>
        <p>{viewpoints[area].description}</p>
        <div>
          <i className={area === "week" ? "active" : ""} />
          <i className={area === "assignments" ? "active" : ""} />
          <i className={area === "planning" ? "active" : ""} />
        </div>
      </div>
      {failure && !disabled && (
        <div className="world-failure" role="status">
          <strong>The world is taking a moment.</strong>
          <p>{failure}</p>
          <button onClick={() => setAttempt((a) => a + 1)}>
            Retry graphics
          </button>
          <span>
            Your demo calendar, assignments and planning controls still work.
          </span>
        </div>
      )}
    </>
  );
}
