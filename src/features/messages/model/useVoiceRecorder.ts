import { useCallback, useEffect, useRef, useState } from "react";
import { useVoicePlayback } from "./useVoicePlayback";

export type VoiceStatus = "idle" | "recording" | "paused";

export type VoiceRecording = {
  blob: Blob;
  mimeType: string;
  extension: string;
  durationMs: number;
};

const supportedMimeTypes = ["audio/ogg;codecs=opus", "audio/ogg", "audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
const chunkIntervalMs = 250;
const peakIntervalMs = 70;
const maxPeaks = 180;

const extensionFor = (mimeType: string) =>
  mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";

const pickMimeType = () =>
  typeof MediaRecorder === "undefined" ? "" : (supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "");

const errorText = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useVoiceRecorder = () => {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [error, setError] = useState("");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const peaksRef = useRef<number[]>([]);
  const sampleTimerRef = useRef<number | null>(null);
  const tickTimerRef = useRef<number | null>(null);
  const segmentStartRef = useRef(0);
  const accumulatedRef = useRef(0);
  const onStoppedRef = useRef<((recording: VoiceRecording) => void) | null>(null);
  const onFlushedRef = useRef<(() => void) | null>(null);

  const elapsedNow = () => accumulatedRef.current + (Date.now() - segmentStartRef.current);

  const clearTimer = (timer: { current: number | null }) => {
    if (timer.current === null) return;
    window.clearInterval(timer.current);
    timer.current = null;
  };

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    clearTimer(sampleTimerRef);
    clearTimer(tickTimerRef);
    analyserRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
  }, []);

  const playback = useVoicePlayback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || chunksRef.current.length === 0) return null;
    if (recorder.state === "recording") {
      await new Promise<void>((resolve) => {
        onFlushedRef.current = resolve;
        recorder.requestData();
      });
    }
    if (chunksRef.current.length === 0) return null;
    return URL.createObjectURL(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
  }, setError);

  const reset = useCallback(() => {
    recorderRef.current = null;
    chunksRef.current = [];
    peaksRef.current = [];
    accumulatedRef.current = 0;
    segmentStartRef.current = 0;
    onStoppedRef.current = null;
    onFlushedRef.current = null;
    setStatus("idle");
    setElapsedMs(0);
    setPeaks([]);
    setError("");
    playback.release();
    releaseStream();
  }, [playback, releaseStream]);

  const samplePeaks = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const samples = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(samples);
    let energy = 0;
    for (const sample of samples) {
      const centered = (sample - 128) / 128;
      energy += centered * centered;
    }
    const level = Math.min(1, Math.sqrt(energy / samples.length) * 2.4);
    if (peaksRef.current.length >= maxPeaks) return;
    peaksRef.current = [...peaksRef.current, level];
    setPeaks(peaksRef.current);
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle") return;
    setError("");
    playback.release();
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice messages are not supported in this browser.");
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const recordedMimeType = recorder.mimeType || mimeType || "audio/webm";

      chunksRef.current = [];
      peaksRef.current = [];
      setPeaks([]);
      accumulatedRef.current = 0;
      segmentStartRef.current = Date.now();
      setElapsedMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
        const flushed = onFlushedRef.current;
        if (flushed) {
          onFlushedRef.current = null;
          flushed();
        }
      };

      recorder.onstop = () => {
        const resolveStop = onStoppedRef.current;
        onStoppedRef.current = null;
        onFlushedRef.current = null;
        if (!resolveStop) {
          reset();
          return;
        }
        const duration = accumulatedRef.current + (Date.now() - segmentStartRef.current);
        const blob = new Blob(chunksRef.current, { type: recordedMimeType });
        recorderRef.current = null;
        chunksRef.current = [];
        peaksRef.current = [];
        setStatus("idle");
        setElapsedMs(0);
        setPeaks([]);
        releaseStream();
        playback.release();
        resolveStop({ blob, mimeType: recordedMimeType, extension: extensionFor(recordedMimeType), durationMs: duration });
      };

      stream.getAudioTracks().forEach((track) => track.addEventListener("ended", () => {
        if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      }));

      recorder.start(chunkIntervalMs);
      recorderRef.current = recorder;
      streamRef.current = stream;
      setStatus("recording");

      const context = new window.AudioContext();
      contextRef.current = context;
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(stream).connect(analyser);
      analyserRef.current = analyser;
      sampleTimerRef.current = window.setInterval(samplePeaks, peakIntervalMs);
      tickTimerRef.current = window.setInterval(() => setElapsedMs(elapsedNow()), 200);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());
      releaseStream();
      setStatus("idle");
      setError(errorText(cause, "Could not access the microphone."));
    }
  }, [playback, releaseStream, reset, samplePeaks, status]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.pause();
    accumulatedRef.current += Date.now() - segmentStartRef.current;
    clearTimer(sampleTimerRef);
    clearTimer(tickTimerRef);
    setElapsedMs(accumulatedRef.current);
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "paused") return;
    recorder.resume();
    segmentStartRef.current = Date.now();
    setStatus("recording");
    sampleTimerRef.current = window.setInterval(samplePeaks, peakIntervalMs);
    tickTimerRef.current = window.setInterval(() => setElapsedMs(elapsedNow()), 200);
  }, [samplePeaks]);

  const finish = useCallback((): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return Promise.resolve(null);
    if (recorder.state === "paused") {
      accumulatedRef.current += Date.now() - segmentStartRef.current;
      segmentStartRef.current = Date.now();
    }
    releaseStream();
    return new Promise((resolve) => {
      onStoppedRef.current = resolve;
      recorder.stop();
    });
  }, [releaseStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    onStoppedRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => reset();
      recorder.stop();
      return;
    }
    reset();
  }, [reset]);

  useEffect(() => () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.onstop = () => undefined;
    releaseStream();
    playback.release();
  }, [playback, releaseStream]);

  return {
    status,
    isActive: status !== "idle",
    isPaused: status === "paused",
    elapsedMs,
    peaks,
    isPlaying: playback.isPlaying,
    error,
    start,
    pause,
    resume,
    finish,
    cancel,
    togglePlayback: playback.toggle,
    stopPlayback: playback.stop,
    clearError: useCallback(() => setError(""), []),
  };
};
