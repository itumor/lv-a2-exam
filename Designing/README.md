# Designing — Latvian A2 Exam Simulator

Design export of the 14 screens (7 mobile, 7 desktop web). "Kāpnes A2" is a working name.

## What is in this folder

| Path | What it is | Use it for |
|---|---|---|
| `CLAUDE_CODE_PROMPT.md` | Prompt to paste into Claude Code | Starting the build |
| `all-screens.pdf` | All 14 screens, one per page | Sharing, printing, review |
| `png/` | One PNG per screen at 2x | Visual reference while building |
| `html/` | Standalone HTML per screen, fonts bundled, works offline. Open `html/index.html` | Exact markup, spacing and colours to port |
| `tokens/design-tokens.json`, `tokens/tokens.css` | Colours, type, radii, sizes | Tailwind theme / CSS variables |
| `assets/park-scene.svg` | Placeholder picture for the speaking task | Stand-in until real task images exist |
| `source/` | Original design-canvas files (`.dc.html`, `canvas.json`) | Re-importing or editing the design later |

## Screens

| # | Mobile (390x844) | Desktop (1280x800) | Shows |
|---|---|---|---|
| 1 | `Main` | `DesktopHome` | Home: start mock exam, practise one part, last scores |
| 2 | `Listening` | `DesktopListening` | Listening task 1: announcement, three answers |
| 3 | `Reading` | `DesktopReading` | Reading task 2: match advert A–D to a situation |
| 4 | `Writing` | `DesktopWriting` | Writing task 3: e-mail from five plan points |
| 5 | `Speaking` | `DesktopSpeaking` | Speaking task 2: describe a picture, recorder |
| 6 | `Results` | `DesktopResults` | Four scores, 9-of-15 rule, "Not passed yet" |
| 7 | `Feedback` | `DesktopFeedback` | AI corrections for the writing task |

## Things to know

- Scores, streak, timers and the user name are sample data.
- The Latvian exam items were written for the mockup in the format of the VIAA 2026 A2 sample. A native speaker has not checked them.
- Screens not designed yet: the other task types (listening 2–3, reading 1 and 3, writing 1–2, speaking 1 and 3), pricing, sign-up, account, equipment check, admin.
- The links inside `html/` move between screens the same way the prototype does.
