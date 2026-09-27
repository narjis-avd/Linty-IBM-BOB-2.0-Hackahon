import { Check, MessageCircleQuestion } from 'lucide-react'
import type { Issue } from '@/lib/linty-data'
import { CodeBlock, PanelButton, SectionLabel, SeverityBadge } from '../ui'

export function FixScreen({
  issue,
  isApplied,
  onApply,
  onExplain,
}: {
  issue: Issue
  isApplied: boolean
  onApply: () => void
  onExplain: () => void
}) {
  return (
    <div className="flex flex-1 flex-col gap-4 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] text-muted-foreground">{issue.summary}</p>
        <SeverityBadge severity={issue.severity} />
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="original-code">
        <SectionLabel>
          <span id="original-code">Original Code</span>
        </SectionLabel>
        <CodeBlock snippet={issue.original} tone="removed" />
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="fixed-code">
        <SectionLabel>
          <span id="fixed-code">Fixed Code</span>
        </SectionLabel>
        <CodeBlock snippet={issue.fixed} tone="added" />
      </section>

      <div className="mt-auto flex flex-col gap-2">
        <PanelButton className="h-9 w-full" onClick={onApply} disabled={isApplied}>
          {isApplied ? (
            <>
              <Check />
              Fix Applied
            </>
          ) : (
            'Apply Fix'
          )}
        </PanelButton>
        <PanelButton variant="secondary" className="w-full" onClick={onExplain}>
          <MessageCircleQuestion />
          Explain This Fix
        </PanelButton>
      </div>
    </div>
  )
}
