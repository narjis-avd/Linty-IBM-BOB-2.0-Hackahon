# Linty project rules

- This repo is public and MIT-licensed. Never write API keys, tokens, passwords or `.env` values into any file, commit or chat output. Secrets live only in an untracked `.env.local`; `.env.example` holds placeholders.
- Never edit `samples/*.ts` or `samples/*.expected.json`. They are the ground truth the pipeline is scored against.
- The web app is Next.js 16 in `app/`. Its APIs differ from older Next.js; read `node_modules/next/dist/docs/` before changing framework code.
- Shared report shape: `lib/linty/schema.ts`. Agent prompts: `prompts/*.md`. Both the Bob modes and the live watsonx pipeline use them, so change them in one place.
- Report only measured numbers. Do not invent percentages, time savings or scores.
- Do not run destructive commands (`rm -rf`, `git push --force`, `git reset --hard`) without asking.
