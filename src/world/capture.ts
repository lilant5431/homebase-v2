/** User-started, bounded recording of this canvas only. No screen permission,
 * academic data or model activity. Canceling navigation discards the clip. */
export function captureWorld(
  canvas: HTMLCanvasElement,
  finish: (blob: Blob | null) => void,
) {
  if (
    typeof MediaRecorder !== "function" ||
    typeof canvas.captureStream !== "function"
  )
    throw Error("Canvas recording is unavailable in this browser.");
  const stream = canvas.captureStream(30);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm",
      videoBitsPerSecond: 6_000_000,
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const chunks: BlobPart[] = [];
  let discarded = false,
    settled = false,
    canceled = false;
  const done = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
    if (!canceled)
      finish(
        discarded || !chunks.length
          ? null
          : new Blob(chunks, { type: recorder.mimeType }),
      );
  };
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  recorder.onstop = done;
  recorder.onerror = () => {
    discarded = true;
    done();
  };
  const stop = () => {
    if (!settled && recorder.state !== "inactive") recorder.stop();
  };
  const timer = setTimeout(stop, 60000);
  try {
    recorder.start(500);
  } catch (error) {
    discarded = true;
    done();
    throw error;
  }
  return {
    stop,
    cancel() {
      canceled = true;
      discarded = true;
      stop();
      done();
    },
  };
}
