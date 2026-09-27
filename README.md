# Linty — AI code assistant

Linty reviews your JavaScript and TypeScript and flags real problems — hardcoded secrets, SQL injection, `eval()`, unsafe DOM access, unhandled network errors, loose equality, and more — then shows a fix, an explanation, and a generated test for each one. It runs entirely locally and needs **no API keys**.

## How it works

1. Paste a snippet, upload a file, or analyze the bundled sample.
2. Linty analyzes the code with a deterministic rules engine (no external model or network required).
3. For every issue it finds you get:
   - the offending line(s) and a **fixed** version,
   - a plain-English **explanation** (what's wrong, why it matters, what changed, a tip),
   - a **generated test** covering the fix,
   - a **report** with an overall score and a five-category breakdown.

## What it detects

| Rule | Severity | Notes |
| --- | --- | --- |
| Hardcoded secret / API key | High | `sk_live_…`, `AKIA…`, `ghp_…`, private keys, `apiKey = "…"` |
| SQL injection | High | string-concatenated queries |
| `eval()` | High | arbitrary code execution |
| Unsafe DOM injection | High | `innerHTML` / `document.write` |
| Unsafe shell command | High | `exec` / `spawn` with string-built commands |
| Unhandled network error | Medium | `.then()` chains without `.catch` |
| Loosely typed `any` | Medium | TypeScript only |
| Loose equality | Low | `==` / `!=` (skips the safe `x == null` idiom) |
| `var` | Low | prefer `const` / `let` |
| Leftover `console.log` | Low | debug statements |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables are required.

TypeScript is auto-detected for `.ts` / `.tsx` files and for snippets that look typed; otherwise JavaScript is assumed.

## Scripts

- `npm run dev` — start the development server
- `npm run build` — create a production build
- `npm run start` — serve the production build
- `npm run lint` — run ESLint
- `npm run typecheck` — type-check with `tsc --noEmit`

## API

`POST /api/code-analyzer`

Request body:

```json
{
  "code": "function f(x) { return x == 1 ? 'yes' : 'no'; }",
  "fileName": "example.js",
  "language": "javascript"
}
```

| Field | Required | Description |
| --- | --- | --- |
| `code` | yes | The source to analyze, up to 100 KB. |
| `fileName` | no | Display name; defaults to `snippet.js` / `snippet.ts`. |
| `language` | no | `"javascript"` (default) or `"typescript"`. |

Success response (`200`):

```json
{
  "ok": true,
  "result": {
    "id": "analysis-…",
    "fileName": "example.js",
    "language": "javascript",
    "originalCode": "…",
    "fixedCode": "…",
    "issues": [
      {
        "id": "equality-1-1",
        "line": 1,
        "title": "Loose equality check",
        "summary": "Using == can compare values in surprising ways.",
        "severity": "low",
        "original": {
          "startLine": 1,
          "lines": ["function f(x) { return x == 1 ? 'yes' : 'no'; }"],
          "highlight": [1]
        },
        "fixed": {
          "startLine": 1,
          "lines": ["function f(x) { return x === 1 ? 'yes' : 'no'; }"],
          "highlight": [1]
        },
        "explanation": {
          "problem": "…",
          "whyItMatters": "…",
          "whatChanged": "…",
          "tip": "…"
        }
      }
    ],
    "tests": [
      { "id": "t1", "name": "compares values strictly", "issueId": "equality-1-1", "code": ["…"] }
    ],
    "report": {
      "summary": "…",
      "overallScore": 82,
      "scoreBreakdown": {
        "bugScore": 100,
        "complexityScore": 100,
        "securityScore": 100,
        "testScore": 66,
        "maintainabilityScore": 88
      },
      "recommendations": ["…"],
      "conclusion": "…"
    },
    "confidence": 89
  }
}
```

Errors return `{ "ok": false, "error": { "code": "…", "message": "…", "details": [] }, "result": null }` with a matching HTTP status (`400` for validation, `500` for server errors).

## Project structure

```
app/
  page.tsx                     # renders the Linty panel
  layout.tsx                   # root layout + fonts
  api/code-analyzer/route.ts   # analysis endpoint
components/linty/              # panel + screens (home, analyzing, issues, fix, explanation, tests, report)
lib/
  linty-data.ts                # types, default sample, analysis steps, language detection
  linty/engine.ts              # the deterministic analyzer
  linty/client.ts              # client-side API helper
  utils.ts                     # cn() class helper
backend/                       # optional IBM watsonx LLM agents (not wired into the default flow)
```

## Notes

- The analyzer is deterministic and runs locally — results are reproducible for the same input and require no network access.
- `backend/` contains an optional multi-agent (analyzer / fixer / tester / reporter) implementation that was intended to call IBM watsonx. It is not part of the default request path.
