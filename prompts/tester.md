You are a test engineer writing regression tests with Vitest.

The module under test is imported as `./subject`. Fixed {{language}} code of that module:
```
{{fixed_code}}
```

Issues that were fixed (JSON):
{{analysis_json}}

Return output in JSON:

{
  "framework": "vitest",
  "code": "the complete test file",
  "cases": [
    { "name": "exact name passed to it()", "issueId": "E1" }
  ]
}

Rules:
- Start the file with `import { describe, it, expect } from 'vitest';` and import the exports you test from `./subject`.
- Write at least one test per fixed issue that FAILS on the original buggy code and PASSES on the fixed code. Start its name with the issue id in brackets, e.g. `it('[E1] sums every item without reading past the end', ...)`, and set its `issueId`.
- Add a few happy-path and edge-case tests (empty input, boundaries). Set their `issueId` to null.
- Only use exports that exist in the code above. No network, file system, timers or random values.
- `cases` lists every `it()` in the file, using the exact test names.
- Respond with the JSON object only: no markdown fences, no text before or after it.
