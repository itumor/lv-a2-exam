# Latvian A2 AI Exam Simulator

## Product requirements and first-build technical specification

Version: 1.0, 10 November 2026
Owner: Ebrahim
Audience: Commercial subscriptions
Platform: Mobile-first web app and progressive web app (PWA)
Operating budget ceiling: EUR 200 per month
Implementation: Codex + GitHub, with production changes requiring owner approval
Status: Development specification; no app has been deployed

### 1. Executive recommendation

Build an exam simulator matching the VIAA 2026 Latvian A2 structure. The first release should use original, teacher-approved examination questions, prerecorded Latvian audio, image-based speaking questions, recorded answers, deterministic scoring for objective questions, and evidence-backed AI practice estimates for written and spoken answers. Add commercial subscriptions with tight API consumption limits. Defer animated avatars until paid demand and scoring reliability are demonstrated.

Stack:

- Next.js App Router, TypeScript strict, React, Tailwind CSS, responsive PWA.
- Supabase Auth, PostgreSQL with Row Level Security (RLS), private object storage.
- Vercel Pro for production and GitHub CI/CD.
- OpenAI Responses API, gpt-6.1-terra, Zod Structured Outputs for open-answer scoring.
- Azure Speech, lv-LV for STT and Latvian neural TTS; benchmark gpt-transcribe as fallback.
- Stripe Checkout subscriptions, Customer Portal, verified webhooks.
- Vitest, Playwright, typed JSON contracts, documented provider abstraction.

Avoid running Kubernetes, agents, realtime video generation, or a separately managed Python service for v1. These add work and cost without helping learners pass A2.

### 2. Non-negotiable official exam requirements

Source: https://www.viaa.gov.lv/lv/media/27351/download?attachment=

| Skill | Duration | Maximum points | Pass minimum |
|---|---:|---:|---:|
| Listening | 25 minutes | 15 | 9 |
| Reading | 30 minutes | 15 | 9 |
| Writing | 35 minutes | 15 | 9 |
| Speaking | 10–15 minutes | 15 | 9 |

The actual exam passes only if EACH skill is at least 9/15. Total is 60 points but a strong score in one skill does not compensate for failure in another. In the official exam, writing is on paper and speaking is live/in videoconference; the browser version is a simulation.

The 2026 official writing tasks are:

1. Describe a person using pictures and profile information, approximately 30 words: 4 points.
2. Supply the correct grammatical form in five blanks: 5 points, normally one each.
3. Write a short situational email/letter/invitation according to stated instructions, approximately 35 words: 6 points.

The 2026 official speaking tasks are:

1. Answer 9–10 questions from an examiner about everyday life.
2. Describe TWO pictures with full sentences.
3. Ask THREE questions to obtain missing information from short advertisements.

Tasks 1 and 2 of speaking share a combined 12 points; task 3 has 3 points. Any further internal allocation (for example 6/6 for the first two tasks) is our own provisional rubric and must be teacher-calibrated, not represented as an official VIAA micro-weight.

Provide a clear banner on every scorecard: AI-generated practice score, not an official VIAA result or certificate.

### 3. MVP requirements, user journeys and exclusions

User flow: Landing > Pricing > Register > Dashboard > Select exam > Equipment check > Four timed sections > Submit > Results > Corrected answers > Suggested practice.

Routes:

- / : SEO-friendly marketing and disclaimer.
- /pricing : configurable commercial plans and checkout.
- /auth : login/signup/logout and OAuth/email callback if enabled.
- /dashboard : previous attempts, progress, current entitlement.
- /exam/new : select one approved A2 mock test.
- /exam/[id] : timed, autosaving four-section runner.
- /exam/[id]/results : four scores, rationale, corrections, next-practice plan.
- /practice : writing and speaking drills, quotas enforced.
- /account : language, privacy, recording deletion, data export.
- /billing : Stripe Customer Portal.
- /admin : teacher content approval, grading review queue, system usage.

Strict exam mode: server deadlines, no hints or answer keys before submission, no English or Arabic translation of exam content, section freeze on timeout, results only when all sections are evaluated.

Practice mode: may replay audio, provide English or Arabic explanations, show corrections after each exercise; clearly distinguish from strict simulation.

Accessibility: WCAG-minded contrast and focus order, accessible recorder, visual captions for UI controls, keyboard navigation, readable errors. Do not introduce hidden help that changes exam conditions.

PWA: installable, cache only immutable static exam media; do NOT cache personal transcripts, paid entitlements or API responses for offline access. Offline attempt submission is out of scope.

Explicit v1 exclusions: official certification, guaranteed pass predictions, unsupported phoneme-level pronunciation scoring, native App Store distribution, realtime photorealistic avatars, autogenerated unreviewed questions, unlimited chat, unsupported copying of official VIAA exam media.

### 4. Commercial subscription design

Hypotheses to test with beta users, not final public pricing:

| Plan | Proposed price | Monthly limit |
|---|---:|---|
| Free | EUR 0 | One limited demo/diagnostic, small capped audio allowance |
| Starter | EUR 6.99 | 3 full exams plus 30 additional speaking-practice minutes |
| Plus | EUR 12.99 | 10 full exams plus 120 additional speaking-practice minutes |

Limits and price IDs must be server-owned plan records. Every exam reserves a quota unit transactionally. Starting the same exam twice or retrying a request cannot consume quota twice. On paid cancellation or payment failure, re-evaluate entitlement using verified Stripe subscription records. Do not give unrestricted APIs to anonymous users.

### 5. Architecture

~~~mermaid
flowchart TD
  P["Mobile browser / PWA"] --> A["Next.js authenticated API"]
  A --> E["Exam / entitlement engine"]
  A --> S["Supabase Auth, DB, Storage"]
  E --> O["OpenAI grading adapter"]
  E --> V["Azure Speech and STT fallback adapters"]
  A --> B["Stripe billing webhooks"]
~~~

Trust boundary: vendor API keys, Supabase secret key and Stripe signing secret live only on the server. Frontend receives only user-scoped data and short-lived credentials required by browser speech. Store private learner recordings in nonpublic buckets and grant short-lived signed access after verifying ownership.

Proposed repository:

~~~text
app/
  (public)/             # landing, pricing and legal pages
  (auth)/               # login and callback
  (app)/                # exam runner, dashboard, practice, account
  api/                  # JSON API route handlers
components/
  exam/                 # timers, choices, audio, images, recorder
  results/
lib/
  exam-engine/          # pure scoring and attempt state machine
  providers/            # interfaces, Azure and OpenAI adapters
  grading/              # prompts, Zod schema, rubric versions
  billing/              # Stripe, entitlements, quota reservations
  auth/
  db/
  cost/                 # metering, global budget headroom
supabase/
  migrations/
content/
  exam-sets/            # versioned original, reviewed JSON manifests
  rubrics/
scripts/
  validate-content.ts
  generate-cached-audio.ts
tests/
  unit/
  integration/
  e2e/
  golden/               # educator-reviewed samples
docs/
  product-spec.md
  runbooks/
  adr/
.env.example
~~~

All test content should be validated and versioned before being used for a paid examination. Published sets are immutable: edit by publishing a new version.

### 6. PostgreSQL data model

Implement via idempotent Supabase SQL migrations; use UUID primary keys, timestamptz, server-generated IDs, foreign keys, CHECK constraints, indexes and RLS. Exact logical schema:

| Table | Columns (core) | Constraints / responsibilities |
|---|---|---|
| profiles | id UUID PK FK auth.users; display_name TEXT; ui_language TEXT; role TEXT; created_at TIMESTAMPTZ | User owns profile; role server-controlled |
| plans | code TEXT PK; stripe_price_id TEXT; full_exam_limit INT; speaking_minutes_limit INT; active BOOL | Admin-write only |
| subscriptions | id UUID PK; user_id UUID FK; stripe_customer_id TEXT; stripe_subscription_id TEXT UNIQUE; plan_code TEXT FK; status TEXT; current_period_end TIMESTAMPTZ | Webhook/server writes |
| quota_periods | user_id UUID; period_start DATE; metric TEXT; consumed NUMERIC; reserved NUMERIC; allowance NUMERIC | UNIQUE(user_id,period_start,metric) |
| exam_blueprints | id UUID PK; level TEXT; version INT; official_rules JSONB; status TEXT | A2 2026 rules, immutable published |
| exam_sets | id UUID PK; blueprint_id UUID; slug TEXT; version INT; title TEXT; status TEXT; reviewed_by UUID; published_at TIMESTAMPTZ | Approved sets only |
| questions | id UUID PK; exam_set_id UUID; section TEXT; task_number INT; position INT; kind TEXT; prompt JSONB; options JSONB; answer_key JSONB; rubric JSONB; max_points INT; media JSONB | Answer keys server-only |
| media_assets | id UUID PK; owner_user_id UUID NULL; object_path TEXT; mime_type TEXT; media_kind TEXT; sha256 TEXT; purge_after TIMESTAMPTZ | Public curated or private user audio |
| exam_attempts | id UUID PK; user_id UUID; exam_set_id UUID; mode TEXT; status TEXT; started_at; submitted_at; completed_at; total_score INT NULL; passed BOOL NULL | Server state machine |
| attempt_sections | id UUID PK; attempt_id UUID; section TEXT; started_at; deadline_at; submitted_at; status TEXT; score INT NULL | UNIQUE(attempt_id,section) |
| answers | id UUID PK; attempt_id UUID; question_id UUID; payload JSONB; audio_asset_id UUID NULL; transcript TEXT NULL; revision INT; saved_at TIMESTAMPTZ | UNIQUE(attempt_id,question_id) |
| evaluations | id UUID PK; answer_id UUID; rubric_version TEXT; model_id TEXT; score INT; max_points INT; feedback JSONB; uncertainty TEXT; status TEXT; provider_request_id TEXT | Traceable, bounded AI grade |
| human_reviews | id UUID PK; evaluation_id UUID; reviewer_id UUID; override_score INT NULL; reason TEXT; status TEXT | Native-speaker review |
| ai_usage_events | id UUID PK; user_id UUID; attempt_id UUID; provider TEXT; operation TEXT; input_units NUMERIC; output_units NUMERIC; estimated_cost_eur NUMERIC; request_key TEXT UNIQUE; created_at | Cost audit and deduplication |
| stripe_webhook_events | stripe_event_id TEXT PK; event_type TEXT; outcome TEXT; processed_at TIMESTAMPTZ | Replay-safe webhook |

Minimum indexes: attempts(user_id,started_at DESC), answers(attempt_id), evaluations(answer_id), subscriptions(user_id), quota_periods(user_id,period_start,metric).

Recommended example RLS, adapted in a real migration:

~~~sql
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_attempts_read
  ON public.exam_attempts
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE INDEX IF NOT EXISTS idx_attempt_user_time
  ON public.exam_attempts(user_id, started_at DESC);
~~~

Apply RLS to all exposed tables. Use narrowly scoped server routes for writing bills, quotas and grades. Never expose raw question answer_key values through a client table query; put keys in a private schema or a server-only projection. A guessed ID must never reveal another learner's result, subscription or media.

### 7. Attempt state and REST contracts

Attempt states: created -> active -> submitted -> evaluating -> completed | needs_review | failed. Section states: not_started -> in_progress -> submitted | expired. All transitions are server-controlled and idempotent; persisted UTC deadline is authoritative. A provider failure leaves an attempt pending for retry/review, without changing frozen learner answers.

| Method and path | Request | Response and access |
|---|---|---|
| GET /api/exams/catalog | optional level=A2 | Published summaries, never keys |
| POST /api/attempts | examSetId, mode, idempotencyKey | Reserved quota, new or existing attemptId |
| GET /api/attempts/:id | none | Authenticated owner, current state, saved answers, deadlines |
| POST /api/attempts/:id/sections/:section/start | idempotencyKey | Server deadline, same result on retry |
| PUT /api/attempts/:id/answers/:questionId | payload, clientRevision | Saved answer/revision; reject after deadline |
| POST /api/attempts/:id/audio/init | questionId, bytes, MIME, duration | Private temporary signed upload capability |
| POST /api/attempts/:id/audio/complete | assetId, checksum | Validate storage, finalize ownership |
| POST /api/attempts/:id/sections/:section/submit | idempotencyKey | Freeze section |
| POST /api/attempts/:id/submit | idempotencyKey | 202 evaluating/pending |
| GET /api/attempts/:id/results | none | 4 scores and feedback only after completion |
| GET /api/me/entitlements | none | Plan, remaining exams/minutes, renewal time |
| POST /api/billing/checkout | planCode | Stripe Checkout URL from server-known price |
| POST /api/billing/portal | none | Stripe Customer Portal URL |
| POST /api/webhooks/stripe | raw body | Verified signature and event dedupe |
| DELETE /api/me/recordings | confirmed preference | User-owned blobs queued for purge |
| GET /api/me/export | none | Own history only |

HTTP errors are typed: 401 unauthenticated; 403 ownership/plan; 409 stale revision or invalid state; 413 oversized recording; 422 invalid question answer; 429 quota exhaustion; 503 provider outage. Never return stack traces, provider API keys, answer keys before submit, or another user's data.

### 8. Content manifest and validation

One exam set = immutable JSON manifest containing schemaVersion, examSetSlug, version, approved reviewer, blueprint ID and 4 arrays of task items. Each item must have stable externalId, section, taskNumber, kind, prompt.lv, options, private answerKey, maxPoints, rubricVersion and media asset hash.

Sample authored question:

~~~json
{
  "externalId": "A2-ORIGINAL-001-W2-Q1",
  "section": "writing",
  "taskNumber": 2,
  "kind": "word_form",
  "prompt": {"lv": "Mēs gatavojamies ... (vasara)."},
  "answerKey": {"accepted": ["vasarai"]},
  "maxPoints": 1,
  "rubricVersion": "a2-2026-v1",
  "media": []
}
~~~

Build script validates: no duplicates, each section max exactly 15, writing points 4+5+6, speaking grouped 12+3, exactly 2 picture stimuli for speaking task 2, 3 adverts for task 3, 9–10 interview questions, all referenced media exists, all protected answer keys withheld from client, every image has a description and review status.

The application must NOT generate high-stakes question/answer/rubric triples just-in-time for a learner. Generate originals offline, review in Latvian, freeze and publish. Reuse audio and image assets across attempts.

### 9. AI evaluation and scoring

Listening/reading: fixed server-side scoring against reviewed keys. Writing task 2: 5 deterministic word-form points. For writing tasks 1 and 3 and speaking tasks, an LLM provides structured practice estimates supported by explicit evidence; never override official task maxima or pass rules.

**Writing internal rubric proposals** (not official micro-weights):

- Task 1 maximum 4: required factual content 2, coherence 1, understandable grammar/vocabulary 1.
- Task 2 maximum 5: exact one point per approved correct word form.
- Task 3 maximum 6: required content/functions 2, organization/genre 2, grammar/vocabulary 2.

**Speaking internal rubric proposals** (not official task 1/2 split):

- Interview task 1 provisional 6 of combined 12.
- Two-picture description task 2 provisional 6 of combined 12.
- Missing-info question task 3: 3 points, one per valid question.

Teacher validation may require changing provisional task 1/2 split; store rubric version on each score.

Pass and total pure functions:

~~~ts
type Skill = "listening" | "reading" | "writing" | "speaking";
type Scores = Record<Skill, number>;
export const passed = (s: Scores) =>
  Object.values(s).every(n => Number.isInteger(n) && n >= 9 && n <= 15);
export const totalScore = (s: Scores) =>
  Object.values(s).reduce((sum, n) => sum + n, 0);
~~~

Pending/open evaluations must not be represented as passed or failed. Grader output JSON contains points, rubricVersion, modelId, criterionEvidence, corrections in Latvian, English/Arabic explanations, uncertainty low/medium/high, uncertainty reason and next-practice tag. Check points 0..task max with validation; reject and retry/escalate invalid output. A correct alternative Latvian word order may be valid, even if different from sample answer.

The learner's text is untrusted data. Keep grading instructions in server code; do not let an essay that says to ignore instructions alter the rubric. Keep teacher overrides and audits.

### 10. Exact OpenAI Responses API integration

Official docs:
https://developers.openai.com/api/docs/guides/structured-outputs
https://developers.openai.com/api/docs/models/gpt-6.1-terra

Use official npm package openai and zod. For one 6-point writing task:

~~~ts
import OpenAI from "openai";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const Task3Grade = z.object({
  points: z.number().int().min(0).max(6),
  evidence: z.array(z.object({
    criterion: z.string(),
    explanation: z.string(),
    learnerQuote: z.string()
  })),
  corrections: z.array(z.object({
    original: z.string(),
    corrected: z.string(),
    explanationEn: z.string(),
    explanationAr: z.string()
  })),
  uncertainty: z.enum(["low", "medium", "high"]),
  uncertaintyReason: z.string(),
  nextPractice: z.string()
});

export async function gradeTask3(rubric: string, prompt: string, text: string) {
  const result = await client.responses.parse({
    model: "gpt-6.1-terra",
    store: false,
    reasoning: { effort: "medium" },
    instructions:
      "You assess Latvian A2 practice writing only against the supplied rubric. " +
      "Reward intelligible A2 communication. Do not invent quotes or deduct for " +
      "valid alternative Latvian wording. Return calibrated, evidence-based scores.",
    input: [{
      role: "user",
      content: JSON.stringify({rubricVersion:"a2-writing-v1",
        maxPoints:6, rubric, prompt, learnerText:text})
    }],
    text: { format: zodTextFormat(Task3Grade, "a2_task3_grade") }
  });
  if (!result.output_parsed) throw new Error("Grade unavailable");
  return result.output_parsed;
}
~~~

This snippet is a compile-and-test starting contract, not yet executed. For other tasks use a separate max-bound schema. Save model/rubric versions and input content hashes; track provider request costs and all error states. Store:false limits persistence under the API workflow, but do not make privacy guarantees without reviewing current data terms.

### 11. Speech-to-text and recordings

Azure Speech primary. Language: lv-LV. Package: microsoft-cognitiveservices-speech-sdk. Official:
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-speech-to-text
https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support

- Browser GET /api/speech/token obtains a short-lived Azure authorization token after the server checks login/entitlement. Never send the Azure subscription key to the browser.
- Start/stop microphone capture per speaking turn with SDK; use continuous recognition for longer description if required and tested.
- Independently record user audio via browser MediaRecorder where supported. Validate MIME/duration/size before private Supabase upload.
- Persist transcript, audio pointer, provider, status, input duration. If STT is blank for a clearly spoken answer, do not award a confidently incorrect zero: retry or human-review.
- Azure recognizes Latvian but its specialized pronunciation assessment table does not list Latvian. Do not claim precise automatic phoneme or accent scoring.
- Keep a transcript edit/review utility for educators; strict exam mode should not show answer hints.

Fallback benchmark with newer OpenAI gpt-transcribe, not deprecated gpt-4o-mini-transcribe:

~~~ts
import OpenAI from "openai";
import { createReadStream } from "node:fs";
const api = new OpenAI();
const transcript = await api.audio.transcriptions.create({
  model: "gpt-transcribe",
  file: createReadStream("audio.webm"),
  languages: ["lv"],
  prompt: "Spoken Latvian A2 learner answer about ordinary daily life."
});
console.log(transcript.text);
~~~

Official: https://developers.openai.com/api/docs/guides/speech-to-text

Use a server-owned validated file; do not assume an arbitrary remote upload is safe. Current benchmark cost is approximately USD 0.0045 per audio minute. Set hard upload byte and length limits. Compare both providers against a native-speaker transcript set before launch.

### 12. Cached text-to-speech and images

Azure TTS REST endpoint (when using REST):
POST https://{AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1

Server headers: Ocp-Apim-Subscription-Key, Content-Type application/ssml+xml, X-Microsoft-OutputFormat. Keep secret key server only. Example SSML:

~~~xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="lv-LV">
  <voice name="lv-LV-EveritaNeural">Labdien! Kā jūs sauc?</voice>
</speak>
~~~

Also validate lv-LV-NilsNeural. When a teacher approves a question set, generate prompt/listening audio ONCE; hash and persist MP3/WAV media. Use real Latvian actor recordings if voice quality tests favor them. Avoid dynamic TTS charges for every exam playback.

Original task pictures must be simple observable everyday scenes, no embedded writing, approved for A2 vocabulary, with alt text and teacher-authored scene reference. Generate/edit images offline; store in curated media bucket. Live avatar via HeyGen is only a separately approved phase 2, with its own fixed subscription floor.

### 13. Stripe API and server entitlements

Docs: https://docs.stripe.com/payments/checkout/pricing-table and https://docs.stripe.com/webhooks

- POST /api/billing/checkout resolves plan code to a server-owned Stripe Price ID, creates Checkout Session with mode=subscription.
- POST /api/webhooks/stripe verifies the Stripe-Signature on raw HTTP body with configured signing secret, inserts event ID once, and reconciles subscription.
- Handle checkout.session.completed, customer.subscription.created/updated/deleted and invoice payment success/failure events for the pinned Stripe API version.
- POST /api/billing/portal opens the Stripe-hosted management UI.
- Only successful server-confirmed subscription state can grant/extend paid entitlement; never rely on success query string or browser checkout redirect.
- Allow cancel, plan change and renewal with documented effective dates; prevent double increments on webhook retries.
- Implement all integration tests in Stripe test mode; no live charges or product creation without owner approval.

### 14. Monthly cost model: EUR 200 cap

An internal budget envelope, not exact invoices. USD vendor prices, exchange rates and VAT vary.

| Expense | Budget EUR/month | Controls |
|---|---:|---|
| Vercel Pro | 25 | Spending alerts, single deployer seat |
| Supabase Pro / media | 30 | Media retention and egress tracking |
| Speech recognition + fallback | 25 | Minute quotas and failovers |
| OpenAI scoring | 20 | Token budgets and model usage metering |
| TTS media production | 15 | Cache all approved audio |
| Image preparation | 10 | Admin-only, not learner triggered |
| Email/monitoring | 10 | Low tier and sampled logs |
| Integration miscellaneous | 5 | Buffer for ancillary services |
| VAT/FX/incident/traffic reserve | 60 | Owner-controlled reserve |
| TOTAL | 200 | Global budget guard |

Vendor anchor pricing as checked 10 Nov 2026: Vercel Pro USD 20/month, Supabase Pro USD 25/month, gpt-6.1-terra USD 1 per million input / USD 5 per million output tokens, gpt-transcribe USD 0.0045/minute. Azure free F0 offers 5h speech recognition and 0.5m neural voice characters monthly within limits; paid tariff depends on selected region/offer.

Illustrative full exam variable API spend: 10 minutes of OpenAI fallback audio = USD 0.045; 12,000 input and 3,000 output Terra tokens = USD 0.027. Together USD 0.072, excluding cloud, Azure, storage, retries, generation, VAT, and billing fees. Pilot planning allowance: EUR 0.15–0.50 per completed exam, to be replaced by measured numbers.

Budget enforcement:

1. Configure MAX_MONTHLY_VARIABLE_AI_EUR=80 initially and metric-specific limits.
2. Alert at 50/75/90/100% of budget.
3. Record one ai_usage_event per provider request key; retries are idempotent.
4. Limit free demos, simultaneous sessions, audio duration and number of corrections.
5. When budget headroom runs low, disable optional generation and queue jobs while honoring already accepted paid exam obligations using reserves.
6. Track cost per completed exam, cache hit rate, STT failure rate, token use, p95 response latency and borderline review rate.

### 15. Quality, privacy and release gates

Build a teacher-reviewed golden set: minimum 30 spoken answers with varied non-native accents and device conditions; minimum 30 writing samples covering weak/borderline/strong; fixed-answer regression set. Ideally have two independent Latvian-language reviewers with adjudication.

Compare Azure vs OpenAI transcript on numbers, dates, negation, case endings and key meaning, not only global word error rate. Score agreement around threshold 8/9/10 is especially important. Proposed internal launch target: at least 85% pass/fail agreement with adjudicated teacher labels and mean absolute difference <=1.5/15 on assessment samples. This is our proposed bar, NOT official VIAA accreditation.

Test:

- 9/9/9/9 -> 36/60 pass; 15/15/8/15 -> 53/60 fail.
- Missing/pending AI score -> no final pass flag.
- AI outputs 9 points for max-6 task -> reject and request re-evaluation/review.
- Duplicate POST/start/submit -> no duplicated quota or scoring.
- Account A accesses account B answer/audio/subscription -> deny.
- Timer survives refresh; late section answer rejected or marked expired.
- iOS Safari + Android Chrome microphone permissions, long recording, offline/disconnect, file too large, repeated upload.
- Stripe canceled/unpaid/replayed event -> correct entitlements.
- Prompt injection in learner answer -> rubric unchanged.
- No answer keys in exam API response before finish.
- Signed user audio URL expires and is owner-only.

Legal/privacy pre-launch review: commercial Latvian business, Stripe tax/VAT settings, GDPR notices, voice-recording authorization and retention, user export/deletion, vendor DPAs/region, third-party transfers, Terms, refunds, use of official examination materials. Proposed default raw audio retention 30 days after assessment, with earlier user-triggered purge subject to legitimate data retention requirements. Never log transcripts in general app logs. Make it unmistakable that the service is independent from VIAA.

### 16. Milestones and priority backlog

Realistic target for commercial beta with Codex assistance: 4–6 weeks, subject to teacher evaluation and any payment/legal blockers.

| Milestone | Target | P0 deliverables | Exit criteria |
|---|---|---|---|
| M0 Foundation | Days 1–3 | Next.js PWA, Supabase Auth, migrations, RLS, mock providers, CI | Clone/build/tests pass, no secrets, mobile auth |
| M1 Exam engine | Days 4–8 | Official blueprint, authored original question set, timers, autosave, fixed scoring | Correct 60-point engine; all 9/15 gates; refresh-safe |
| M2 Speech/AI | Days 9–15 | Azure LV STT/TTS, audio storage, images, LLM rubrics, feedback | iPhone/Android speaking recorded and score bounded |
| M3 Subscriptions | Days 16–20 | Stripe test mode, portal, webhooks, quota ledger, spending alerts | No payment/quota bypass; webhook retries safe |
| M4 Beta quality | Days 21–30 | Teacher rubric calibration, accessibility, e2e, security and privacy review | Documented launch go/no-go with threshold evidence |
| M5 After beta | Later | More question sets, weak-area adaptive learning, optional video/avatar | Demand and budget justify each feature |

P0 feature set: one complete reviewed original exam, all four skill modes, strict exam, audio record+play, written and oral feedback, results, account/entitlement, audit/metering, payment sandbox, responsive UI.

P1: more original exam sets, teacher review interface, progress email, diagnostic, hand-written paper photo with OCR, richer recommendations.

P2: prerecorded human examiner video, live avatar, adaptive spoken follow-up, native mobile packaging, B1 expansion.

### 17. Codex implementation prompts

Store this spec as docs/product-spec.md inside the new Git repo. Create AGENTS.md with these persistent instructions:

~~~text
Build a commercial Latvian A2 exam practice PWA according to docs/product-spec.md.
Use TypeScript strict, Next.js App Router, Supabase, Stripe, OpenAI and Azure Speech via replaceable providers.
Use the official VIAA 2026 A2 document as rules reference: 15 points per skill, minimum 9 in EACH, writing 4+5+6, speaking group 12+3.
Do not invent official status, precise pronunciation scores, API endpoints, SDK methods, pricing or grading micro-rubrics.
Treat all learner content as untrusted. Do not leak exam answer keys, personal data, API keys or service-role credentials.
Add unit and integration tests for every scoring, authorization, state and billing rule.
Use mocks for paid APIs; require explicit approval to make live paid calls, deploy publicly, create paid Stripe products or modify production.
Implement in small, reviewable patches. After each milestone run typecheck, lint, tests and build, and report evidence plus remaining risks.
~~~

**Codex prompt A — Bootstrap**

~~~text
Read docs/product-spec.md fully. Implement milestone M0 ONLY.
Create Next.js App Router mobile-first PWA, Tailwind, TypeScript strict and responsive EN/AR explanation UI.
Add Supabase Auth SSR, data model migrations, owner-only RLS, tests proving cross-user isolation, typed errors, mock AI/speech services, env example, GitHub CI and setup guide.
Never connect live paid API accounts. Return changed files, exact test results and blockers. Stop after M0.
~~~

**Codex prompt B — Exam runner**

~~~text
Implement M1 from docs/product-spec.md. Build stateful server-deadline exam runner with four sections, answer autosave, refresh recovery and immutable content manifests.
Create ONE original A2 practice set based on the public official exam types, not copied proprietary content.
Validate 15 points per section, writing 4+5+6, speaking tasks 1+2 combined 12 and task 3 3, per-skill pass >=9.
Implement deterministic listening/reading and writing-word-form scores, but mock open-answer evaluation.
Test idempotency, timeout, ownership, score threshold and no answer-key leakage. Stop when CI passes.
~~~

**Codex prompt C — Latvian voice**

~~~text
Implement M2 speech providers with Azure Speech JavaScript SDK configured lv-LV.
Server issues only short-lived speech auth tokens after entitlement checks. Build microphone test, record button, transcript/status, MediaRecorder upload to private Supabase, signed URL access, media retention metadata and graceful error/retry.
Add server-side SSML pre-generation using lv-LV-EveritaNeural and lv-LV-NilsNeural, caching by content hash.
Add optional gpt-transcribe file adapter behind a feature flag and mock both providers in tests.
Validate iPhone Safari/Android Chrome manual checklist. No live API billing without approval.
~~~

**Codex prompt D — AI scoring**

~~~text
Implement OpenAI Responses API via official openai SDK using gpt-6.1-terra and Zod Structured Outputs.
Write versioned and teacher-adjustable A2 writing/speaking rubrics, criteria-linked evidence, EN/AR explanations, uncertainty markers, deterministic task-2 word forms and fixed 9/15 per-skill pass.
Log model version and provider usage, reject invalid points, support needs_review and native teacher override.
Test injection in learner answer, empty transcript, alternative valid word order, partial credit, provider errors, and all score boundaries.
Do not claim official exam results or objective pronunciation measurement.
~~~

**Codex prompt E — Paid subscriptions**

~~~text
Implement Stripe Checkout subscriptions, Customer Portal, verified raw-body webhooks and per-account subscription mirror.
Server chooses allowed Stripe Price IDs and calculates plan entitlements. Make webhook processing idempotent.
Implement monthly exam and speaking-minute reservations, per-user and global budget limits, cost ledger and budget alerts.
Test subscription creation, failure, cancellation, replay, concurrent usage and quota exhaustion in Stripe TEST mode only.
Do not activate production checkout or charge real customers.
~~~

**Codex prompt F — Quality and launch gate**

~~~text
Implement beta hardening. Add cross-device Playwright cases and manual iPhone/Android audio checklist, teacher review fixtures, automated comparison against human reference grades, RLS/security tests, user audio purge and export, cost dashboards and privacy placeholders.
Run all available checks. Produce a written go/no-go report with actual results and gaps.
Do NOT publish or start paid checkout until explicitly approved.
~~~

### 18. Owner decisions before any public launch

1. Brand/domain and visible product name.
2. Whether company Stripe billing/tax setup is ready in Latvia.
3. Final paid tier prices, quotas and refund policy.
4. Native Latvian educator review arrangement.
5. Written license/permission strategy for any official VIAA material.
6. Privacy notice, recording retention, deletion and vendor processing review.
7. Public launch vs invite-only commercial beta.

### 19. Verified primary-source reference links

- 2026 VIAA programme: https://www.viaa.gov.lv/lv/parbaudes-programma
- 2026 A2 detailed sample: https://www.viaa.gov.lv/lv/media/27351/download?attachment=
- OpenAI Responses Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI GPT-6.1 Terra: https://developers.openai.com/api/docs/models/gpt-6.1-terra
- OpenAI current transcription guidance: https://developers.openai.com/api/docs/guides/transcription
- OpenAI gpt-transcribe: https://developers.openai.com/api/docs/models/gpt-transcribe
- Azure language support: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support
- Azure STT SDK: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-speech-to-text
- Azure TTS REST: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-text-to-speech
- Azure pricing: https://azure.microsoft.com/en-us/pricing/details/speech/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase pricing: https://supabase.com/pricing
- Vercel Pro plan: https://vercel.com/docs/plans/pro-plan
- Stripe subscriptions: https://docs.stripe.com/payments/checkout/pricing-table
- Stripe webhooks: https://docs.stripe.com/webhooks
- HeyGen LiveAvatar: https://help.heygen.com/en/articles/10035615-how-to-get-started-with-liveavatar

### Final build principle

An original, reviewed exam bank and rigorous four-skill scoring rules are the product core. AI is a measured, replaceable assistive evaluator. Cache all static media, verify billing events, cap consumption, protect recordings, and validate against Latvian-language educators before presenting scores as dependable guidance.
