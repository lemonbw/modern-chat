import { useCallback, useRef, useState } from "react";

/** Playback of the voice note that is being recorded, kept apart from the recording itself. */
export const useVoicePlayback = (buildUrl: () => Promise<string | null>, onError: (message: string) => void) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playbackUrlRef = useRef<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const release = useCallback(() => {
    stop();
    if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
    playbackUrlRef.current = null;
    audioRef.current = null;
  }, [stop]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      audio.pause();
      return;
    }
    const url = playbackUrlRef.current ?? (await buildUrl());
    if (!url) {
      onError("Nothing to play yet — record a little longer.");
      return;
    }
    if (url !== playbackUrlRef.current) {
      if (playbackUrlRef.current) URL.revokeObjectURL(playbackUrlRef.current);
      playbackUrlRef.current = url;
    }
    if (!audio) {
      const element = new Audio(url);
      element.addEventListener("ended", () => setIsPlaying(false));
      audioRef.current = element;
    } else {
      audio.src = url;
    }
    try {
      await audioRef.current?.play();
      setIsPlaying(true);
    } catch {
      onError("Could not play the recording.");
    }
  }, [buildUrl, onError]);

  return { isPlaying, toggle, stop, release };
};