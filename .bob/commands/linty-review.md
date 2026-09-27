---
description: Run the Linty four-agent review (analyze → fix → test → report) on one file
argument-hint: <file> e.g. samples/cart-total.ts
---

Run the Linty pipeline on `$ARGUMENTS`. Use the 🧹 Linty Orchestrator mode (`linty`) and follow these steps in order. Stop and report the error if any step fails.

1. **Start the run.** Execute `node --no-warnings scripts/linty.mjs start $ARGUMENTS`. The run name is the file name without its extension, and the run folder is `runs/<name>/`.
2. **Analyze.** Start a subtask in `linty-analyzer` mode: "Analyze runs/<name>/original.* and write runs/<name>/analysis.json." Wait for it to finish, then check that the file exists and is valid JSON.
3. **Fix.** Start a subtask in `linty-fixer` mode: "Fix the issues in runs/<name>/analysis.json. Write runs/<name>/fixed.* and runs/<name>/fixes.json."
4. **Test.** Start a subtask in `linty-tester` mode: "Write Vitest regression tests for runs/<name>/fixed.* to runs/<name>/linty.test.ts."
5. **Report.** Start a subtask in `linty-reporter` mode: "Summarise the run in runs/<name>/report.json."
6. **Finalize.** Execute `node --no-warnings scripts/linty.mjs finalize <name> --author "<the developer's first name>"`. This runs the generated tests against the original and the fixed code, measures each stage's time, scores detection against `samples/<name>.expected.json`, and publishes `public/reports/<name>.json` for the web app.
7. **Summarise.** Show the finalize output to the developer: issues found, seeded bugs caught, tests passing on the original vs. the fixed code, and total run time. If the tests fail on the fixed code, say so plainly; do not edit the tests to make them pass.
