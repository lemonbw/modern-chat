import { useCallback, useEffect, useRef, useState } from "react";
import { useVoicePlayback } from "./useVoicePlayback";

export type VoiceStatus = "idle" | "recording" | "paused";

export type VoiceRecording = {
  blob: Blob;
  mimeType: string;
  extension: string;
  durationMs: number;
};

const chunkIntervalMs = 250;
const peakIntervalMs = 70;
const maxPeaks = 180;

// Prefer OGG/Opus (Telegram's native format), fall back to WebM/Opus, then WebM, then MP4
const supportedMimeTypes = [
  "audio/ogg;codecs=opus",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
];

const extensionFor = (mimeType: string) =>
  mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm";

const pickMimeType = () =>
  typeof MediaRecorder === "undefined"
    ? ""
    : (supportedMimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) ?? "");

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

  const onStoppedRef = useRef<((recording: VoiceRecording) => void) | null>(
    null,
  );

  const onFlushedRef = useRef<(() => void) | null>(null);

  const elapsedNow = useCallback(() => {
    if (!segmentStartRef.current) {
      return accumulatedRef.current;
    }

    return accumulatedRef.current + Date.now() - segmentStartRef.current;
  }, []);

  const clearTimer = (timer: React.MutableRefObject<number | null>) => {
    if (timer.current === null) return;

    window.clearInterval(timer.current);
    timer.current = null;
  };

  const releaseStream = useCallback(() => {
    clearTimer(sampleTimerRef);
    clearTimer(tickTimerRef);

    analyserRef.current = null;

    if (contextRef.current) {
      void contextRef.current.close().catch(() => undefined);
      contextRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  }, []);

  const playback = useVoicePlayback(async () => {
    const recorder = recorderRef.current;

    if (!recorder || chunksRef.current.length === 0) {
      return null;
    }

    if (recorder.state === "recording") {
      await new Promise<void>((resolve) => {
        onFlushedRef.current = resolve;
        recorder.requestData();
      });
    }

    if (chunksRef.current.length === 0) {
      return null;
    }

    const blob = new Blob(chunksRef.current, {
      type: recorder.mimeType || "audio/webm",
    });

    return URL.createObjectURL(blob);
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

    if (peaksRef.current.length >= maxPeaks) {
      return;
    }

    peaksRef.current = [...peaksRef.current, level];

    setPeaks(peaksRef.current);
  }, []);

  const start = useCallback(async () => {
    if (status !== "idle") return;

    setError("");

    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Voice messages are not supported in this browser.");
      return;
    }

    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      const track = stream.getAudioTracks()[0];

      if (!track) {
        throw new Error("No audio track was received.");
      }

      /*
       * Prefer OGG/Opus (Telegram's native format), fall back to WebM/Opus.
       */
      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      chunksRef.current = [];
      peaksRef.current = [];

      accumulatedRef.current = 0;
      segmentStartRef.current = Date.now();

      setPeaks([]);
      setElapsedMs(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }

        onFlushedRef.current?.();
        onFlushedRef.current = null;
      };

      recorder.onerror = () => {
        setError("Recording error.");
      };

      recorder.onstop = () => {
        clearTimer(sampleTimerRef);
        clearTimer(tickTimerRef);

        const mimeType = recorder.mimeType || "audio/webm";

        const blob = new Blob(chunksRef.current, {
          type: mimeType,
        });

        const recording: VoiceRecording = {
          blob,
          mimeType,
          extension: extensionFor(mimeType),
          durationMs: elapsedNow(),
        };

        recorderRef.current = null;
        chunksRef.current = [];
        peaksRef.current = [];
        accumulatedRef.current = 0;
        segmentStartRef.current = 0;

        const resolve = onStoppedRef.current;

        onStoppedRef.current = null;

        setStatus("idle");
        setElapsedMs(0);
        setPeaks([]);
        releaseStream();
        playback.release();

        if (resolve) {
          resolve(recording);
        }
      };

      /*
       * Store the refs before starting.
       * This ensures the recorder/stream are available immediately
       * after the recording starts.
       */
      recorderRef.current = recorder;
      streamRef.current = stream;

      recorder.start(chunkIntervalMs);

      /*
       * Set up audio analysis separately from MediaRecorder.
       * Failure here must not kill the recording itself.
       */
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (AudioContextClass) {
          const context = new AudioContextClass();

          const source = context.createMediaStreamSource(stream);
          const analyser = context.createAnalyser();

          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.8;

          source.connect(analyser);

          contextRef.current = context;
          analyserRef.current = analyser;

          if (context.state === "suspended") {
            void context.resume().catch(() => undefined);
          }

          sampleTimerRef.current = window.setInterval(
            samplePeaks,
            peakIntervalMs,
          );
        }
      } catch {
        /*
         * Waveform analysis is optional.
         * Recording should continue even if AudioContext fails.
         */
        contextRef.current = null;
        analyserRef.current = null;
      }

      setStatus("recording");

      tickTimerRef.current = window.setInterval(() => {
        setElapsedMs(elapsedNow());
      }, 200);
    } catch (cause) {
      stream?.getTracks().forEach((track) => track.stop());

      releaseStream();

      recorderRef.current = null;

      setStatus("idle");

      setError(errorText(cause, "Could not access the microphone."));
    }
  }, [elapsedNow, releaseStream, samplePeaks, status, playback]);

  const pause = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== "recording") {
      return;
    }

    recorder.pause();

    accumulatedRef.current += Date.now() - segmentStartRef.current;

    clearTimer(sampleTimerRef);
    clearTimer(tickTimerRef);

    setElapsedMs(accumulatedRef.current);
    setStatus("paused");
  }, []);

  const resume = useCallback(() => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state !== "paused") {
      return;
    }

    recorder.resume();

    segmentStartRef.current = Date.now();

    setStatus("recording");

    sampleTimerRef.current = window.setInterval(samplePeaks, peakIntervalMs);

    tickTimerRef.current = window.setInterval(() => {
      setElapsedMs(elapsedNow());
    }, 200);
  }, [elapsedNow, samplePeaks]);

  const finish = useCallback((): Promise<VoiceRecording | null> => {
    const recorder = recorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(null);
    }

    if (recorder.state === "paused") {
      accumulatedRef.current += Date.now() - segmentStartRef.current;

      segmentStartRef.current = 0;
    }

    /*
     * Do NOT stop the MediaStream before recorder.stop().
     * MediaRecorder needs the stream to produce its final chunk.
     */
    return new Promise((resolve) => {
      onStoppedRef.current = resolve;

      recorder.stop();
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;

    onStoppedRef.current = null;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        recorderRef.current = null;
        reset();
      };

      recorder.stop();

      return;
    }

    reset();
  }, [reset]);

  useEffect(() => {
    return () => {
      const recorder = recorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.onstop = null;

        try {
          recorder.stop();
        } catch {
          // Recorder may already be stopping.
        }
      }

      clearTimer(sampleTimerRef);
      clearTimer(tickTimerRef);

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
      recorderRef.current = null;

      if (contextRef.current) {
        void contextRef.current.close().catch(() => undefined);
        contextRef.current = null;
      }

      analyserRef.current = null;
    };
  }, []);

  return {
    status,
    isActive: status !== "idle",
    isPaused: status === "paused",

    elapsedMs,
    peaks,
    error,

    isPlaying: playback.isPlaying,

    start,
    pause,
    resume,
    finish,
    cancel,

    togglePlayback: playback.toggle,
    stopPlayback: playback.stop,

    clearError: useCallback(() => {
      setError("");
    }, []),
  };
};
