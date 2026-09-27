import { CheckCircle2, ChevronRight, FlaskConical, FileBarChart } from 'lucide-react'
import type { Issue } from '@/lib/linty-data'
import { PanelButton, SectionLabel, SeverityBadge } from '../ui'

export function IssuesScreen({
  issues,
  appliedFixes,
  onViewFix,
  onViewTests,
  onViewReport,
}: {
  issues: Issue[]
  appliedFixes: Set<string>
  onViewFix: (issueId: string) => void
  onViewTests: () => void
  onViewReport: () => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-3 p-3">
      <SectionLabel
        action={
          <span className="text-[11px] text-muted-foreground">
            {appliedFixes.size}/{issues.length} fixed
          </span>
        }
      >
        {issues.length} issues found
      </SectionLabel>

      <ul className="flex flex-col gap-2">
        {issues.map((issue) => {
          const isFixed = appliedFixes.has(issue.id)
          return (
            <li key={issue.id} className="rounded-md border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                  Line {issue.line}
                </span>
                {isFixed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Fixed
                  </span>
                ) : (
                  <SeverityBadge severity={issue.severity} />
                )}
              </div>
              <h3 className="mt-2 text-[13px] font-medium text-foreground">{issue.title}</h3>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">{issue.summary}</p>
              <button
                type="button"
                onClick={() => onViewFix(issue.id)}
                className="mt-2 inline-flex items-center gap-0.5 rounded text-[12px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                View Fixes
                <ChevronRight className="size-3.5" aria-hidden="true" />
                <span className="sr-only"> for {issue.title}</span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
        <PanelButton variant="secondary" onClick={onViewTests}>
          <FlaskConical />
          Tests
        </PanelButton>
        <PanelButton variant="secondary" onClick={onViewReport}>
          <FileBarChart />
          Report
        </PanelButton>
      </div>
    </div>
  )
}
