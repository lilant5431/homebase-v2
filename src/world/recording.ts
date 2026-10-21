// Records only the decorative WebGL canvas; never captures planner text or device audio.
export function recordWorld(canvas: HTMLCanvasElement, seconds = 8) {
  if (
    typeof MediaRecorder === "undefined" ||
    typeof canvas.captureStream !== "function"
  ) {
    throw new Error(
      "Canvas recording is unavailable in this browser. Screenshots still work.",
    );
  }
  const mimeType = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType)
    throw new Error("This browser cannot record WebM from the world canvas.");
  const stream = canvas.captureStream(30);
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6000000,
    });
  } catch (error) {
    stream.getTracks().forEach((track) => track.stop());
    throw error;
  }
  const chunks: BlobPart[] = [];
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;
  let rejectRecording: (error: Error) => void = () => {};
  const clean = () => {
    clearTimeout(timer);
    stream.getTracks().forEach((track) => track.stop());
  };
  const finished = new Promise<Blob>((resolve, reject) => {
    rejectRecording = reject;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onerror = () => {
      if (!settled) {
        settled = true;
        clean();
        reject(new Error("World recording failed."));
      }
    };
    recorder.onstop = () => {
      clean();
      if (settled) return;
      settled = true;
      const blob = new Blob(chunks, { type: mimeType });
      if (!blob.size)
        reject(new Error("The browser produced an empty world recording."));
      else resolve(blob);
    };
    try {
      recorder.start(500);
      timer = setTimeout(() => recorder.stop(), seconds * 1000);
    } catch (error) {
      settled = true;
      clean();
      reject(error);
    }
  });
  return {
    finished,
    cancel() {
      if (settled) return;
      settled = true;
      clean();
      if (recorder.state !== "inactive") recorder.stop();
      rejectRecording(new Error("World recording cancelled."));
    },
  };
}
