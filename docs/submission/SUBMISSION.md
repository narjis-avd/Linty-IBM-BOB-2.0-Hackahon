# Linty: lablab.ai submission form (copy-paste ready)


---

## Project Title

Linty: AI code review that proves its fixes

## Short Description (≤255 characters)

Linty runs four IBM Bob agents that find bugs in a file, fix them, write regression tests and summarise the review, then executes those tests on the buggy and fixed code so every fix comes with proof.

## Technology & Category Tags

IBM, IBM Bob, IBM watsonx.ai, Granite, Next.js, TypeScript, Vitest, Vercel, AI Agents, Developer Tools, Code Review, Testing

## Long Description: Problem & Solution Statement (≤500 words)

**Problem.** Code review is one of the most repeated and most expensive jobs in software development. A reviewer has to read a change, spot the bugs, explain them, and then someone has to fix them and write tests so they never come back. That loop can take an hour per pull request, and the test step is the one most often skipped, which is how the same bugs return to production. AI assistants can suggest fixes, but developers can't trust a suggestion they can't verify, so the review still ends up manual.

**Solution.** Linty turns a code review into a few minutes of verified work. A developer runs one command in IBM Bob IDE, `/linty-review <file>`, and four specialist agents take over:

1. **Analyzer** finds every issue (logical, runtime, performance, security) with its line, severity and a suggested fix, as strict JSON.
2. **Fixer** applies the smallest safe change for each issue and records what it changed and why.
3. **Tester** writes Vitest regression tests, at least one per fixed issue, each tagged with the issue it guards.
4. **Reporter** writes a short, factual summary and next steps.

Then Linty does what most AI code tools don't: it **proves the fix**. The generated tests are executed against the original code, where they should fail, and against the fixed code, where they should pass. Linty also measures how long each agent took and scores detection against a hand-written list of the seeded bugs in each sample.

On our demo file, a shopping-cart module with five seeded bugs, Linty caught 5/5 bugs, fixed 5, and wrote 12 tests. 3/12 passed on the original code and 12/12 on the fixed code, and the whole pipeline ran as a single Bob task using 0.035 Bobcoins.

Results are published to the Linty web app on Vercel, which shows the issues, a side-by-side diff of the fix, the executed tests, and a report built only from measured numbers. Judges can replay every recorded Bob run there without logging in.

**Why it matters.** Linty doesn't replace the reviewer. It hands them a review that's already done, with fixes and passing tests attached, so their time goes to judgement instead of hunting for off-by-one errors. Because every agent writes to its own file and every number is measured, teams can audit exactly what the AI did.

**What's next.** Running Linty automatically on every pull request through a GitHub Action, supporting Python and Java, and adding a security-focused agent.

## IBM Bob Usage Statement (≤500 words)

IBM Bob IDE is Linty's engine: every review runs inside Bob, and the product is shipped as a Bob configuration that anyone gets by opening our repository.

**Custom modes (`.bob/custom_modes.yaml`).** We built five modes. The 🧹 Linty Orchestrator coordinates the run and never edits code. Four specialists do the work: 🔍 Analyzer, 🔧 Fixer, 🧪 Tester and 📊 Reporter. Each specialist's edit permission is restricted with `fileRegex` to its own output file, so the Analyzer can't change code, the Fixer can't write tests, and the Tester can't touch the fix. This turns Bob's permission system into a governance layer for the agent pipeline.

**Subtasks: real multi-agent orchestration.** The orchestrator delegates each stage to a specialist mode as a separate Bob subtask, checks that the stage produced its file, and only then starts the next one. Each agent gets a fresh, focused context.

**Slash command (`.bob/commands/linty-review.md`).** `/linty-review <file>` runs the whole pipeline: start the run, analyze, fix, test, report, finalize, summarise.

**Terminal execution.** Bob runs our helper script (`scripts/linty.mjs`) to start the run and to finalize it. Finalize executes the generated Vitest tests against the original and the fixed code, measures stage times, scores detection against ground truth, validates everything against our schema, and publishes the report.

**Rules and context control.** `.bob/rules/linty.md` and `AGENTS.md` give every mode the same guardrails: never write secrets, never edit the ground-truth samples, report only measured numbers. `.bobignore` keeps dependencies, build output and env files out of Bob's context.

**Shared prompts.** The four agent prompts live in `prompts/` and are read by the Bob modes. The same files power an optional live mode on IBM watsonx.ai with a Granite model, so there's one source of truth.

**Evidence.** Every Bob run's raw agent output is committed under `runs/`, and task session screenshots and exported histories from each team member are in `bob_sessions/`.

**Other AI tools (disclosed).** Claude Code helped one team member build the backend, the Bob configuration and the web UI during the event. The demo video's voiceover was generated with Microsoft Edge neural text-to-speech.

## Links

- Public repo: https://github.com/narjis-avd/Linty-IBM-BOB-2.0-Hackahon
- App URL (Vercel): https://linty.vercel.app
- Demo platform: Vercel

## Files in this folder

- `Linty-cover.png`: cover image, 1920×1080 (16:9)
- `Linty-slides.pdf`: slide presentation (PDF)
- `Linty-demo.mp4`: video (≤3:00)
- `CHECKLIST.md`: final checks before pressing Submit
