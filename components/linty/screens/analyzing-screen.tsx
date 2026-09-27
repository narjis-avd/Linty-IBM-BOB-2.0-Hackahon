'use client'

import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ANALYSIS_STEPS, type AnalysisResult, type Language } from '@/lib/linty-data'
import { requestCodeAnalysis } from '@/lib/linty/client'
import { PanelButton } from '../ui'

const STEP_DURATION_MS = 750

export function AnalyzingScreen({
  fileName,
  code,
  language,
  onResult,
  onError,
  onCancel,
}: {
  fileName: string
  code: string
  language: Language
  onResult: (result: AnalysisResult) => void
  onError: (message: string) => void
  onCancel: () => void
}) {
  const [activeStep, setActiveStep] = useState(0)
  const finish = useEffectEvent(onResult)
  const fail = useEffectEvent(onError)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Visual step animation.
  useEffect(() => {
    if (activeStep >= ANALYSIS_STEPS.length) return
    const timer = setTimeout(() => setActiveStep((step) => step + 1), STEP_DURATION_MS)
    return () => clearTimeout(timer)
  }, [activeStep])

  // Run the real analysis against the API.
  useEffect(() => {
    let cancelled = false
    requestCodeAnalysis(code, fileName, language)
      .then((result) => {
        if (cancelled) return
        setActiveStep(ANALYSIS_STEPS.length)
        timerRef.current = setTimeout(() => finish(result), 350)
      })
      .catch((requestError) => {
        if (cancelled) return
        fail(requestError instanceof Error ? requestError.message : 'Analysis failed.')
      })
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [code, fileName, language])

  const progress = Math.min(100, Math.round((activeStep / ANALYSIS_STEPS.length) * 100))

  return (
    <div className="flex flex-1 flex-col gap-5 p-4">
      <div>
        <p className="text-[13px] text-foreground">
          Analyzing <span className="font-mono">{fileName}</span>
        </p>
        <div
          className="mt-3 h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Analysis progress"
        >
          <div className="h-full bg-primary transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-1.5 text-right text-[11px] text-muted-foreground">{progress}%</p>
      </div>

      <ol className="flex flex-col gap-1" aria-live="polite">
        {ANALYSIS_STEPS.map((step, index) => {
          const isDone = index < activeStep
          const isActive = index === activeStep
          return (
            <li
              key={step}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-[13px]',
                isActive && 'bg-card',
                isDone ? 'text-foreground' : isActive ? 'text-foreground' : 'text-muted-foreground/70',
              )}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border',
                  isDone && 'border-primary bg-primary text-primary-foreground',
                  isActive && 'border-primary text-primary',
                  !isDone && !isActive && 'border-border',
                )}
                aria-hidden="true"
              >
                {isDone && <Check className="size-3" strokeWidth={3} />}
                {isActive && <Loader2 className="size-3 animate-spin" />}
              </span>
              {step}
              {isDone && <span className="sr-only"> (done)</span>}
              {isActive && <span className="sr-only"> (in progress)</span>}
            </li>
          )
        })}
      </ol>

      <PanelButton variant="ghost" className="mt-auto self-center" onClick={onCancel}>
        Cancel
      </PanelButton>
    </div>
  )
}
