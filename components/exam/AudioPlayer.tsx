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

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      const next = audio.current ? audio.current.currentTime : position + 0.25;
      if (next >= durationSec || audio.current?.ended) {
        setPlaying(false);
        setPosition(0);
        onPlayed();
      } else setPosition(next);
    }, 250);
    return () => clearInterval(timer);
  }, [playing, position, durationSec, onPlayed]);

  const toggle = () => {
    if (locked) return;
    if (playing) audio.current?.pause();
    else void audio.current?.play();
    setPlaying(!playing);
  };

  const played = Math.round((position / durationSec) * BARS.length);
  return (
    <section className="flex flex-col gap-2.5 rounded-card-lg border-b-[6px] border-listening-shadow bg-listening p-[18px] text-white lg:gap-5 lg:rounded-hero lg:p-7">
      {src && <audio ref={audio} src={src} preload="auto" />}
      <div className="flex items-center gap-4 lg:gap-5">
        <button
          type="button"
          onClick={toggle}
          disabled={locked}
          aria-label={playing ? "Apturēt ierakstu" : "Atskaņot ierakstu"}
          className="flex size-[60px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-white text-listening disabled:cursor-not-allowed disabled:opacity-60 lg:size-[72px]"
        >
          <GlyphIcon name={playing ? "pause" : "play"} size={28} />
        </button>
        <div aria-hidden="true" className="flex h-9 flex-1 items-center justify-between lg:h-14">
          {BARS.map((h, i) => (
            <div key={i} className={cx("w-[5px] rounded-[3px] lg:w-1.5", i < played ? "bg-white" : "bg-listening-soft")} style={{ height: `${(h / 54) * 100}%` }} />
          ))}
        </div>
      </div>
      <div className="flex justify-between text-[13px] font-extrabold tabular-nums lg:text-[15px]">
        <span>
          {clock(position)} / {clock(durationSec)}
        </span>
        <span aria-live="polite">{locked ? `Noklausīts ${maxPlays} reizes` : `${plays + 1}. reize no ${maxPlays}`}</span>
      </div>
    </section>
  );
}
