import { AlertTriangle, FlaskConical, Lightbulb, ShieldQuestion, Wrench } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Issue } from '@/lib/linty-data'
import { PanelButton } from '../ui'

function ExplanationBlock({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: string }) {
  return (
    <section className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        <p className="mt-1 text-pretty text-[12px] leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </section>
  )
}

export function ExplanationScreen({ issue, onViewTests }: { issue: Issue; onViewTests: () => void }) {
  const { explanation } = issue
  return (
    <div className="flex flex-1 flex-col gap-5 p-4">
      <ExplanationBlock icon={AlertTriangle} title="What's wrong?">
        {explanation.problem}
      </ExplanationBlock>
      <ExplanationBlock icon={ShieldQuestion} title="Why does it matter?">
        {explanation.whyItMatters}
      </ExplanationBlock>
      <ExplanationBlock icon={Wrench} title="How the fix helps">
        {explanation.whatChanged}
      </ExplanationBlock>

      <div className="flex gap-2.5 rounded-md border border-primary/30 bg-primary/10 p-3">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-foreground">
          <span className="font-medium">Remember: </span>
          {explanation.tip}
        </p>
      </div>

      <PanelButton variant="secondary" className="mt-auto w-full" onClick={onViewTests}>
        <FlaskConical />
        View Generated Tests
      </PanelButton>
    </div>
  )
}
