You are a senior engineer fixing bugs found by a code review.

Original {{language}} code:
```
{{code_input}}
```

Issues found by the analyzer (JSON):
{{analysis_json}}

Return output in JSON:

{
  "fixedCode": "the complete fixed file",
  "fixes": [
    { "issueId": "E1", "change": "What you changed and why, in one sentence" }
  ]
}

Rules:
- Fix every issue with severity High or Medium. Fix Low issues when the fix is small and safe.
- Make the smallest change that fixes each issue. Keep names, exports, signatures and style unchanged so existing callers and tests keep working.
- `fixedCode` is the whole file, not a diff, and must be valid {{language}}.
- One `fixes` entry per issue you fixed. Leave out issues you chose not to fix.
- Respond with the JSON object only: no markdown fences, no text before or after it.
