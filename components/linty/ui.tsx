import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Braces } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CodeSnippet, Severity } from '@/lib/linty-data'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

const buttonStyles: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'border border-border bg-card text-foreground hover:bg-accent',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
}

export function PanelButton({
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel',
        'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5 [&_svg]:shrink-0',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

export function LintyLogo({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground',
        size === 'md' ? 'size-10' : 'size-5 rounded',
      )}
      aria-hidden="true"
    >
      <Braces className={size === 'md' ? 'size-5' : 'size-3'} strokeWidth={2.25} />
    </span>
  )
}

const severityStyles: Record<Severity, { label: string; dot: string; text: string }> = {
  high: { label: 'High', dot: 'bg-destructive', text: 'text-destructive' },
  medium: { label: 'Medium', dot: 'bg-warning', text: 'text-warning' },
  low: { label: 'Low', dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const style = severityStyles[severity]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', style.text)}>
      <span className={cn('size-1.5 rounded-full', style.dot)} aria-hidden="true" />
      {style.label}
      <span className="sr-only"> severity</span>
    </span>
  )
}

export function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h3>
      {action}
    </div>
  )
}

export function CodeBlock({
  snippet,
  tone,
}: {
  snippet: CodeSnippet
  tone: 'removed' | 'added'
}) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border bg-background py-2 font-mono text-[12px] leading-5">
      <code className="block min-w-max">
        {snippet.lines.map((text, index) => {
          const lineNumber = snippet.startLine + index
          const isHighlighted = snippet.highlight.includes(lineNumber)
          return (
            <span
              key={lineNumber}
              className={cn(
                'flex border-l-2 border-transparent pr-3',
                isHighlighted && tone === 'removed' && 'border-destructive bg-destructive/10',
                isHighlighted && tone === 'added' && 'border-primary bg-primary/10',
              )}
            >
              <span className="w-9 shrink-0 select-none pr-3 text-right text-muted-foreground/60">{lineNumber}</span>
              <span className="whitespace-pre text-foreground/90">{text || ' '}</span>
            </span>
          )
        })}
      </code>
    </pre>
  )
}
