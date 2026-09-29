# Linty

**Linty turns a code review into minutes of verified work.** Four IBM Bob agents find the bugs in a file, fix them, write regression tests, and summarise the result. Then Linty *runs* those tests against the buggy and the fixed code, so every fix comes with proof.

Built by **Team North** for the IBM Bob 2.0 Hackathon.

**Live demo:** https://linty.vercel.app (open a recorded Bob run, or go straight to https://linty.vercel.app/#run=cart-total&tab=tests)

## How it works

```
/linty-review samples/cart-total.ts            (IBM Bob IDE)
        │
        ▼
🧹 Linty Orchestrator ── subtask ──► 🔍 Analyzer  → runs/<name>/analysis.json
                      ── subtask ──► 🔧 Fixer     → runs/<name>/fixed.ts + fixes.json
                      ── subtask ──► 🧪 Tester    → runs/<name>/linty.test.ts
                      ── subtask ──► 📊 Reporter  → runs/<name>/report.json
        │
        ▼
scripts/linty.mjs finalize
  • runs the generated tests on the ORIGINAL code (they should fail)
  • runs them on the FIXED code (they should pass)
  • measures each agent's time from its output file
  • scores detection against the seeded bugs in samples/<name>.expected.json
        │
        ▼
public/reports/<name>.json  ──►  Linty web app (Vercel): issues, side-by-side diff, tests, report
```

### IBM Bob is the engine

| Bob feature | How Linty uses it |
|---|---|
| Custom modes (`.bob/custom_modes.yaml`) | One orchestrator plus four specialist modes. Each specialist can only write its own output file (`fileRegex`), so the Analyzer can't edit code and the Fixer can't touch tests. |
| Subtasks | The orchestrator delegates each stage to a specialist mode as a separate subtask: a real multi-agent pipeline. |
| Slash command (`.bob/commands/linty-review.md`) | `/linty-review <file>` runs the whole pipeline. |
| Rules (`.bob/rules/linty.md`, `AGENTS.md`) | Project guardrails: no secrets, don't edit ground truth, report only measured numbers. |
| `.bobignore` | Keeps `node_modules`, build output and env files out of Bob's context. |

The agent prompts live in `prompts/` and are shared by the Bob modes and the optional live pipeline.

### Honest numbers

Every metric in the app is measured, not estimated:

- **Seeded bugs caught:** each sample has a hand-written list of its bugs (`samples/*.expected.json`). An issue counts as caught if the Analyzer flags a line within 2 lines of it.
- **Regression tests before → after:** the Tester's Vitest file is executed against both versions of the code.
- **Pipeline time:** from the Bob run's start to when each agent wrote its file.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Run a review inside IBM Bob IDE (v2.0.2 or later), from the repo root:

```
/linty-review samples/cart-total.ts
```

Then commit `runs/<name>/` and `public/reports/` and the web app will list the run.

### Optional: live analysis with watsonx.ai

Copy `.env.example` to `.env.local` and fill in an IBM watsonx.ai API key and project ID. The web app's **Run AI Analysis** button then runs the same four prompts against a Granite model and streams each stage live. Without credentials, the deployed app shows recorded Bob runs.

## Project layout

| Path | What it is |
|---|---|
| `.bob/` | Bob modes, `/linty-review` command, rules |
| `prompts/` | The four agent prompts |
| `samples/` | Demo files with seeded bugs and their ground truth |
| `scripts/linty.mjs` | Starts and finalises a Bob run; runs the tests; measures |
| `runs/` | Every Bob run's raw agent output (evidence of Bob's work) |
| `public/reports/` | Finalised reports the web app reads |
| `lib/linty/schema.ts` | The report schema shared by everything |
| `backend/` | Optional watsonx.ai client and streaming pipeline |
| `app/` | Next.js web app |
| `docs/submission/` | Hackathon submission pack: form text, slides PDF, cover, demo video, checklist, and the scripts that build them |
| `bob_sessions/` | Bob task session screenshots and exported histories from every team member |

## AI tools disclosure

In line with the hackathon code of conduct:

- **IBM Bob IDE** is the core of the product: it runs every Linty review (see `runs/` and `bob_sessions/`).
- **Claude Code (Anthropic)** helped one team member rebuild the backend, the Bob configuration, the run script and the web UI during the event.
- An earlier prototype of the UI and agent classes was scaffolded with other AI coding assistants and then replaced.
- Team members wrote the agent prompts' requirements, the project direction, the demo and the pitch.

## Team North

| Member | Role |
|---|---|
| Mujtaba Zubair | Team lead, backend |
| Narjis Fatima | Project lead, repository |
| Saman Nadeem | UI design |
| Naveen Subhan | Testing |
| Hamza Hassan Khan | Team member |
| Muzammil Qureshi | Research, UI design support |

## License

[MIT](LICENSE)
