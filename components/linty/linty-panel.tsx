'use client'

import { useState } from 'react'
import {
  DEFAULT_CODE,
  DEFAULT_FILE,
  type AnalysisResult,
  type Issue,
  type Language,
  type TestCase,
} from '@/lib/linty-data'
import { PanelTitleBar, ScreenHeader } from './panel-header'
import { HomeScreen } from './screens/home-screen'
import { AnalyzingScreen } from './screens/analyzing-screen'
import { IssuesScreen } from './screens/issues-screen'
import { FixScreen } from './screens/fix-screen'
import { ExplanationScreen } from './screens/explanation-screen'
import { TestsScreen, type TestRunState } from './screens/tests-screen'
import { ReportScreen } from './screens/report-screen'

type Screen = 'home' | 'analyzing' | 'issues' | 'fix' | 'explanation' | 'tests' | 'report'

export function LintyPanel() {
  const [screen, setScreen] = useState<Screen>('home')
  const [history, setHistory] = useState<Screen[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [language, setLanguage] = useState<Language>('javascript')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [selectedIssueId, setSelectedIssueId] = useState<string | null>(null)
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set())
  const [testRunState, setTestRunState] = useState<TestRunState>('idle')
  const [error, setError] = useState<string | null>(null)

  const issues: Issue[] = result?.issues ?? []
  const tests: TestCase[] = result?.tests ?? []
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId) ?? issues[0]

  const goTo = (next: Screen) => {
    setHistory((stack) => [...stack, screen])
    setScreen(next)
  }

  const goBack = () => {
    setScreen(history.at(-1) ?? 'issues')
    setHistory(history.slice(0, -1))
  }

  const startAnalysis = (name: string, sourceCode: string, lang: Language) => {
    setFileName(name)
    setCode(sourceCode)
    setLanguage(lang)
    setResult(null)
    setError(null)
    setSelectedIssueId(null)
    setAppliedFixes(new Set())
    setTestRunState('idle')
    setHistory([])
    setScreen('analyzing')
  }

  const handleResult = (analysis: AnalysisResult) => {
    setResult(analysis)
    setSelectedIssueId(analysis.issues[0]?.id ?? null)
    setScreen('issues')
  }

  const handleError = (message: string) => {
    setError(message)
    setResult(null)
    setScreen('home')
  }

  const reset = () => {
    setFileName(null)
    setCode(null)
    setResult(null)
    setError(null)
    setSelectedIssueId(null)
    setAppliedFixes(new Set())
    setTestRunState('idle')
    setHistory([])
    setScreen('home')
  }

  const runTests = () => {
    setTestRunState('running')
    setTimeout(() => setTestRunState('passed'), 1400)
  }

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return (
          <HomeScreen
            currentFile={fileName ?? DEFAULT_FILE}
            defaultCode={DEFAULT_CODE}
            error={error}
            onAnalyze={startAnalysis}
            onDismissError={() => setError(null)}
          />
        )
      case 'analyzing':
        if (code === null) {
          return <HomeScreen currentFile={DEFAULT_FILE} defaultCode={DEFAULT_CODE} error={null} onAnalyze={startAnalysis} onDismissError={() => setError(null)} />
        }
        return (
          <AnalyzingScreen
            fileName={fileName ?? DEFAULT_FILE}
            code={code}
            language={language}
            onResult={handleResult}
            onError={handleError}
            onCancel={reset}
          />
        )
      case 'issues':
        return (
          <>
            <ScreenHeader title="Issues" subtitle={`Found in ${fileName ?? DEFAULT_FILE}`} />
            <IssuesScreen
              issues={issues}
              appliedFixes={appliedFixes}
              onViewFix={(id) => {
                setSelectedIssueId(id)
                goTo('fix')
              }}
              onViewTests={() => goTo('tests')}
              onViewReport={() => goTo('report')}
            />
          </>
        )
      case 'fix':
        if (!selectedIssue) return renderFallback()
        return (
          <>
            <ScreenHeader
              title="Fix Suggestion"
              subtitle={`Line ${selectedIssue.line} · ${selectedIssue.title}`}
              onBack={goBack}
            />
            <FixScreen
              issue={selectedIssue}
              isApplied={appliedFixes.has(selectedIssue.id)}
              onApply={() => setAppliedFixes((fixes) => new Set(fixes).add(selectedIssue.id))}
              onExplain={() => goTo('explanation')}
            />
          </>
        )
      case 'explanation':
        if (!selectedIssue) return renderFallback()
        return (
          <>
            <ScreenHeader title="Explanation" subtitle={selectedIssue.title} onBack={goBack} />
            <ExplanationScreen issue={selectedIssue} onViewTests={() => goTo('tests')} />
          </>
        )
      case 'tests':
        return (
          <>
            <ScreenHeader title="Generated Tests" subtitle="Covering every detected issue" onBack={goBack} />
            <TestsScreen
              tests={tests}
              issues={issues}
              runState={testRunState}
              onRun={runTests}
              onViewReport={() => goTo('report')}
            />
          </>
        )
      case 'report':
        if (!result) return renderFallback()
        return (
          <>
            <ScreenHeader title="Report" subtitle={`Analysis of ${fileName ?? DEFAULT_FILE}`} onBack={goBack} />
            <ReportScreen
              report={result.report}
              issuesFound={issues.length}
              fixesApplied={appliedFixes.size}
              testsGenerated={tests.length}
              testsPassed={testRunState === 'passed'}
              confidence={result.confidence}
              onBackToIssues={() => {
                setHistory([])
                setScreen('issues')
              }}
              onRestart={reset}
            />
          </>
        )
    }
  }

  function renderFallback() {
    return (
      <>
        <ScreenHeader title="Issues" subtitle={`Found in ${fileName ?? DEFAULT_FILE}`} />
        <IssuesScreen
          issues={issues}
          appliedFixes={appliedFixes}
          onViewFix={(id) => {
            setSelectedIssueId(id)
            goTo('fix')
          }}
          onViewTests={() => goTo('tests')}
          onViewReport={() => goTo('report')}
        />
      </>
    )
  }

  return (
    <section
      aria-label="Linty extension panel"
      className="flex h-dvh w-full flex-col overflow-hidden bg-panel sm:h-[min(720px,calc(100dvh-3rem))] sm:max-w-[360px] sm:rounded-lg sm:border sm:border-border"
    >
      <PanelTitleBar fileName={fileName} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{renderScreen()}</div>
    </section>
  )
}
