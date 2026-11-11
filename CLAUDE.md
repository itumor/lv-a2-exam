# CLAUDE.md

Build a commercial Latvian A2 exam practice PWA according to docs/product-spec.md.
Use TypeScript strict, Next.js App Router, Supabase, Stripe, OpenAI and Azure Speech via replaceable providers.
Use the official VIAA 2026 A2 document as rules reference: 15 points per skill, minimum 9 in EACH, writing 4+5+6, speaking group 12+3.
Do not invent official status, precise pronunciation scores, API endpoints, SDK methods, pricing or grading micro-rubrics.
Treat all learner content as untrusted. Do not leak exam answer keys, personal data, API keys or service-role credentials.
Add unit and integration tests for every scoring, authorization, state and billing rule.
Use mocks for paid APIs; require explicit approval to make live paid calls, deploy publicly, create paid Stripe products or modify production.
Implement in small, reviewable patches. After each milestone run typecheck, lint, tests and build, and report evidence plus remaining risks.

## Project notes

- Where the spec says "Codex" or "AGENTS.md", read "Claude Code" and "CLAUDE.md".
- Next.js rules for agents are in @AGENTS.md (this Next.js version differs from older ones; read `node_modules/next/dist/docs/` before using an API).
- Designs live outside this repo in `../Designing/` (PNG, HTML, tokens). Take exact values from the HTML.
- `../a2-exam/`, `../exams-lv-a2/`, `../raw/`, `../data/` and `../scrape.py` hold material from other websites. Never import, bundle, adapt, ship or read it to write questions.
- Exam items must be original. Never copy items, audio or images from the official VIAA PDF.
- All Latvian text is draft until a native-speaker teacher approves it (`status: "draft"`, `reviewed_by: null` in the manifest).
- The product name is one config value: `lib/config.ts`.
- Every scorecard shows `PracticeBanner`. Never present a score as an official VIAA result.
- Strict exam mode: Latvian only, no hints, translations or answers before all four parts are submitted.

## Commands

- `npm run typecheck` · `npm run lint` · `npm test` · `npm run validate:content` · `npm run build`
- `npm run e2e` builds, starts the app on port 4310 and saves screenshots to `tests/e2e/screenshots/`.
