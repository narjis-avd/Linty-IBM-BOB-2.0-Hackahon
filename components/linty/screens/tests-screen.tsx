import { ChevronRight, CircleCheck, Circle, Loader2, Play } from 'lucide-react'
import type { Issue, TestCase } from '@/lib/linty-data'
import { PanelButton, SectionLabel } from '../ui'

export type TestRunState = 'idle' | 'running' | 'passed'

export function TestsScreen({
  tests,
  issues,
  runState,
  onRun,
  onViewReport,
}: {
  tests: TestCase[]
  issues: Issue[]
  runState: TestRunState
  onRun: () => void
  onViewReport: () => void
}) {
  const issueLine = (issueId: string) => issues.find((issue) => issue.id === issueId)?.line

  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <SectionLabel
        action={
          runState === 'passed' ? (
            <span className="text-[11px] font-medium text-success">
              {tests.length}/{tests.length} passed
            </span>
          ) : (
            <span className="font-mono text-[11px] text-muted-foreground">cart.test.js</span>
          )
        }
      >
        {tests.length} tests generated
      </SectionLabel>

      <ul className="flex flex-col overflow-hidden rounded-md border border-border bg-card" aria-live="polite">
        {tests.map((test) => (
          <li key={test.id} className="border-b border-border last:border-b-0">
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 hover:bg-accent [&::-webkit-details-marker]:hidden">
                <ChevronRight
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{test.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">L{issueLine(test.issueId)}</span>
                {runState === 'passed' && (
                  <CircleCheck className="size-3.5 shrink-0 text-success" aria-label="Passed" />
                )}
                {runState === 'running' && (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" aria-label="Running" />
                )}
                {runState === 'idle' && (
                  <Circle className="size-3.5 shrink-0 text-muted-foreground/50" aria-label="Not run" />
                )}
              </summary>
              <pre className="overflow-x-auto border-t border-border bg-background px-3 py-2 font-mono text-[11px] leading-5 text-foreground/90">
                <code>{test.code.join('\n')}</code>
              </pre>
            </details>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2 pt-1">
        <PanelButton className="h-9 w-full" onClick={onRun} disabled={runState === 'running'}>
          {runState === 'running' ? <Loader2 className="animate-spin" /> : <Play />}
          {runState === 'running' ? 'Running Tests...' : runState === 'passed' ? 'Run Again' : 'Run Tests'}
        </PanelButton>
        <PanelButton variant="secondary" className="w-full" onClick={onViewReport}>
          View Report
        </PanelButton>
      </div>
    </div>
  )
}
