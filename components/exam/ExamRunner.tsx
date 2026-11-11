"use client";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { advanceAction, saveAnswerAction } from "@/app/exam/actions";
import { Card } from "@/components/ui/Card";
import { PersonIcon, SpeakerIcon } from "@/components/ui/icons";
import { SkillChip } from "@/components/ui/SkillChip";
import { buildSteps, type PublicItem, type PublicMedia, type PublicTask, type Step } from "@/lib/content/public";
import { isSpoken, type AnswerPayload, type Recording } from "@/lib/exam-engine/scoring";
import type { Skill } from "@/lib/exam-engine/rules";
import type { RunnerView } from "@/lib/server/attempts";
import { cx, SKILL_UI } from "@/lib/ui/skill";
import { AudioPlayer } from "./AudioPlayer";
import { ExamFooter } from "./ExamFooter";
import { ExamHeader } from "./ExamHeader";
import { LetterPicker } from "./LetterPicker";
import { OptionList } from "./OptionList";
import { Recorder } from "./Recorder";
import { insertAtCaret, LatvianKeys, WritingEditor } from "./WritingEditor";

type ActiveView = Extract<RunnerView, { state: "running" | "section_closed" }>;
type Answers = Record<string, AnswerPayload>;

const COLUMNS: Record<Skill, [string, string]> = {
  listening: ["lg:flex-[1_1_380px]", "lg:flex-[1_1_380px]"],
  reading: ["lg:flex-[3_1_440px]", "lg:flex-[2_1_320px]"],
  writing: ["lg:flex-[2_1_340px]", "lg:flex-[3_1_440px]"],
  speaking: ["lg:flex-[3_1_420px]", "lg:flex-[2_1_320px]"],
};

const FOOTER_NOTE: Record<Skill, string> = {
  listening: "Atbildes redzēsiet pēc visām četrām daļām.",
  reading: "Atbildes redzēsiet pēc visām četrām daļām.",
  writing: "Teksts tiek saglabāts automātiski.",
  speaking: "Īstajā eksāmenā jūs runājat ar eksaminētāju klātienē vai videokonferencē.",
};

const clock = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
};
const points = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "punkts" : "punkti"}`;
const choiceOf = (a: AnswerPayload | undefined) => (a && "choice" in a ? a.choice : undefined);
const textOf = (a: AnswerPayload | undefined) => (a && "text" in a ? a.text : "");
const recordingsOf = (a: AnswerPayload | undefined): (Recording | null)[] => (a && "recordings" in a ? a.recordings : []);

function isAnswered(step: Step, answers: Answers) {
  return step.itemIds.every((id) => {
    const a = answers[id];
    if (!a) return false;
    return step.part === null || Boolean(recordingsOf(a)[step.part]);
  });
}

/** Remaining time against the server deadline. The client clock is only used for its offset. */
function useRemaining(deadlineAt: number, serverNow: number) {
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    const offset = serverNow - Date.now();
    const timer = setInterval(() => setNow(Date.now() + offset), 500);
    return () => clearInterval(timer);
  }, [serverNow]);
  return Math.max(0, deadlineAt - now);
}

export function ExamRunner({ view }: { view: ActiveView }) {
  const { attemptId, skill, section } = view;
  const steps = useMemo(() => buildSteps(section), [section]);
  const [answers, setAnswers] = useState<Answers>(view.answers);
  // After a refresh, resume at the first screen that is not answered yet.
  const [stepIndex, setStepIndex] = useState(() => {
    const first = steps.findIndex((s) => !isAnswered(s, view.answers));
    return first === -1 ? steps.length - 1 : first;
  });
  // ponytail: play counts live in the browser, so a refresh resets them.
  // Enforce on the server once audio is served through signed media URLs.
  const [plays, setPlays] = useState<Record<string, number>>({});
  const [busy, startTransition] = useTransition();
  const remaining = useRemaining(view.deadlineAt, view.serverNow);
  const closed = view.state === "section_closed";

  // Text answers are saved 600 ms after the last keystroke; everything else at once.
  const unsaved = useRef(new Map<string, AnswerPayload>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const send = useCallback(
    async (itemId: string) => {
      const payload = unsaved.current.get(itemId);
      if (!payload) return;
      unsaved.current.delete(itemId);
      await saveAnswerAction(attemptId, itemId, payload);
    },
    [attemptId],
  );
  const flush = useCallback(async () => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
    await Promise.all([...unsaved.current.keys()].map(send));
  }, [send]);

  const answer = (itemId: string, payload: AnswerPayload) => {
    setAnswers((a) => ({ ...a, [itemId]: payload }));
    unsaved.current.set(itemId, payload);
    clearTimeout(timers.current.get(itemId));
    if ("text" in payload) timers.current.set(itemId, setTimeout(() => void send(itemId), 600));
    else void send(itemId);
  };

  const advance = useCallback(() => {
    startTransition(async () => {
      await flush();
      await advanceAction(attemptId, skill);
    });
  }, [attemptId, skill, flush]);

  // Time is up: the server has already frozen the section; move on.
  const expired = useRef(false);
  useEffect(() => {
    if (remaining === 0 && !closed && !expired.current) {
      expired.current = true;
      advance();
    }
  }, [remaining, closed, advance]);

  useEffect(() => {
    // braces matter: newer browsers return a Promise from scrollTo, which is not a valid cleanup
    window.scrollTo(0, 0);
  }, [stepIndex]);

  if (closed) {
    return (
      <>
        <ExamHeader skill={skill} time="00:00" />
        <main lang="lv" className="gutter mx-auto w-full max-w-[640px] pt-6">
          <Card className="p-5">
            <h1 className="m-0 text-[22px] font-black">Šīs daļas laiks ir beidzies</h1>
            <p className="mt-2 mb-0 text-muted">Jūsu atbildes ir saglabātas. Turpiniet ar nākamo daļu.</p>
          </Card>
        </main>
        <ExamFooter label="Turpināt" onNext={advance} busy={busy} />
      </>
    );
  }

  const step = steps[stepIndex];
  const task = section.tasks.find((t) => t.taskNumber === step.taskNumber)!;
  const items = step.itemIds.map((id) => section.items.find((i) => i.externalId === id)!);
  const last = stepIndex === steps.length - 1;
  const nextStep = steps[stepIndex + 1];
  const label = last
    ? skill === "speaking" ? "Pabeigt eksāmenu" : "Iesniegt un turpināt"
    : items[0].kind === "picture_description" && nextStep.itemIds[0] === step.itemIds[0] ? "Nākamais attēls" : "Tālāk";
  const next = () => {
    if (last) return advance();
    void flush();
    setStepIndex(stepIndex + 1);
  };

  const [left, right] = COLUMNS[skill];
  const taskPoints = section.items.filter((i) => i.taskNumber === task.taskNumber).reduce((sum, i) => sum + i.maxPoints, 0);
  const target = items[0].targetWords;

  return (
    <>
      <ExamHeader skill={skill} time={clock(remaining)} />
      <main lang="lv" className={cx("gutter mx-auto flex w-full max-w-[1120px] flex-col pt-1 pb-4 lg:flex-row lg:flex-wrap lg:gap-10 lg:py-10", skill === "listening" ? "gap-4" : "gap-3")}>
        <div className={cx("flex min-w-0 flex-col lg:gap-[18px]", skill === "listening" ? "gap-4" : "gap-3", left)}>
          <div className="flex items-center justify-between gap-3 lg:justify-start">
            <SkillChip skill={skill}>
              <span className="lg:hidden">{SKILL_UI[skill].lv} · </span>
              {task.taskNumber}. uzdevums
            </SkillChip>
            <div className="text-[13px] font-extrabold text-muted lg:text-sm">
              {step.count > 1 && task.unitLv ? `${step.index + 1}. ${task.unitLv} no ${step.count}` : points(taskPoints)}
              {target && <span className="hidden lg:inline"> · apmēram {target} vārdi</span>}
            </div>
          </div>
          <Stimulus skill={skill} task={task} item={items[0]} part={step.part} plays={plays} onPlayed={(id) => setPlays((p) => ({ ...p, [id]: (p[id] ?? 0) + 1 }))} />
        </div>
        <div className={cx("flex min-w-0 flex-col gap-3 lg:gap-[18px]", right)}>
          <Response key={`${step.itemIds[0]}-${step.part}`} skill={skill} task={task} items={items} part={step.part} answers={answers} onAnswer={answer} />
        </div>
      </main>
      <ExamFooter
        label={label}
        onNext={next}
        busy={busy}
        note={FOOTER_NOTE[skill]}
        mobileNote={skill === "listening" ? "Eksāmena režīms: atbildes redzēsiet pēc visām četrām daļām." : undefined}
      />
    </>
  );
}

const instructionClass = "m-0 text-[15px] leading-[1.4] text-muted lg:text-lg lg:leading-[1.45] lg:text-ink-soft";
const noteClass = "hidden text-sm leading-[1.45] text-muted lg:block";

/** Left column: what the learner listens to, reads or looks at. */
function Stimulus({ skill, task, item, part, plays, onPlayed }: { skill: Skill; task: PublicTask; item: PublicItem; part: number | null; plays: Record<string, number>; onPlayed: (mediaId: string) => void }) {
  const audio = item.media.find((m) => m.kind === "audio") ?? (task.shared.media?.kind === "audio" ? task.shared.media : undefined);
  const text = task.shared.textLv ?? item.prompt.textLv;

  if (skill === "writing") {
    const open = item.kind === "free_text";
    return (
      <>
        {open ? (
          <Card as="section" className="px-4 py-3.5 lg:rounded-[22px] lg:px-6 lg:py-[22px]">
            <p className="m-0 text-[15px] leading-[1.4] font-extrabold lg:text-[19px] lg:leading-[1.45]">{item.prompt.lv}</p>
            {item.prompt.planLv && (
              <ol className="mt-2 mb-0 list-decimal pl-5 text-sm leading-normal lg:mt-3 lg:pl-6 lg:text-[17px] lg:leading-[1.7]">
                {item.prompt.planLv.map(([verb, rest]) => (
                  <li key={verb}>
                    <strong className="font-black">{verb}</strong>
                    {rest}
                  </li>
                ))}
              </ol>
            )}
            {item.prompt.cardLv && (
              <ul className="mt-2 mb-0 list-none rounded-key bg-ground p-3 text-sm leading-normal lg:text-[17px]">
                {item.prompt.cardLv.map((line) => <li key={line}>{line}</li>)}
              </ul>
            )}
            {item.media.filter((m) => m.kind === "image").map((m) => <Picture key={m.id} media={m} className="mt-3" />)}
          </Card>
        ) : (
          <p className={instructionClass}>{task.instructionLv}</p>
        )}
        <div className={noteClass}>Īstajā eksāmenā šo daļu raksta ar roku uz papīra.</div>
      </>
    );
  }

  if (skill === "speaking") {
    const picture = item.kind === "picture_description" ? item.media.filter((m) => m.kind === "image")[part ?? 0] : undefined;
    const advert = item.prompt.advertsLv?.[part ?? 0];
    const hasStimulus = Boolean(picture || advert);
    return (
      <>
        <Examiner item={item} part={part} className={hasStimulus ? "lg:hidden" : undefined} />
        {picture && <Picture media={picture} />}
        {advert && <Advert letter={advert.id} title={advert.titleLv} body={advert.bodyLv} skill={skill} />}
      </>
    );
  }

  return (
    <>
      <p className={instructionClass}>{task.instructionLv}</p>
      {audio && (
        <>
          <AudioPlayer key={audio.id} src={audio.src} durationSec={audio.durationSec ?? 20} plays={plays[audio.id] ?? 0} onPlayed={() => onPlayed(audio.id)} />
          <div className={noteClass}>Eksāmena režīmā ierakstu nevar klausīties trešo reizi.</div>
        </>
      )}
      {task.shared.adverts && (
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:gap-3.5">
          {task.shared.adverts.map((a) => <Advert key={a.id} letter={a.id} title={a.titleLv} body={a.bodyLv} skill={skill} />)}
        </div>
      )}
      {text && <Card className="px-4 py-3.5 text-[15px] leading-normal lg:rounded-[20px] lg:p-[18px] lg:text-[17px]">{text}</Card>}
    </>
  );
}

/** Right column: where the learner answers. */
function Response({ skill, task, items, part, answers, onAnswer }: { skill: Skill; task: PublicTask; items: PublicItem[]; part: number | null; answers: Answers; onAnswer: (itemId: string, payload: AnswerPayload) => void }) {
  const active = useRef<HTMLInputElement | null>(null);
  const [first] = items;

  if (first.kind === "free_text") {
    return (
      <WritingEditor
        id={first.externalId}
        label={first.prompt.planLv ? "Jūsu e-pasts" : "Jūsu teksts"}
        value={textOf(answers[first.externalId])}
        onChange={(text) => onAnswer(first.externalId, { text })}
        targetWords={first.targetWords ?? first.minWords ?? 35}
      />
    );
  }

  if (first.kind === "word_form") {
    return (
      <>
        {items.map((item, i) => (
          <div key={item.externalId} className="flex flex-col gap-1.5">
            <label htmlFor={item.externalId} className="text-[15px] leading-[1.4] font-extrabold lg:text-[17px]">
              {i + 1}. {item.prompt.lv}
            </label>
            <input
              id={item.externalId}
              type="text"
              lang="lv"
              maxLength={60}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="none"
              value={textOf(answers[item.externalId])}
              onFocus={(e) => (active.current = e.currentTarget)}
              onChange={(e) => onAnswer(item.externalId, { text: e.target.value })}
              className="h-12 rounded-control border-2 border-writing bg-surface px-3.5 text-[17px] font-bold text-ink"
            />
          </div>
        ))}
        <LatvianKeys onInsert={(letter) => active.current && onAnswer(active.current.id, { text: insertAtCaret(active.current, letter) })} />
      </>
    );
  }

  if (isSpoken(first.kind)) {
    const recordings = recordingsOf(answers[first.externalId]);
    const hasStimulus = first.kind !== "interview";
    return (
      <>
        {hasStimulus && <Examiner item={first} part={part} className="hidden lg:flex" />}
        <Recorder
          doneSec={recordings[part ?? 0]?.durationSec ?? null}
          onDone={(durationSec) => {
            const next = Array.from({ length: first.partCount }, (_, i) => recordings[i] ?? null);
            next[part ?? 0] = { durationSec };
            onAnswer(first.externalId, { recordings: next });
          }}
        />
      </>
    );
  }

  // choices: one question per screen, or several short ones for a shared text or dialogue
  const single = items.length === 1;
  return (
    <>
      {items.map((item) => {
        const options = item.options.map((o) => ({ id: o.id, label: o.lv }));
        const props = { name: item.externalId, options, value: choiceOf(answers[item.externalId]), onChange: (choice: string) => onAnswer(item.externalId, { choice }), skill };
        if (item.kind === "match") {
          return (
            <div key={item.externalId} className="flex flex-col gap-3 lg:gap-[18px]">
              <section className="rounded-card bg-accent-tint px-4 py-3.5 lg:rounded-[22px] lg:px-6 lg:py-[22px]">
                <div className="text-xs font-black tracking-[0.06em] text-accent-text uppercase lg:text-[13px]">Situācija</div>
                <p className="mt-1 mb-0 text-base leading-[1.4] font-extrabold lg:mt-1.5 lg:text-xl lg:leading-[1.45]">{item.prompt.lv}</p>
              </section>
              <div className="hidden text-[15px] font-black lg:block">Jūsu atbilde</div>
              <LetterPicker {...props} label="Sludinājums" />
            </div>
          );
        }
        const compact = !single || item.kind === "word_bank";
        return (
          <div key={item.externalId} className="flex flex-col gap-2.5 lg:gap-[18px]">
            {single ? (
              <h1 className="mt-1 mb-0 text-[22px] leading-tight font-black lg:mt-0 lg:text-[30px]">{item.prompt.lv}</h1>
            ) : (
              <h2 className="m-0 text-[17px] leading-[1.3] font-black lg:text-xl">{item.prompt.lv}</h2>
            )}
            {compact ? (
              <LetterPicker {...props} label={single ? "Atbildes" : item.prompt.lv} columns={item.kind === "true_false" ? 2 : 3} />
            ) : (
              <OptionList {...props} label="Atbildes" />
            )}
          </div>
        );
      })}
      {task.placeholder && <p className="m-0 text-[13px] text-muted">[VIETTURIS] Šim uzdevumam vēl nav dizaina un pārbaudīta satura.</p>}
    </>
  );
}

function Examiner({ item, part, className }: { item: PublicItem; part: number | null; className?: string }) {
  const text = item.prompt.questionsLv?.[part ?? 0] ?? item.prompt.lv;
  return (
    <Card className={cx("flex items-center gap-2.5 px-3 py-2.5 lg:gap-3.5 lg:rounded-[22px] lg:px-[18px] lg:py-4", className)}>
      <div aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white lg:size-[52px]">
        <PersonIcon />
      </div>
      <div className="grow">
        <div className="hidden text-[13px] font-black text-muted lg:block">Eksaminētājs</div>
        <p className="m-0 text-[15px] leading-[1.35] font-extrabold lg:mt-0.5 lg:text-lg lg:leading-[1.4]">{text}</p>
      </div>
      {/* ponytail: examiner audio is not recorded yet, so replay is disabled until TTS assets exist. */}
      <button type="button" disabled aria-label="Atkārtot jautājumu" className="flex size-11 shrink-0 items-center justify-center rounded-control border-2 border-line bg-ground text-primary-text disabled:opacity-50 lg:size-12">
        <SpeakerIcon size={22} />
      </button>
    </Card>
  );
}

function Picture({ media, className }: { media: PublicMedia; className?: string }) {
  if (!media.src) {
    return (
      <div role="img" aria-label={media.descriptionLv} className={cx("flex aspect-[350/210] w-full items-center justify-center rounded-[20px] border-2 border-dashed border-line-strong bg-surface p-4 text-center text-sm text-muted lg:rounded-3xl", className)}>
        {media.descriptionLv}
      </div>
    );
  }
  return <Image src={`/${media.src}`} alt={media.descriptionLv ?? ""} width={350} height={210} unoptimized priority className={cx("block h-auto w-full rounded-[20px] lg:rounded-3xl", className)} />;
}

function Advert({ letter, title, body, skill }: { letter: string; title: string; body: string; skill: Skill }) {
  const ui = SKILL_UI[skill];
  return (
    <Card className="flex gap-2.5 rounded-control px-3 py-2.5 lg:min-w-0 lg:flex-[1_1_240px] lg:flex-col lg:rounded-[20px] lg:p-[18px]">
      <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-[9px] text-sm font-black lg:size-[34px] lg:rounded-[10px] lg:text-base", ui.tint, ui.text)}>{letter}</span>
      <p className="m-0 text-sm leading-[1.35] lg:text-[17px] lg:leading-[1.45]">
        <strong className="font-black">{title}</strong> {body}
      </p>
    </Card>
  );
}
