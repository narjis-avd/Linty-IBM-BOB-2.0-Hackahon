import { RotateCcw } from 'lucide-react'
import type { Report } from '@/lib/linty-data'
import { PanelButton, SectionLabel } from '../ui'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-1">
        <span className="text-xl font-semibold tabular-nums text-foreground">{value}</span>
        {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-24 shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary" style={{ width: `${value}%` }} />
      </div>
      <span className="w-7 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{value}</span>
    </div>
  )
}

export function ReportScreen({
  report,
  issuesFound,
  fixesApplied,
  testsGenerated,
  testsPassed,
  confidence,
  onBackToIssues,
  onRestart,
}: {
  report: Report
  issuesFound: number
  fixesApplied: number
  testsGenerated: number
  testsPassed: boolean
  confidence: number
  onBackToIssues: () => void
  onRestart: () => void
}) {
  const remaining = issuesFound - fixesApplied
  const progress = issuesFound > 0 ? (fixesApplied / issuesFound) * 100 : 100

  return (
    <div className="flex flex-1 flex-col gap-4 p-3">
      <dl className="grid grid-cols-2 gap-2">
        <StatCard label="Issues Found" value={String(issuesFound)} />
        <StatCard label="Fixes Applied" value={String(fixesApplied)} hint={issuesFound ? `of ${issuesFound}` : undefined} />
        <StatCard label="Tests Generated" value={String(testsGenerated)} hint={testsPassed ? 'passing' : undefined} />
        <StatCard label="AI Confidence" value={`${confidence}%`} />
      </dl>

      <section className="flex flex-col gap-2">
        <SectionLabel
          action={
            <span className="font-mono text-[11px] text-muted-foreground">
              {report.overallScore}/100
            </span>
          }
        >
          Overall Score
        </SectionLabel>
        <div className="flex flex-col gap-1.5 rounded-md border border-border bg-card p-3">
          <ScoreRow label="Bugs" value={report.scoreBreakdown.bugScore} />
          <ScoreRow label="Complexity" value={report.scoreBreakdown.complexityScore} />
          <ScoreRow label="Security" value={report.scoreBreakdown.securityScore} />
          <ScoreRow label="Tests" value={report.scoreBreakdown.testScore} />
          <ScoreRow label="Maintainability" value={report.scoreBreakdown.maintainabilityScore} />
        </div>
      </section>

      <div className="flex flex-col gap-1.5" aria-hidden="true">
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <SectionLabel>Summary</SectionLabel>
        <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">{report.summary}</p>
      </section>

      {report.recommendations.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Recommendations</SectionLabel>
          <ul className="flex flex-col gap-1.5">
            {report.recommendations.map((recommendation) => (
              <li key={recommendation} className="flex gap-2 text-[12px] leading-relaxed text-muted-foreground">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                {recommendation}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <SectionLabel>Conclusion</SectionLabel>
        <p className="text-pretty text-[12px] leading-relaxed text-muted-foreground">{report.conclusion}</p>
      </section>

      <div className="mt-auto flex flex-col gap-2">
        {remaining > 0 && (
          <PanelButton className="h-9 w-full" onClick={onBackToIssues}>
            Review Remaining Issues
          </PanelButton>
        )}
        <PanelButton variant={remaining > 0 ? 'secondary' : 'primary'} className="w-full" onClick={onRestart}>
          <RotateCcw />
          Analyze Another File
        </PanelButton>
      </div>
    </div>
  )
}
