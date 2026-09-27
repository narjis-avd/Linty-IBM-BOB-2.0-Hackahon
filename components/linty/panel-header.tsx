import { ChevronLeft, FileCode2, MoreHorizontal } from 'lucide-react'
import { LintyLogo } from './ui'

export function PanelTitleBar({ fileName }: { fileName: string | null }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-between border-b border-border px-3">
      <div className="flex items-center gap-2">
        <LintyLogo size="sm" />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">Linty</span>
      </div>
      <div className="flex items-center gap-1">
        {fileName && (
          <span className="flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            <FileCode2 className="size-3" aria-hidden="true" />
            {fileName}
          </span>
        )}
        <button
          type="button"
          aria-label="More actions"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>
    </div>
  )
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Go back"
          className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
        </button>
      )}
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="truncate text-[12px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  )
}
