"use client";
import { useEffect, useRef, useState } from "react";
import { GlyphIcon } from "@/components/ui/icons";
import { cx } from "@/lib/ui/skill";

const BARS = [18, 40, 28, 54, 34, 46, 22, 38, 50, 26, 44, 30, 54, 18, 38, 28, 48, 22, 40, 16];
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, "0")}`;

/**
 * Listening player. In exam mode a recording plays `maxPlays` times (2), then locks.
 * `plays` is owned by the parent so the count survives moving between screens.
 * With `src` null (audio not recorded yet) playback is simulated over `durationSec`.
 */
export function AudioPlayer({ src, durationSec, plays, maxPlays = 2, onPlayed }: { src: string | null; durationSec: number; plays: number; maxPlays?: number; onPlayed: () => void }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const locked = plays >= maxPlays;

  // Position = seconds played before the last resume + time since the resume.
  const base = useRef(0);
  const onPlayedRef = useRef(onPlayed);
  useEffect(() => {
    onPlayedRef.current = onPlayed;
  });
  useEffect(() => {
    if (!playing) return;
    const resumedAt = performance.now();
    const timer = setInterval(() => {
      const next = audio.current ? audio.current.currentTime : base.current + (performance.now() - resumedAt) / 1000;
      if (next >= durationSec || audio.current?.ended) {
        base.current = 0;
        setPlaying(false);
        setPosition(0);
        onPlayedRef.current();
      } else setPosition(next);
    }, 200);
    return () => clearInterval(timer);
  }, [playing, durationSec]);

  const toggle = () => {
    if (locked) return;
    if (playing) {
      audio.current?.pause();
      base.current = position;
    } else void audio.current?.play();
    setPlaying(!playing);
  };

  const played = Math.round((position / durationSec) * BARS.length);
  return (
    <section className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 rounded-card-lg border-b-[6px] border-listening-shadow bg-listening p-[18px] text-white lg:gap-x-5 lg:gap-y-5 lg:rounded-hero lg:p-7">
      {src && <audio ref={audio} src={src} preload="auto" />}
      <button
        type="button"
        onClick={toggle}
        disabled={locked}
        aria-label={playing ? "Apturēt ierakstu" : "Atskaņot ierakstu"}
        className="row-span-2 flex size-[60px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-listening disabled:cursor-not-allowed disabled:opacity-60 lg:row-span-1 lg:size-[72px]"
      >
        <GlyphIcon name={playing ? "pause" : "play"} size={28} />
      </button>
      <div aria-hidden="true" className="flex h-9 items-center gap-1 lg:h-14 lg:justify-between lg:gap-0">
        {BARS.map((h, i) => (
          <div key={i} className={cx("w-[5px] rounded-[3px] lg:w-1.5", i >= 18 && "hidden lg:block", i < played ? "bg-white" : "bg-listening-soft")} style={{ height: `${(h / 54) * 100}%` }} />
        ))}
      </div>
      <div className="flex justify-between text-[13px] font-extrabold tabular-nums lg:col-span-2 lg:text-[15px]">
        <span>
          {clock(position)} / {clock(durationSec)}
        </span>
        <span aria-live="polite">{locked ? `Noklausīts ${maxPlays} reizes` : `${plays + 1}. reize no ${maxPlays}`}</span>
      </div>
    </section>
  );
}
