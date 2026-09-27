# Linty — VS Code extension

Linty reviews JavaScript and TypeScript and reports real problems — hardcoded secrets, SQL injection, `eval()`, unsafe DOM access, unhandled promise rejections, loose equality, and more — as native editor diagnostics with one-click fixes.

## Features

- **Diagnostics** — issues appear as squiggles (red = high, yellow = medium, blue = low) on the exact line.
- **Quick fixes** — click the lightbulb (or press `Ctrl+.`) to apply a fix for a single issue, or **Fix all Linty issues**.
- **Report** — `Linty: Show Report` opens a summary with an overall score and a five-category breakdown.
- **Runs locally** — the analyzer is deterministic and needs no API keys or network access.

## How to run

1. Install dependencies and build:
   ```bash
   cd vscode-extension
   npm install
   npm run build
   ```
2. Open the `vscode-extension` folder in VS Code.
3. Press `F5` to launch an Extension Development Host.
4. Open a `.js` / `.ts` file (or run `Linty: Analyze File` from the Command Palette).

## Commands

| Command | Where |
| --- | --- |
| `Linty: Analyze File` | Command Palette, Explorer context menu, Editor context menu |
| `Linty: Show Report` | Command Palette |

## What it detects

Hardcoded secrets, SQL injection, `eval()`, unsafe DOM injection (`innerHTML` / `document.write`), unsafe shell commands, unhandled promise rejections, loose `==`/`!=`, `var`, leftover `console.log`, and loosely typed `any` (TypeScript).

## Project layout

```
vscode-extension/
  src/extension.ts   # activation, diagnostics, code actions, report webview
  esbuild.mjs        # bundles the extension (and the shared analyzer) into dist/
```

The analyzer itself lives in the shared `../lib/linty/engine.ts`, so the extension and the web app use the exact same rules.
