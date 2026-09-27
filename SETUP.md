# Linty — Setup & deployment

## Prerequisites

- Node.js 18+ (tested on Node 20+)
- npm

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

There are **no API keys, services, or environment variables** to configure. The analyzer is deterministic and runs server-side in the `/api/code-analyzer` route.

## Production build

```bash
npm run build
npm run start
```

`npm run start` serves the optimized build on the configured port (default 3000).

## Deploying

Linty is a standard Next.js App Router project, so it runs anywhere Next.js does — Vercel, Netlify, Docker, or a plain Node server. No build-time or runtime secrets are required.

## Configuration

There are no required settings. The only tunable knobs live in `app/api/code-analyzer/route.ts`:

| Limit | Value |
| --- | --- |
| Maximum code size | 100 KB |
| Supported languages | JavaScript, TypeScript |

Language detection happens on the client (`lib/linty-data.ts` → `detectLanguage`): `.ts` / `.tsx` and clearly-typed snippets are treated as TypeScript, everything else as JavaScript.

## Project structure

```
app/
  page.tsx                     # renders the Linty panel
  layout.tsx                   # root layout + fonts
  api/code-analyzer/route.ts   # analysis endpoint (input validation + engine call)
components/linty/
  linty-panel.tsx              # screen state machine
  panel-header.tsx             # title bar + screen headers
  ui.tsx                       # shared buttons, badges, code blocks
  screens/                     # home, analyzing, issues, fix, explanation, tests, report
lib/
  linty-data.ts                # shared types, default sample, analysis steps, detectLanguage
  linty/engine.ts              # the deterministic analyzer (all rules)
  linty/client.ts              # client-side fetch helper
  utils.ts                     # cn() class helper
backend/                       # optional IBM watsonx LLM agents (not wired into the default flow)
```

## How analysis flows

1. The user pastes, uploads, or opens the sample code.
2. `lib/linty/client.ts` POSTs `{ code, fileName, language }` to `/api/code-analyzer`.
3. `app/api/code-analyzer/route.ts` validates the input and calls `analyzeCode()` in `lib/linty/engine.ts`.
4. The engine detects issues, generates fixes and tests, and computes a report — all in-process.
5. The panel renders the result across the Issues → Fix → Explanation → Tests → Report screens.

## Extending the analyzer

To add a new rule:

1. Add a `Rule` entry to the `RULES` array in `lib/linty/engine.ts` (id, severity, category, title, summary, explanation).
2. Add a detector call in `detectIssues()`.
3. Optionally add a whole-file transform in `applyFixes()` and a test template in `TEST_TEMPLATES`.

## Optional: IBM watsonx LLM backend

`backend/` contains a multi-agent implementation (`AnalyzerAgent`, `FixerAgent`, `TesterAgent`, `ReporterAgent`) that was written to call IBM watsonx. It is **not** part of the default request path and is not required for the app to work.

If you want to revive it, you will need `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` (and should verify the client endpoints in `backend/utils/watsonx-client.ts`, which were never validated against a live account).

## Troubleshooting

- **Port already in use** — `next dev` will pick the next free port automatically; watch the startup log for the actual URL.
- **Build fails on CSS** — make sure `shadcn` and `tw-animate-css` are installed (`app/globals.css` imports them).
- **Build fails on the React Compiler** — make sure `babel-plugin-react-compiler` is installed; `next.config.ts` enables `reactCompiler`.
