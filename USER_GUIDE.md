# Linty — User Guide

Linty reviews JavaScript and TypeScript and reports real problems — hardcoded secrets, SQL injection, `eval()`, unsafe DOM access, unhandled promise rejections, loose equality, and more — as native editor diagnostics with one-click fixes.

## Install

1. Install [VS Code](https://code.visualstudio.com/).
2. Get `linty-0.1.0.vsix` (from the `vscode-extension/` folder, or the shared download).
3. VS Code → **Extensions** (`Ctrl+Shift+X`) → **`…` menu** (top-right) → **Install from VSIX…** → select the file.

No Node.js, npm, or API keys are required — the analyzer is bundled inside the extension.

## Analyze a file

1. Open a `.js` or `.ts` file.
2. **`Ctrl+Shift+P`** → **Linty: Analyze File** (or right-click the file in the Explorer).
3. Issues appear as squiggles: 🔴 high, 🟡 medium, 🔵 low.
4. See the full list in **View → Problems** (`Ctrl+Shift+M`).

## Fix issues

- Put the cursor on a squiggled line → **`Ctrl+.`** → pick a fix.
- Or click the **"Linty: N issues"** button in the bottom-left status bar → **Fix all issues**.
- Or **`Ctrl+Shift+P`** → **Linty: Fix All Issues**.

## View the report

**`Ctrl+Shift+P`** → **Linty: Show Report** — a summary with an overall score and a five-category breakdown (Bug, Complexity, Security, Test, Maintainability).

## Commands

| Command | Purpose |
| --- | --- |
| `Linty: Analyze File` | Scan the current file |
| `Linty: Fix All Issues` | Apply every fix at once |
| `Linty: Show Report` | Open the score report |
