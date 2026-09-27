'use client'

import { useRef, useState } from 'react'
import { CircleAlert, ClipboardPaste, Lightbulb, ScanSearch, Upload, X } from 'lucide-react'
import { detectLanguage, type Language } from '@/lib/linty-data'
import { LintyLogo, PanelButton } from '../ui'

export function HomeScreen({
  currentFile,
  defaultCode,
  error,
  onAnalyze,
  onDismissError,
}: {
  currentFile: string
  defaultCode: string
  error: string | null
  onAnalyze: (fileName: string, code: string, language: Language) => void
  onDismissError: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isPasting, setIsPasting] = useState(false)
  const [pastedCode, setPastedCode] = useState('')

  const handleUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      if (text.trim().length === 0) return
      onAnalyze(file.name, text, detectLanguage(file.name, text))
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-1 flex-col gap-5 p-4">
      <div className="flex flex-col items-center gap-3 pt-6 text-center">
        <LintyLogo />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Linty</h1>
          <p className="mt-1 text-pretty text-[13px] leading-relaxed text-muted-foreground">
            Your AI code assistant for cleaner, safer code
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-2.5">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-foreground">{error}</p>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Dismiss error"
            className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <PanelButton className="h-9 w-full" onClick={() => onAnalyze(currentFile, defaultCode, detectLanguage(currentFile, defaultCode))}>
          <ScanSearch />
          Analyze Current File
        </PanelButton>
        <div className="grid grid-cols-2 gap-2">
          <PanelButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload />
            Upload File
          </PanelButton>
          <PanelButton
            variant="secondary"
            aria-expanded={isPasting}
            onClick={() => setIsPasting((open) => !open)}
          >
            <ClipboardPaste />
            Paste Code
          </PanelButton>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".js,.jsx,.ts,.tsx,.mjs,.cjs"
          className="sr-only"
          tabIndex={-1}
          aria-label="Upload a code file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleUpload(file)
            event.target.value = ''
          }}
        />
      </div>

      {isPasting && (
        <div className="flex flex-col gap-2">
          <label htmlFor="pasted-code" className="text-[12px] text-muted-foreground">
            Paste your code below
          </label>
          <textarea
            id="pasted-code"
            value={pastedCode}
            onChange={(event) => setPastedCode(event.target.value)}
            rows={7}
            spellCheck={false}
            placeholder="function example() { ... }"
            className="resize-none rounded-md border border-input bg-background p-2 font-mono text-[12px] leading-5 text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
          />
          <PanelButton
            disabled={!pastedCode.trim()}
            onClick={() => onAnalyze('snippet.js', pastedCode, detectLanguage('snippet.js', pastedCode))}
          >
            Analyze Snippet
          </PanelButton>
        </div>
      )}

      <div className="mt-auto flex gap-2.5 rounded-md border border-border bg-card p-3">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-[12px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Tip: </span>
          Paste a snippet or upload a file and Linty will scan it for real issues — secrets, injection,
          unsafe DOM access, and more — with fixes and tests for each one.
        </p>
      </div>
    </div>
  )
}
