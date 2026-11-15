# Claude Code prompt — build the Latvian A2 exam simulator from the designs

Paste everything below the line into Claude Code, started in `/Users/eramadan/LV`.

---

You are building a commercial Latvian A2 exam practice web app (mobile-first PWA, with a desktop layout). Work in this folder, `/Users/eramadan/LV`.

## Read these first, in this order

1. `Latvian_A2_AI_Exam_Simulator_Implementation_Spec.md` — the product and technical spec. It is the source of truth for architecture, data model, API contracts, scoring and rules. Where it says "Codex" or "AGENTS.md", read "Claude Code" and "CLAUDE.md".
2. `Designing/README.md` — index of the design export.
3. `Designing/png/*.png` — look at all 14 screens (7 mobile, 7 desktop).
4. `Designing/html/*.html` — the same screens as standalone HTML with inline styles. Take exact spacing, sizes, colours, copy and icon SVGs from here.
5. `Designing/tokens/design-tokens.json` and `tokens.css` — the design tokens.
6. `official-data/pamata_a2_limenis.pdf` — the official VIAA 2026 A2 sample. Use it for exam structure, task formats and assessment criteria.

## What to build in this session

Milestone M0 and the front end of M1 from the spec, with mock data and mock providers only. Stop when this is done and report.

1. Create the app in a new folder `app-web/` (do not touch the existing folders): Next.js App Router, TypeScript strict, Tailwind CSS, Vitest, Playwright, ESLint. Add `CLAUDE.md` at the repo root with the persistent instructions from spec section 17, and copy the spec to `app-web/docs/product-spec.md`.
2. Put the design tokens into the Tailwind theme (colours, radii, font). Load Nunito with `next/font` including the `latin-ext` subset, because Latvian needs ā č ē ģ ī ķ ļ ņ š ū ž.
3. Build shared components that match the designs: `ChunkyButton`, `Card`, `SkillChip`, `ExamHeader` (close, four-segment progress, countdown), `ExamFooter`, `AudioPlayer`, `OptionList`, `LetterPicker` (A–D), `WritingEditor` (word counter and Latvian letter keys), `Recorder`, `ScoreBar` (with the pass marker at 9 of 15), `ScoreRing`, `PracticeBanner` ("AI practice estimate. Not an official VIAA result or certificate."), `TopNav` (desktop) and `BottomNav` (mobile).
4. Build these routes so they match the designs at both sizes. One responsive page per route: the mobile design below 768 px, the desktop design from 1024 px, and a sensible in-between.
   - `/dashboard` → `Main` / `DesktopHome`
   - `/exam/[id]` → the four-section runner: `Listening`, `Reading`, `Writing`, `Speaking` and their desktop versions
   - `/exam/[id]/results` → `Results` / `DesktopResults`
   - `/exam/[id]/results/writing/[task]` → `Feedback` / `DesktopFeedback`
5. Implement the pure exam engine in `lib/exam-engine/` exactly as spec sections 7–9 describe: attempt and section state machines, server-authoritative deadlines, the `passed` and `totalScore` functions, deterministic scoring for listening, reading and writing task 2. Unit-test it, including `9/9/9/9 → pass` and `15/15/8/15 → fail`, and that a pending evaluation is neither pass nor fail.
6. Add one content manifest in `content/exam-sets/` that follows spec section 8, and `scripts/validate-content.ts` that enforces the point structure below. Fill it with the mock items from the designs plus clearly marked placeholders for the task types that have no design yet. Mark the whole set `status: "draft"`, `reviewed_by: null`.
7. Mock providers behind interfaces in `lib/providers/` for speech-to-text, text-to-speech and AI grading. No real API keys, no paid calls.

## Exam rules that must hold (from the official PDF)

- Four parts, 15 points each, 60 in total. Listening 25 min, reading 30 min, writing 35 min, speaking 10–15 min.
- Pass only if every part is at least 9 of 15. A high total never compensates for one part below 9.
- Listening: task 1 six announcements, one of three answers (6 points); task 2 one dialogue, four true/false statements (4); task 3 five short dialogues, fill five gaps from nine words (5). Each recording plays twice.
- Reading: task 1 four texts, choose the correct statement of three (4); task 2 six situations, match adverts A–D (6); task 3 one text with five gaps, three choices each (5).
- Writing: task 1 describe a person from pictures and a card, minimum 30 words (4); task 2 five word forms (5); task 3 e-mail or similar from five plan points, about 35 words (6).
- Speaking: task 1 answer 9–10 examiner questions and task 2 describe two pictures share 12 points; task 3 ask three questions about adverts with missing information (3).
- Every scorecard shows the practice banner. Never present a score as an official VIAA result.

## Design rules

- Match the PNGs. Use the HTML files for exact values instead of estimating from the images.
- Skill colours are fixed: listening blue, reading green, writing orange, speaking magenta. Pass and fail are also shown in words, never by colour alone.
- Buttons and links are real `<button>` and `<a>` elements, touch targets at least 44 px, visible focus states, text contrast at least 4.5:1.
- In strict exam mode the exam content is Latvian only, with no hints, translations or answers before all four parts are submitted. Explanations in English or Arabic appear only in results and practice. The Arabic explanation view must render right-to-left.
- "Kāpnes A2" is a working name. Keep the product name in one config value.

## Content rules

- Exam items must be original and written in the official task formats. Do not copy items, audio or images from the official PDF into the product.
- The folders `a2-exam/`, `exams-lv-a2/`, `raw/`, `data/` and `scrape.py` hold material collected from other websites. Do not import, bundle, adapt or ship any of it, and do not read it to generate questions. It belongs to someone else.
- All Latvian text in the mock set is unreviewed. Keep it flagged as draft until a native-speaker teacher approves it.

## Working rules

- Small, reviewable commits on a new git branch. Do not push, deploy, create Stripe products or call paid APIs without my explicit approval.
- Treat learner input as untrusted. Never send answer keys to the client before submission.
- After each step run typecheck, lint, unit tests and build. Add Playwright checks that load each route at 390x844 and 1280x800 and save screenshots to `app-web/tests/e2e/screenshots/` so I can compare them with `Designing/png/`.
- When you finish, report: files changed, exact test results, screenshots taken, where the build differs from the designs and why, and what is blocked.

## Later sessions (do not start these now)

Supabase Auth, migrations and RLS; Azure Speech for lv-LV and recording upload; AI grading with structured outputs; Stripe subscriptions and quotas; teacher review and launch gate. Each follows the matching section and prompt in the spec.
