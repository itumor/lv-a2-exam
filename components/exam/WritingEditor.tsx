"use client";
import { useRef } from "react";

export const LATVIAN_LETTERS = ["ā", "č", "ē", "ģ", "ī", "ķ", "ļ", "ņ", "š", "ū", "ž"];
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/**
 * Insert `text` at the caret of a controlled field. The DOM value is not touched
 * (React would then miss the next change); the new value goes through `onChange`
 * and the caret is restored after the re-render.
 */
export function insertAtCaret(el: HTMLInputElement | HTMLTextAreaElement, text: string, onChange: (value: string) => void) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const value = el.value.slice(0, start) + text + el.value.slice(end);
  if (el.maxLength > 0 && value.length > el.maxLength) return;
  onChange(value);
  requestAnimationFrame(() => el.setSelectionRange(start + text.length, start + text.length));
}

/** Keys for the letters a non-Latvian keyboard lacks. */
export function LatvianKeys({ onInsert }: { onInsert: (letter: string) => void }) {
  return (
    <div role="group" aria-label="Latviešu burti" className="grid grid-cols-6 gap-1.5 lg:flex lg:flex-wrap lg:gap-2">
      {LATVIAN_LETTERS.map((letter) => (
        <button
          key={letter}
          type="button"
          // keep the caret in the text field
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(letter)}
          className="h-11 cursor-pointer rounded-key border-2 border-b-4 border-line bg-surface text-lg font-black text-ink lg:size-12 lg:text-[19px]"
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

/** Text area with a word counter against the task target and Latvian letter keys. */
export function WritingEditor({ id, label, value, onChange, targetWords }: { id: string; label: string; value: string; onChange: (text: string) => void; targetWords: number }) {
  const field = useRef<HTMLTextAreaElement>(null);
  const words = countWords(value);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 lg:gap-3">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm font-black lg:text-base">
            {label}
          </label>
          <span className="text-[13px] font-black text-writing-shadow lg:text-[15px]">
            {words} no {targetWords} vārdiem
          </span>
        </div>
        <textarea
          ref={field}
          id={id}
          lang="lv"
          rows={6}
          maxLength={2000}
          spellCheck={false}
          autoCorrect="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-[170px] w-full resize-none rounded-button border-2 border-writing bg-surface px-3.5 py-3 text-[17px] leading-[1.45] font-bold text-ink lg:h-[280px] lg:resize-y lg:rounded-[20px] lg:px-5 lg:py-[18px] lg:text-[19px] lg:leading-normal"
        />
        <div role="img" aria-label={`${words} no ${targetWords} vārdiem`} className="h-2 rounded-full bg-track">
          <div className="h-2 rounded-full bg-writing" style={{ width: `${Math.min(100, (words / targetWords) * 100)}%` }} />
        </div>
      </div>
      <LatvianKeys onInsert={(letter) => field.current && insertAtCaret(field.current, letter, onChange)} />
    </div>
  );
}
