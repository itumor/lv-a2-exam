"use client";
import { useEffect, useRef, useState } from "react";
import { CheckIcon, GlyphIcon, MicIcon } from "@/components/ui/icons";

const BARS = [14, 30, 42, 22, 36, 16, 38, 26, 44, 18, 32, 14, 28, 20];
const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

type Status = "idle" | "recording" | "done" | "error";

/**
 * One spoken answer: start, stop, done. One take, as in the exam.
 * ponytail: the audio itself is dropped; only the duration is reported.
 * Upload to private storage and speech-to-text come with the speech session (spec section 11).
 */
export function Recorder({ doneSec, onDone }: { doneSec: number | null; onDone: (durationSec: number) => void }) {
  const [status, setStatus] = useState<Status>(doneSec === null ? "idle" : "done");
  const [seconds, setSeconds] = useState(doneSec ?? 0);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  // release the microphone if the learner leaves mid-recording
  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder.current = new MediaRecorder(stream);
      recorder.current.start();
      setSeconds(0);
      setStatus("recording");
    } catch {
      setStatus("error");
    }
  };

  const stop = () => {
    recorder.current?.stop();
    recorder.current?.stream.getTracks().forEach((t) => t.stop());
    setStatus("done");
    onDone(seconds);
  };

  const recording = status === "recording";
  return (
    <>
      <section className="flex flex-col items-center gap-3 rounded-[22px] border-2 border-speaking bg-surface p-4 lg:gap-[18px] lg:rounded-[26px] lg:p-7">
        <div role="status" className="flex items-center gap-2 text-[15px] font-black text-speaking-shadow lg:text-[17px]">
          {recording && <span aria-hidden="true" className="size-2.5 rounded-full bg-danger lg:size-3" />}
          {status === "done" && <CheckIcon size={18} />}
          {recording ? `Ieraksts · ${clock(seconds)}` : status === "done" ? `Ieraksts saglabāts · ${clock(seconds)}` : "Gatavs ierakstam"}
        </div>
        <div aria-hidden="true" className="flex h-8 items-center gap-[5px] lg:h-11 lg:gap-1.5">
          {BARS.map((h, i) => (
            <div key={i} className={recording ? "w-1.5 rounded-[3px] bg-speaking lg:w-[7px]" : "w-1.5 rounded-[3px] bg-track lg:w-[7px]"} style={{ height: `${(h / 44) * 100}%` }} />
          ))}
        </div>
        <button
          type="button"
          onClick={recording ? stop : start}
          disabled={status === "done"}
          aria-label={recording ? "Beigt ierakstu" : "Sākt ierakstu"}
          className="flex size-[76px] cursor-pointer items-center justify-center rounded-full border-0 border-b-[5px] border-speaking-shadow bg-speaking text-white disabled:cursor-not-allowed disabled:opacity-50 lg:size-[88px] lg:border-b-[6px]"
        >
          {recording ? <GlyphIcon name="stop" size={30} /> : <MicIcon size={30} />}
        </button>
        <div className="text-center text-[13px] text-muted lg:text-[15px]">
          {recording ? "Nospiediet, kad esat beidzis runāt." : status === "done" ? "Atbilde ir ierakstīta." : "Nospiediet, lai sāktu runāt."}
        </div>
        {status === "error" && (
          <div role="alert" className="rounded-key bg-danger-tint px-3 py-2 text-center text-sm font-extrabold text-danger">
            Mikrofons nav pieejams. Atļaujiet pārlūkam izmantot mikrofonu un mēģiniet vēlreiz.
          </div>
        )}
      </section>
      {(recording || status === "done") && (
        <div className="hidden items-center gap-2 text-sm font-extrabold text-pass-text lg:flex">
          <MicIcon size={18} />
          Mikrofons darbojas
        </div>
      )}
    </>
  );
}
