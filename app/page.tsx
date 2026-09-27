'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bug,
  CheckCircle2,
  Circle,
  Download,
  FileCode2,
  FlaskConical,
  Gauge,
  Loader2,
  Play,
  ScrollText,
  Sparkles,
  Upload,
  XCircle,
  Zap,
} from 'lucide-react';
import {
  LintyReportSchema,
  STAGES,
  type Issue,
  type LintyReport,
  type PipelineEvent,
  type Stage,
} from '@/lib/linty/schema';
import { sideBySideDiff } from '@/lib/linty/diff';
import { cn } from '@/lib/utils';

interface IndexEntry {
  id: string;
  fileName: string;
  recordedAt: string;
  author: string | null;
  issues: number;
}

type StageState = 'pending' | 'running' | 'done' | 'error';
type Tab = 'issues' | 'fixed' | 'tests' | 'report';

const STAGE_LABELS: Record<Stage, string> = {
  analyze: 'Analyzer agent: detecting bugs',
  fix: 'Fixer agent: patching code',
  test: 'Tester agent: writing regression tests',
  report: 'Reporter agent: summarising',
};

const idleStages = (): Record<Stage, StageState> => ({ analyze: 'pending', fix: 'pending', test: 'pending', report: 'pending' });

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

export default function Home() {
  const [index, setIndex] = useState<IndexEntry[] | null>(null);
  const [live, setLive] = useState<{ live: boolean; model: string | null } | null>(null);
  const [report, setReport] = useState<LintyReport | null>(null);
  const [stages, setStages] = useState(idleStages);
  const [stageMs, setStageMs] = useState<Partial<Record<Stage, number>>>({});
  const [running, setRunning] = useState(false);
  const [mode, setMode] = useState<'replay' | 'live' | 'import' | null>(null);
  const [tab, setTab] = useState<Tab>('issues');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/reports/index.json')
      .then((res) => (res.ok ? res.json() : []))
      .then(setIndex)
      .catch(() => setIndex([]));
    fetch('/api/analyze')
      .then((res) => res.json())
      .then(setLive)
      .catch(() => setLive({ live: false, model: null }));
  }, []);

  function reset() {
    setReport(null);
    setError(null);
    setStages(idleStages());
    setStageMs({});
    setTab('issues');
  }

  // Replays a recorded Bob run stage by stage. Durations are compressed; the real ones are shown beside each stage.
  async function replay(id: string) {
    reset();
    setRunning(true);
    setMode('replay');
    try {
      const res = await fetch(`/reports/${id}.json`);
      if (!res.ok) throw new Error('Could not load that run.');
      const data = LintyReportSchema.parse(await res.json());
      setCode(data.originalCode);
      const real: Record<Stage, number | undefined> = {
        analyze: data.timings?.analyzeMs,
        fix: data.timings?.fixMs,
        test: data.timings?.testMs,
        report: data.timings?.reportMs,
      };
      for (const stage of STAGES) {
        setStages((s) => ({ ...s, [stage]: 'running' }));
        await new Promise((r) => setTimeout(r, 650));
        setStages((s) => ({ ...s, [stage]: 'done' }));
        if (real[stage] !== undefined) setStageMs((m) => ({ ...m, [stage]: real[stage] }));
      }
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Replay failed');
    } finally {
      setRunning(false);
    }
  }

  async function runLive() {
    reset();
    setRunning(true);
    setMode('live');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: 'typescript', fileName: 'snippet.ts' }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => null))?.error ?? 'Analysis failed');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines.filter(Boolean)) {
          const event = JSON.parse(line) as PipelineEvent;
          if (event.type === 'stage') {
            setStages((s) => ({ ...s, [event.stage]: event.status }));
            if (event.ms !== undefined) setStageMs((m) => ({ ...m, [event.stage]: event.ms }));
          } else if (event.type === 'result') {
            setReport(event.report);
          } else if (event.type === 'error') {
            throw new Error(event.message);
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setRunning(false);
    }
  }

  async function importReport(file: File) {
    reset();
    setMode('import');
    try {
      const data = LintyReportSchema.parse(JSON.parse(await file.text()));
      setCode(data.originalCode);
      setStages({ analyze: 'done', fix: 'done', test: 'done', report: 'done' });
      setReport(data);
    } catch {
      setError('That file is not a valid Linty report (public/reports/*.json from a Bob run).');
    }
  }

  function download() {
    if (!report) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `linty-${report.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-dvh bg-[#0B0F1A] text-slate-100">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[#0B0F1A]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4F8CFF] to-[#00E0FF] shadow-[0_0_18px_rgba(0,224,255,0.35)]">
              <Sparkles className="size-4 text-[#0B0F1A]" strokeWidth={2.4} />
            </div>
            <span className="text-lg font-semibold tracking-tight">Linty</span>
            <span className="hidden text-sm text-slate-400 sm:inline">AI code review, fixes and tests</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full border border-[#4F8CFF]/40 bg-[#4F8CFF]/10 px-2.5 py-1 text-[#9dbcff]">Built with IBM Bob</span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-slate-300">
              <span className={cn('size-2 rounded-full', live?.live ? 'bg-[#00FF9C]' : 'bg-amber-400')} />
              {live === null ? 'Checking…' : live.live ? `Live · ${live.model}` : 'Recorded runs'}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left column: choose input */}
        <section className="flex min-w-0 flex-col gap-4">
          <Panel title="Recorded Bob runs" icon={<ScrollText className="size-4" />}>
            <p className="mb-3 text-xs leading-relaxed text-slate-400">
              Each run was produced inside IBM Bob IDE by <code className="text-[#00E0FF]">/linty-review</code>: four Bob modes
              analyse, fix, test and report, then the generated tests are executed against the buggy and the fixed code.
            </p>
            {index === null ? (
              <p className="text-sm text-slate-500">Loading…</p>
            ) : index.length === 0 ? (
              <p className="rounded-lg border border-dashed border-white/15 p-3 text-sm text-slate-400">
                No runs published yet. In Bob IDE run <code className="text-[#00E0FF]">/linty-review samples/cart-total.ts</code> and push{' '}
                <code>public/reports/</code>.
              </p>
            ) : (
              <ul className="space-y-2">
                {index.map((entry) => (
                  <li key={entry.id}>
                    <button
                      onClick={() => replay(entry.id)}
                      disabled={running}
                      className={cn(
                        'group flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition',
                        report?.id === entry.id
                          ? 'border-[#4F8CFF]/60 bg-[#4F8CFF]/10'
                          : 'border-white/10 bg-white/[0.02] hover:border-[#4F8CFF]/40 hover:bg-white/[0.04]',
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-mono text-sm">{entry.fileName}</span>
                        <span className="text-xs text-slate-500">
                          {entry.issues} issues{entry.author ? ` · run by ${entry.author}` : ''}
                        </span>
                      </span>
                      <Play className="size-4 shrink-0 text-slate-500 group-hover:text-[#00E0FF]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              onClick={() => fileInput.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-sm text-slate-300 transition hover:border-white/25"
            >
              <Upload className="size-4" /> Open a report file
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importReport(file);
                e.target.value = '';
              }}
            />
          </Panel>

          <Panel title="Paste code" icon={<FileCode2 className="size-4" />}>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              placeholder="// Paste TypeScript or JavaScript here"
              className="h-56 w-full resize-y rounded-lg border border-white/10 bg-[#070a12] p-3 font-mono text-xs leading-relaxed text-slate-200 outline-none transition focus:border-[#4F8CFF]/60 focus:shadow-[0_0_0_3px_rgba(79,140,255,0.15)]"
            />
            <button
              onClick={runLive}
              disabled={running || !live?.live || !code.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#4F8CFF] to-[#00E0FF] py-2.5 text-sm font-semibold text-[#0B0F1A] shadow-[0_0_24px_rgba(0,224,255,0.25)] transition hover:shadow-[0_0_32px_rgba(0,224,255,0.45)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {running && mode === 'live' ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
              Run AI Analysis
            </button>
            {live && !live.live && (
              <p className="mt-2 text-xs text-slate-500">
                Live analysis needs IBM watsonx.ai credentials on the server. This deployment shows recorded Bob runs.
              </p>
            )}
          </Panel>
        </section>

        {/* Right column: pipeline + results */}
        <section className="flex min-w-0 flex-col gap-4">
          <Panel title="Agent pipeline" icon={<Gauge className="size-4" />}>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {STAGES.map((stage) => (
                <li
                  key={stage}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition',
                    stages[stage] === 'done' && 'border-[#00FF9C]/30 bg-[#00FF9C]/[0.06]',
                    stages[stage] === 'running' && 'border-[#00E0FF]/50 bg-[#00E0FF]/[0.07] shadow-[0_0_20px_rgba(0,224,255,0.15)]',
                    stages[stage] === 'error' && 'border-red-500/40 bg-red-500/10',
                    stages[stage] === 'pending' && 'border-white/10',
                  )}
                >
                  <StageIcon state={stages[stage]} />
                  <span className="min-w-0 flex-1 leading-tight">{STAGE_LABELS[stage]}</span>
                  {stageMs[stage] !== undefined && <span className="font-mono text-xs text-slate-400">{secs(stageMs[stage]!)}</span>}
                </li>
              ))}
            </ol>
            {mode === 'replay' && (running || report) && (
              <p className="mt-2 text-xs text-slate-500">
                Replaying a recorded Bob IDE run, sped up. The times shown are the real stage durations from that run.
              </p>
            )}
            {error && (
              <p className="mt-3 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {error}
              </p>
            )}
          </Panel>

          {report ? (
            <Results report={report} tab={tab} setTab={setTab} onDownload={download} />
          ) : (
            !running && (
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-10 text-center">
                <Bug className="mb-3 size-10 text-slate-600" />
                <h2 className="font-semibold">Pick a recorded run to see Linty work</h2>
                <p className="mt-1 max-w-md text-sm text-slate-400">
                  You&apos;ll see the issues found, the fixed code side by side, the generated tests and whether they pass, and the measured
                  results.
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </main>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1424] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-200">
        <span className="text-[#4F8CFF]">{icon}</span>
        {title}
      </h2>
      {children}
    </div>
  );
}

function StageIcon({ state }: { state: StageState }) {
  if (state === 'done') return <CheckCircle2 className="size-4 shrink-0 text-[#00FF9C]" />;
  if (state === 'running') return <Loader2 className="size-4 shrink-0 animate-spin text-[#00E0FF]" />;
  if (state === 'error') return <XCircle className="size-4 shrink-0 text-red-400" />;
  return <Circle className="size-4 shrink-0 text-slate-600" />;
}

function Results({
  report,
  tab,
  setTab,
  onDownload,
}: {
  report: LintyReport;
  tab: Tab;
  setTab: (tab: Tab) => void;
  onDownload: () => void;
}) {
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: 'issues', label: 'Issues', icon: <Bug className="size-4" />, count: report.analysis.errors.length },
    { id: 'fixed', label: 'Fixed code', icon: <FileCode2 className="size-4" /> },
    { id: 'tests', label: 'Tests', icon: <FlaskConical className="size-4" />, count: report.tests.cases.length },
    { id: 'report', label: 'Report', icon: <Gauge className="size-4" /> },
  ];

  return (
    <div className="rounded-xl border border-white/10 bg-[#0f1424]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 p-2">
        <div className="flex flex-wrap gap-1" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                tab === t.id ? 'bg-[#4F8CFF]/15 text-[#9dbcff]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
              )}
            >
              {t.icon}
              {t.label}
              {t.count !== undefined && <span className="rounded-full bg-white/10 px-1.5 text-xs">{t.count}</span>}
            </button>
          ))}
        </div>
        <button onClick={onDownload} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-slate-200">
          <Download className="size-4" /> Download report
        </button>
      </div>
      <div className="p-4">
        {tab === 'issues' && <IssuesTab report={report} />}
        {tab === 'fixed' && <FixedTab report={report} />}
        {tab === 'tests' && <TestsTab report={report} />}
        {tab === 'report' && <ReportTab report={report} />}
      </div>
    </div>
  );
}

const SEVERITY_STYLE: Record<Issue['severity'], string> = {
  High: 'border-red-500/40 bg-red-500/10 text-red-300',
  Medium: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  Low: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
};

function IssuesTab({ report }: { report: LintyReport }) {
  const fixed = new Set(report.fix.fixes.map((f) => f.issueId));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className={cn('rounded-full border px-2.5 py-0.5 text-xs', SEVERITY_STYLE[report.analysis.risk_level])}>
          Risk: {report.analysis.risk_level}
        </span>
        <span className="text-slate-400">{report.analysis.summary}</span>
      </div>
      {report.analysis.errors.length === 0 && <p className="text-sm text-slate-400">No issues found.</p>}
      {report.analysis.errors.map((issue) => (
        <article key={issue.id} className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-mono text-slate-500">{issue.id}</span>
            <span className={cn('rounded-full border px-2 py-0.5', SEVERITY_STYLE[issue.severity])}>{issue.severity}</span>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-slate-300">{issue.type}</span>
            {issue.line !== null && <span className="font-mono text-slate-400">line {issue.line}</span>}
            {fixed.has(issue.id) && (
              <span className="ml-auto flex items-center gap-1 text-[#00FF9C]">
                <CheckCircle2 className="size-3.5" /> fixed
              </span>
            )}
          </div>
          <p className="text-sm text-slate-200">{issue.description}</p>
          {issue.suggestion && <p className="mt-1 text-xs text-slate-400">→ {issue.suggestion}</p>}
        </article>
      ))}
    </div>
  );
}

function FixedTab({ report }: { report: LintyReport }) {
  const rows = useMemo(() => sideBySideDiff(report.originalCode, report.fix.fixedCode), [report]);
  const cell = 'whitespace-pre px-2 font-mono text-xs leading-5';
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-lg border border-white/10 bg-[#070a12]">
        <div className="grid min-w-[1040px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b border-white/10 text-xs font-semibold">
          <div className="px-3 py-2 text-red-300">Original</div>
          <div className="border-l border-white/10 px-3 py-2 text-[#00FF9C]">Fixed by Linty</div>
        </div>
        <div className="grid min-w-[1040px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {rows.map((row, i) => (
            <div key={i} className="contents">
              <div className={cn('flex min-w-0 overflow-hidden', row.kind === 'changed' && row.left !== null && 'bg-red-500/10')}>
                <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-xs leading-5 text-slate-600">{row.leftNo ?? ''}</span>
                <span className={cell}>{row.left ?? ''}</span>
              </div>
              <div className={cn('flex min-w-0 overflow-hidden border-l border-white/10', row.kind === 'changed' && row.right !== null && 'bg-[#00FF9C]/10')}>
                <span className="w-9 shrink-0 select-none pr-2 text-right font-mono text-xs leading-5 text-slate-600">{row.rightNo ?? ''}</span>
                <span className={cell}>{row.right ?? ''}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ul className="space-y-1.5 text-sm">
        {report.fix.fixes.map((fix) => (
          <li key={fix.issueId} className="flex gap-2">
            <span className="font-mono text-xs text-slate-500">{fix.issueId}</span>
            <span className="text-slate-300">{fix.change}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TestsTab({ report }: { report: LintyReport }) {
  const v = report.verification;
  return (
    <div className="space-y-4">
      {v ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <RunCard label="Tests on the original code" run={v.original} tone="bad" />
          <RunCard label="Tests on the fixed code" run={v.fixed} tone="good" />
          <p className="font-mono text-xs text-slate-500 sm:col-span-2">Executed with: {v.command}</p>
        </div>
      ) : (
        <p className="rounded-lg border border-white/10 p-3 text-sm text-slate-400">
          These tests were generated but not executed in this run. Recorded Bob runs execute them.
        </p>
      )}
      <ul className="space-y-1.5">
        {report.tests.cases.map((c) => (
          <li key={c.name} className="flex items-start gap-2 text-sm">
            <FlaskConical className="mt-0.5 size-4 shrink-0 text-[#4F8CFF]" />
            <span className="text-slate-300">{c.name}</span>
            <span className="ml-auto shrink-0 text-xs text-slate-500">{c.issueId ? `guards ${c.issueId}` : 'edge / happy path'}</span>
          </li>
        ))}
      </ul>
      <pre className="max-h-96 overflow-auto rounded-lg border border-white/10 bg-[#070a12] p-3 font-mono text-xs leading-5 text-slate-300">
        {report.tests.code}
      </pre>
    </div>
  );
}

function RunCard({ label, run, tone }: { label: string; run: { passed: number; failed: number; total: number }; tone: 'good' | 'bad' }) {
  const allPass = run.failed === 0 && run.total > 0;
  return (
    <div className={cn('rounded-lg border p-3', allPass ? 'border-[#00FF9C]/30 bg-[#00FF9C]/[0.06]' : 'border-red-500/30 bg-red-500/[0.06]')}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        <span className={allPass ? 'text-[#00FF9C]' : tone === 'bad' ? 'text-red-300' : 'text-amber-200'}>{run.passed}</span>
        <span className="text-base text-slate-500"> / {run.total} passed</span>
      </p>
    </div>
  );
}

function ReportTab({ report }: { report: LintyReport }) {
  const bySeverity = (s: Issue['severity']) => report.analysis.errors.filter((e) => e.severity === s).length;
  const v = report.verification;
  const d = report.detection;
  const t = report.timings;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Issues found"
          value={String(report.analysis.errors.length)}
          detail={`${bySeverity('High')} high · ${bySeverity('Medium')} medium · ${bySeverity('Low')} low`}
        />
        <Stat label="Issues fixed" value={String(report.fix.fixes.length)} detail="by the Fixer agent" />
        {d && <Stat label="Seeded bugs caught" value={`${d.caught}/${d.expected}`} detail={d.missed.length ? `missed: ${d.missed.join(', ')}` : 'none missed'} />}
        {v && <Stat label="Regression tests" value={`${v.original.passed} → ${v.fixed.passed}`} detail={`passing of ${v.fixed.total}, before → after fix`} />}
        {t && <Stat label="Pipeline time" value={secs(t.totalMs)} detail={t.method} />}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <h3 className="mb-1 text-sm font-semibold">Summary</h3>
        <p className="text-sm leading-relaxed text-slate-300">{report.report.summary}</p>
        <h3 className="mb-1 mt-4 text-sm font-semibold">Recommended next steps</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
          {report.report.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-slate-500">
        Source: {report.source.kind === 'bob' ? 'IBM Bob IDE run' : `IBM watsonx.ai (${report.source.model})`}
        {report.source.author ? ` by ${report.source.author}` : ''}, {new Date(report.source.recordedAt).toLocaleString()}. File: {report.fileName}.
      </p>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
      <p className="mt-0.5 text-xs leading-snug text-slate-500">{detail}</p>
    </div>
  );
}
