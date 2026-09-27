import * as vscode from 'vscode'
import { analyzeCode } from '@/lib/linty/engine'
import type { AnalysisResult, Issue, Language } from '@/lib/linty-data'

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact']

let diagnosticCollection: vscode.DiagnosticCollection
let statusBarItem: vscode.StatusBarItem
const results = new Map<string, AnalysisResult>()

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('linty')
  context.subscriptions.push(diagnosticCollection)

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100)
  statusBarItem.command = 'linty.showQuickActions'
  statusBarItem.text = '$(shield) Linty'
  statusBarItem.tooltip = 'Linty code assistant'
  statusBarItem.show()
  context.subscriptions.push(statusBarItem)

  context.subscriptions.push(
    vscode.commands.registerCommand('linty.analyzeFile', async (uri?: vscode.Uri) => {
      const document = uri
        ? await vscode.workspace.openTextDocument(uri)
        : vscode.window.activeTextEditor?.document
      if (!document) {
        void vscode.window.showWarningMessage('Linty: no file to analyze.')
        return
      }
      if (!isSupported(document)) {
        void vscode.window.showWarningMessage('Linty: only JavaScript and TypeScript files are supported.')
        return
      }
      await analyzeDocument(document)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('linty.showReport', () => {
      const document = vscode.window.activeTextEditor?.document
      const result = document ? results.get(document.uri.toString()) : undefined
      showReport(result)
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('linty.fixAll', () => {
      void fixAllIssues()
    }),
  )

  context.subscriptions.push(
    vscode.commands.registerCommand('linty.showQuickActions', () => {
      void showQuickActions()
    }),
  )

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      SUPPORTED_LANGUAGES,
      new LintyCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  )

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (isSupported(document)) void analyzeDocument(document)
    }),
  )

  // Analyze the active file on activation.
  const active = vscode.window.activeTextEditor
  if (active && isSupported(active.document)) {
    void analyzeDocument(active.document)
  }
}

export function deactivate(): void {
  diagnosticCollection?.dispose()
}

async function analyzeDocument(document: vscode.TextDocument): Promise<void> {
  const code = document.getText()
  const language = toLanguage(document)
  const result = analyzeCode(code, language, fileNameOf(document))
  results.set(document.uri.toString(), result)

  const diagnostics = result.issues.map((issue) => toDiagnostic(document, issue))
  diagnosticCollection.set(document.uri, diagnostics)

  const high = result.issues.filter((issue) => issue.severity === 'high').length
  if (result.issues.length === 0) {
    statusBarItem.text = '$(check) Linty: clean'
    statusBarItem.tooltip = `No issues found in ${fileNameOf(document)}.`
  } else {
    statusBarItem.text = `$(warning) Linty: ${result.issues.length} issue${result.issues.length === 1 ? '' : 's'}`
    statusBarItem.tooltip = `${result.issues.length} issue(s)${high ? ` (${high} high-severity)` : ''} in ${fileNameOf(document)}. Click for actions.`
  }
  statusBarItem.show()
}

function toDiagnostic(document: vscode.TextDocument, issue: Issue): vscode.Diagnostic {
  const line = Math.max(0, issue.line - 1)
  const text = document.lineAt(Math.min(line, document.lineCount - 1)).text
  const range = new vscode.Range(line, 0, line, text.length)
  const diagnostic = new vscode.Diagnostic(range, `${issue.title}: ${issue.summary}`, severityOf(issue.severity))
  diagnostic.source = 'Linty'
  diagnostic.code = issue.id
  return diagnostic
}

function severityOf(severity: Issue['severity']): vscode.DiagnosticSeverity {
  if (severity === 'high') return vscode.DiagnosticSeverity.Error
  if (severity === 'medium') return vscode.DiagnosticSeverity.Warning
  return vscode.DiagnosticSeverity.Information
}

class LintyCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    const result = results.get(document.uri.toString())
    if (!result) return []

    const actions: vscode.CodeAction[] = []
    const matched = context.diagnostics
      .map((diagnostic) => ({ diagnostic, issue: result.issues.find((issue) => issue.id === diagnostic.code) }))
      .filter((entry): entry is { diagnostic: vscode.Diagnostic; issue: Issue } => Boolean(entry.issue))

    for (const { diagnostic, issue } of matched) {
      const action = new vscode.CodeAction(`Fix: ${issue.title}`, vscode.CodeActionKind.QuickFix)
      action.diagnostics = [diagnostic]
      action.edit = buildEdit(document, [issue])
      action.isPreferred = true
      actions.push(action)
    }

    if (result.issues.length > 0) {
      const fixAll = new vscode.CodeAction('Fix all Linty issues', vscode.CodeActionKind.QuickFix)
      fixAll.edit = buildEdit(document, result.issues)
      actions.push(fixAll)
    }

    return actions
  }
}

function buildEdit(document: vscode.TextDocument, issues: Issue[]): vscode.WorkspaceEdit {
  const edit = new vscode.WorkspaceEdit()
  for (const issue of issues) {
    edit.replace(document.uri, issueRange(document, issue), issue.fixed.lines.join('\n'))
  }
  return edit
}

function issueRange(document: vscode.TextDocument, issue: Issue): vscode.Range {
  const startLine = Math.max(0, issue.original.startLine - 1)
  const count = Math.max(1, issue.original.lines.length)
  const endLine = Math.min(document.lineCount - 1, startLine + count - 1)
  const endChar = document.lineAt(endLine).text.length
  return new vscode.Range(startLine, 0, endLine, endChar)
}

function toLanguage(document: vscode.TextDocument): Language {
  const id = document.languageId
  return id === 'typescript' || id === 'typescriptreact' ? 'typescript' : 'javascript'
}

function fileNameOf(document: vscode.TextDocument): string {
  return document.fileName.split(/[\\/]/).pop() ?? 'file'
}

function isSupported(document: vscode.TextDocument): boolean {
  return SUPPORTED_LANGUAGES.includes(document.languageId)
}

async function fixAllIssues(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor || !isSupported(editor.document)) {
    void vscode.window.showWarningMessage('Linty: open a JavaScript or TypeScript file first.')
    return
  }
  const result = results.get(editor.document.uri.toString())
  if (!result || result.issues.length === 0) {
    void vscode.window.showInformationMessage('Linty: no issues to fix.')
    return
  }
  const applied = await vscode.workspace.applyEdit(buildEdit(editor.document, result.issues))
  if (applied) {
    void vscode.window.showInformationMessage(`Linty: applied ${result.issues.length} fix(es).`)
    void analyzeDocument(editor.document)
  }
}

async function showQuickActions(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  const result = editor ? results.get(editor.document.uri.toString()) : undefined

  const items: vscode.QuickPickItem[] = []
  if (result && result.issues.length > 0) {
    items.push({ label: '$(wrench) Fix all issues', description: `${result.issues.length} issue(s)` })
  }
  if (result) {
    items.push({ label: '$(graph) Show report' })
  }
  items.push({ label: '$(list-unordered) View problems' })

  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Linty actions' })
  if (!picked) return
  if (picked.label.includes('Fix all')) await vscode.commands.executeCommand('linty.fixAll')
  else if (picked.label.includes('report')) await vscode.commands.executeCommand('linty.showReport')
  else await vscode.commands.executeCommand('workbench.action.problems.focus')
}

// ---------------------------------------------------------------------------
// Report webview
// ---------------------------------------------------------------------------

function showReport(result: AnalysisResult | undefined): void {
  if (!result) {
    void vscode.window.showInformationMessage('Linty: run "Linty: Analyze File" first to see a report.')
    return
  }
  const panel = vscode.window.createWebviewPanel(
    'linty.report',
    `Linty — ${result.fileName}`,
    vscode.ViewColumn.Beside,
    { enableScripts: false, retainContextWhenHidden: true },
  )
  panel.webview.html = reportHtml(result)
}

function reportHtml(result: AnalysisResult): string {
  const report = result.report
  const scoreRows = (
    [
      ['Bug', report.scoreBreakdown.bugScore],
      ['Complexity', report.scoreBreakdown.complexityScore],
      ['Security', report.scoreBreakdown.securityScore],
      ['Test', report.scoreBreakdown.testScore],
      ['Maintainability', report.scoreBreakdown.maintainabilityScore],
    ] as const
  )
    .map(
      ([label, value]) =>
        `<div class="score-row"><span class="score-label">${label}</span><div class="bar"><div class="fill" style="width:${value}%"></div></div><span class="score-value">${value}</span></div>`,
    )
    .join('')

  const issueItems = result.issues.length
    ? result.issues
        .map(
          (issue) =>
            `<li class="issue"><span class="sev sev-${issue.severity}">${issue.severity}</span><div class="issue-body"><strong>${escapeHtml(issue.title)}</strong><p>${escapeHtml(issue.summary)}</p><span class="line">line ${issue.line}</span></div></li>`,
        )
        .join('')
    : '<li class="clean">No issues found — the code looks clean.</li>'

  const recommendations = report.recommendations.length
    ? report.recommendations.map((rec) => `<li>${escapeHtml(rec)}</li>`).join('')
    : '<li>Keep up the good work.</li>'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Linty report</title>
<style>
  :root {
    --bg: var(--vscode-editor-background, #161b24);
    --fg: var(--vscode-editor-foreground, #e8edf3);
    --muted: var(--vscode-descriptionForeground, #8b98a9);
    --border: var(--vscode-panel-border, #2a3340);
    --accent: #8b5cf6;
    --red: var(--vscode-errorForeground, #f87171);
    --amber: var(--vscode-editorWarning-foreground, #fbbf24);
    --green: var(--vscode-testing-iconPassed, #34d399);
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 20px;
    background: var(--bg); color: var(--fg);
    font-family: var(--vscode-font-family, -apple-system, Segoe UI, sans-serif);
    font-size: 13px; line-height: 1.5;
  }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .file { color: var(--muted); font-family: var(--vscode-editor-font-family, monospace); font-size: 12px; margin: 0 0 16px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 18px; }
  .card { border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
  .card .value { font-size: 22px; font-weight: 600; }
  .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
  .section { border: 1px solid var(--border); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
  .section h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); margin: 0 0 10px; }
  .score-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .score-label { width: 110px; flex-shrink: 0; color: var(--muted); }
  .score-value { width: 28px; text-align: right; font-variant-numeric: tabular-nums; }
  .bar { flex: 1; height: 6px; background: color-mix(in srgb, var(--fg) 12%, transparent); border-radius: 3px; overflow: hidden; }
  .fill { height: 100%; background: var(--accent); border-radius: 3px; }
  ul { list-style: none; margin: 0; padding: 0; }
  .issue { display: flex; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); }
  .issue:last-child { border-bottom: none; }
  .sev { flex-shrink: 0; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; padding: 2px 6px; border-radius: 4px; height: fit-content; }
  .sev-high { color: var(--red); background: color-mix(in srgb, var(--red) 15%, transparent); }
  .sev-medium { color: var(--amber); background: color-mix(in srgb, var(--amber) 15%, transparent); }
  .sev-low { color: var(--muted); background: color-mix(in srgb, var(--muted) 15%, transparent); }
  .issue-body p { margin: 2px 0; color: var(--muted); }
  .line { color: var(--muted); font-family: monospace; font-size: 11px; }
  .clean { color: var(--green); }
  .recs li { padding: 4px 0 4px 16px; position: relative; }
  .recs li::before { content: '·'; position: absolute; left: 4px; color: var(--accent); }
</style>
</head>
<body>
  <h1>${escapeHtml(result.fileName)}</h1>
  <p class="file">${result.issues.length} issue(s) · overall score ${report.overallScore}/100 · confidence ${result.confidence}%</p>
  <div class="cards">
    <div class="card"><div class="value">${report.overallScore}</div><div class="label">Overall</div></div>
    <div class="card"><div class="value">${result.issues.length}</div><div class="label">Issues</div></div>
    <div class="card"><div class="value">${result.tests.length}</div><div class="label">Tests</div></div>
    <div class="card"><div class="value">${result.confidence}%</div><div class="label">Confidence</div></div>
  </div>
  <div class="section">
    <h2>Scores</h2>
    ${scoreRows}
  </div>
  <div class="section">
    <h2>Issues</h2>
    <ul>${issueItems}</ul>
  </div>
  <div class="section">
    <h2>Summary</h2>
    <p>${escapeHtml(report.summary)}</p>
  </div>
  <div class="section">
    <h2>Recommendations</h2>
    <ul class="recs">${recommendations}</ul>
  </div>
  <div class="section">
    <h2>Conclusion</h2>
    <p>${escapeHtml(report.conclusion)}</p>
  </div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
