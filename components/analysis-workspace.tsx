"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
/* eslint-disable @next/next/no-img-element */
import {
  ArrowRight,
  Check,
  CircleAlert,
  Clipboard,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileJson,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import type {
  AnalyzerResult,
  ImageRecord,
  LinkRecord,
  NavigationNode,
  ProductRecord,
  SectionRecord,
} from "@/lib/analyzer/types";
import { analysisExportFilename, serializeAnalysis } from "@/lib/analyzer/export";
import { isRealExtractedAsset } from "@/lib/analyzer/image-asset";
import { deleteAnalysis, listAnalyses, requestAnalysis, type AnalysisHistoryItem } from "@/lib/analyzer/client";
import { websiteUrlSchema } from "@/lib/validation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const stages = ["Request accepted", "Fetching public page", "Extracting frontend signals", "Analysis ready"];
const tabs = ["Overview", "Metadata", "Navigation", "Sections", "Products", "Images", "Links", "Debug", "Raw JSON"] as const;
type DashboardTab = (typeof tabs)[number];

export function AnalysisWorkspace() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AnalyzerResult | null>(null);
  const [error, setError] = useState("");
  const [stage, setStage] = useState(-1);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [historyPersistent, setHistoryPersistent] = useState(false);
  const [historyLimitation, setHistoryLimitation] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function refreshHistory() {
    try {
      const response = await listAnalyses();
      setHistory(response.analyses);
      setHistoryPersistent(response.persistent);
      setHistoryLimitation(response.limitation);
      setHistoryError("");
    } catch (historyRequestError) {
      setHistoryError(historyRequestError instanceof Error ? historyRequestError.message : "Analysis history is unavailable.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshHistory();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isAnalyzing) return;

    const parsed = websiteUrlSchema.safeParse(url);
    if (!parsed.success) {
      setError("Enter a valid public HTTP or HTTPS URL.");
      setResult(null);
      return;
    }

    setError("");
    setUrl(parsed.data);
    setStage(0);
    setIsAnalyzing(true);
    const progressTimer = window.setInterval(() => {
      setStage((current) => Math.min(current + 1, stages.length - 2));
    }, 1400);

    try {
      const analysis = await requestAnalysis(parsed.data);
      setStage(stages.length - 1);
      setResult(analysis);
      void refreshHistory();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The analysis request failed.");
      setStage(-1);
    } finally {
      window.clearInterval(progressTimer);
      setIsAnalyzing(false);
    }
  }

  function startNewAnalysis() {
    setResult(null);
    setError("");
    setStage(-1);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="min-w-0 space-y-5">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label htmlFor="website-url" className="sr-only">Website URL</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            ref={inputRef}
            id="website-url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="acn.com.pk or https://example.com"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setError("");
            }}
            aria-describedby="analysis-status"
            disabled={isAnalyzing}
          />
          <Button type="submit" disabled={isAnalyzing}>
            {isAnalyzing ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} strokeWidth={2} />}
            {isAnalyzing ? "Analyzing" : "Analyze Website"}
          </Button>
        </div>
        <p id="analysis-status" className={`min-h-5 font-mono text-xs ${error ? "text-red-300" : "text-zinc-500"}`} aria-live="polite">
          {error || (isAnalyzing ? stages[stage] : "Only public frontend metadata will be considered.")}
        </p>
      </form>

      <div className="min-h-[180px] min-w-0">
        {isAnalyzing && <ProgressPanel activeStage={stage} />}
        {error && !isAnalyzing && <ErrorPanel message={error} />}
        {!result && !isAnalyzing && !error && <EmptyState label="No analysis performed yet" />}
        {result && <AnalysisDashboard result={result} onNewAnalysis={startNewAnalysis} />}
      </div>
      <HistoryPanel
        items={history}
        persistent={historyPersistent}
        limitation={historyLimitation}
        error={historyError}
        onSelect={(item) => {
          setResult(item.result);
          setUrl(item.url);
          setError("");
        }}
        onDelete={async (id) => {
          await deleteAnalysis(id);
          await refreshHistory();
        }}
      />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card role="alert" className="border-red-300/15 bg-red-300/[0.03] p-5">
      <div className="flex items-start gap-3">
        <CircleAlert size={18} className="mt-0.5 shrink-0 text-red-300" />
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-red-200">Analysis unavailable</h2>
          <p className="mt-1 break-words text-sm leading-6 text-red-200/70">{message}</p>
        </div>
      </div>
    </Card>
  );
}

function HistoryPanel({
  items,
  persistent,
  limitation,
  error,
  onSelect,
  onDelete,
}: {
  items: AnalysisHistoryItem[];
  persistent: boolean;
  limitation: string | null;
  error: string;
  onSelect: (item: AnalysisHistoryItem) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState("");
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-white/8 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-zinc-200">Analysis history</h2>
            <Badge className={persistent ? "border-lime-300/20 text-lime-200" : "border-amber-300/20 bg-amber-300/5 text-amber-200"}>{persistent ? "local file" : "memory only"}</Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-600">{limitation || "Saved analyses are available on this server."}</p>
        </div>
        <span className="font-mono text-xs text-zinc-600">{items.length} saved</span>
      </div>
      {error ? <p className="p-5 text-sm text-red-300">{error}</p> : items.length ? (
        <div className="divide-y divide-white/6">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => onSelect(item)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70">
                <p className="truncate text-sm font-medium text-zinc-300">{item.title || item.url}</p>
                <p className="mt-1 break-all font-mono text-[11px] text-zinc-600">{item.url}</p>
                <p className="mt-2 font-mono text-[10px] text-zinc-600">{new Date(item.analyzed_at).toLocaleString()} · {item.summary.total_ecommerce_products} products · {item.summary.total_unique_images} images · {item.summary.total_sections} sections</p>
              </button>
              <button
                type="button"
                disabled={deleting === item.id}
                onClick={async () => {
                  setDeleting(item.id);
                  try {
                    await onDelete(item.id);
                  } finally {
                    setDeleting("");
                  }
                }}
                className="min-h-10 shrink-0 self-start rounded-lg border border-white/10 px-3 text-xs text-zinc-500 hover:border-red-300/20 hover:text-red-200 disabled:opacity-50 sm:self-center"
              >
                {deleting === item.id ? "Deleting" : "Delete"}
              </button>
            </div>
          ))}
        </div>
      ) : <div className="p-5 text-sm text-zinc-600">No saved analyses yet.</div>}
    </Card>
  );
}

function ProgressPanel({ activeStage }: { activeStage: number }) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-3">
        <ScanSearch size={17} className="text-lime-300" />
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-zinc-400">Server analysis in progress</p>
      </div>
      <div className="space-y-3">
        {stages.slice(0, -1).map((item, index) => (
          <div key={item} className="flex items-center gap-3 text-sm">
            <span className={`flex size-5 items-center justify-center rounded-full border ${index <= activeStage ? "border-lime-300/50 bg-lime-300/10 text-lime-300" : "border-zinc-700 text-zinc-700"}`}>
              {index < activeStage ? <Check size={12} /> : index === activeStage ? <LoaderCircle size={12} className="animate-spin" /> : null}
            </span>
            <span className={index <= activeStage ? "text-zinc-200" : "text-zinc-600"}>{item}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AnalysisDashboard({ result, onNewAnalysis }: { result: AnalyzerResult; onNewAnalysis: () => void }) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("Overview");
  const [clipboardState, setClipboardState] = useState<"idle" | "success" | "error">("idle");
  const [exportState, setExportState] = useState<"idle" | "success" | "error">("idle");
  const json = useMemo(() => serializeAnalysis(result), [result]);
  const websiteTitle = result.website.title || result.website.final_url || result.website.url;
  const duration = result.debug.duration_ms ?? result.website.response_time_ms;

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setClipboardState("success");
      window.setTimeout(() => setClipboardState("idle"), 2200);
    } catch {
      setClipboardState("error");
      window.setTimeout(() => setClipboardState("idle"), 3500);
    }
  }

  function exportJson() {
    try {
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = analysisExportFilename(result);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setExportState("success");
      window.setTimeout(() => setExportState("idle"), 2200);
    } catch {
      setExportState("error");
      window.setTimeout(() => setExportState("idle"), 3500);
    }
  }

  return (
    <section aria-label="Website analysis dashboard" className="space-y-4">
      <Card className="overflow-hidden border-lime-300/15 bg-[linear-gradient(135deg,rgba(163,230,53,0.06),rgba(16,19,16,0.95)_42%)]">
        <div className="flex flex-col gap-5 border-b border-white/8 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className="border-lime-300/25 text-lime-200">Analysis complete</Badge>
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">{result.website.analyzed_at}</span>
            </div>
            <h2 className="max-w-3xl break-words text-2xl font-medium tracking-tight text-zinc-100 sm:text-3xl">{websiteTitle}</h2>
            <a href={result.website.final_url || result.website.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-xs text-zinc-500 transition hover:text-lime-200">
              {result.website.final_url || result.website.url}
              <ExternalLink size={12} />
            </a>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" onClick={onNewAnalysis} className="h-10 border border-white/10 bg-white/5 px-3 text-zinc-200 hover:bg-white/10">
              <RefreshCw size={14} /> New analysis
            </Button>
            <Button type="button" onClick={exportJson} className="h-10 border border-white/10 bg-white/5 px-3 text-zinc-200 hover:bg-white/10" aria-label="Export complete analysis as JSON">
              <Download size={14} /> {exportState === "success" ? "Exported" : exportState === "error" ? "Export failed" : "Export JSON"}
            </Button>
            <Button type="button" onClick={copyJson} className="h-10 border border-white/10 bg-white/5 px-3 text-zinc-200 hover:bg-white/10">
              {clipboardState === "success" ? <ClipboardCheck size={14} className="text-lime-300" /> : <Clipboard size={14} />}
              {clipboardState === "success" ? "Copied" : clipboardState === "error" ? "Copy failed" : "Copy JSON"}
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-y divide-white/8 sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-8">
          <SummaryMetric label="Type" value={result.website.website_type} />
          <SummaryMetric label="Status" value={String(result.website.response_status ?? "Not reported")} />
          <SummaryMetric label="Duration" value={duration === null || duration === undefined ? "Not reported" : formatDuration(duration)} />
          <SummaryMetric label="Ecommerce products" value={result.summary.total_ecommerce_products} />
          <SummaryMetric label="Content items" value={result.summary.total_content_items} />
          <SummaryMetric label="Images" value={result.summary.total_unique_images} />
          <SummaryMetric label="Links" value={result.summary.total_links} />
          <SummaryMetric label="Sections" value={result.summary.total_sections} />
          <SummaryMetric label="Nav links" value={result.summary.total_navigation_links} />
        </div>
      </Card>

      <div className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#101310]/75 p-1.5 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div role="tablist" aria-label="Analysis details" className="grid grid-cols-2 gap-1 sm:grid-cols-3 lg:grid-cols-9">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`analysis-panel-${tab.toLowerCase().replace(" ", "-")}`}
              onClick={() => setActiveTab(tab)}
              className={`min-h-10 min-w-0 rounded-xl px-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70 sm:px-3 ${activeTab === tab ? "bg-lime-300 text-[#10140d]" : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div id={`analysis-panel-${activeTab.toLowerCase().replace(" ", "-")}`} role="tabpanel" tabIndex={0} className="min-w-0">
        {activeTab === "Overview" && <OverviewTab result={result} />}
        {activeTab === "Metadata" && <MetadataTab result={result} />}
        {activeTab === "Navigation" && <NavigationTab result={result} />}
        {activeTab === "Sections" && <SectionsTab sections={result.sections} />}
        {activeTab === "Products" && <ProductsTab products={result.products} images={result.images} />}
        {activeTab === "Images" && <ImagesTab images={result.images} debug={result.debug} />}
        {activeTab === "Links" && <LinksTab links={result.links} />}
        {activeTab === "Debug" && <DebugTab result={result} />}
        {activeTab === "Raw JSON" && <RawJsonTab json={json} onCopy={copyJson} copied={clipboardState === "success"} />}
      </div>
    </section>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 px-4 py-4 sm:px-5">
      <p className="truncate font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function OverviewTab({ result }: { result: AnalyzerResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <DashboardCard title="Website summary" icon={<ScanSearch size={16} />}>
        <InfoRows rows={[
          ["Title", result.website.title],
          ["Description", result.website.description],
          ["Requested URL", result.website.url],
          ["Final URL", result.website.final_url],
          ["Website type", result.website.website_type],
          ["Type confidence", `${Math.round(result.website.website_type_confidence * 100)}%`],
          ["Type evidence", result.website.website_type_evidence.join("; ") || "Insufficient evidence"],
          ["Analyzed at", result.website.analyzed_at],
          ["Response status", result.website.response_status],
          ["Response time", result.website.response_time_ms === null ? null : formatDuration(result.website.response_time_ms)],
        ]} />
      </DashboardCard>
      <DashboardCard title="Captured signals" icon={<FileJson size={16} />}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">
          <Signal label="Metadata fields" value={countMetadata(result)} />
          <Signal label="Navigation trees" value={result.navigation.trees.length} />
          <Signal label="Sections" value={result.summary.total_sections} />
          <Signal label="Ecommerce products" value={result.summary.total_ecommerce_products} />
          <Signal label="Content items" value={result.summary.total_content_items} />
          <Signal label="Images" value={result.summary.total_unique_images} />
          <Signal label="Warnings" value={result.summary.total_warnings} />
        </div>
      </DashboardCard>
      <DashboardCard title="What was found" icon={<Check size={16} />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <ListPreview label="Top sections" values={result.sections.slice(0, 4).map((section) => section.heading || section.type)} />
          <ListPreview label="Primary links" values={result.navigation.links.slice(0, 4).map((link) => link.text || link.url)} />
          <ListPreview label="Social profiles" values={result.metadata.social_links.slice(0, 4)} />
        </div>
      </DashboardCard>
    </div>
  );
}

function MetadataTab({ result }: { result: AnalyzerResult }) {
  const { metadata } = result;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DashboardCard title="Document metadata">
        <InfoRows rows={[
          ["Title", metadata.title],
          ["Description", metadata.meta_description],
          ["Canonical URL", metadata.canonical_url],
          ["Language", metadata.language],
          ["Viewport", metadata.viewport],
          ["Website name", metadata.open_graph.site_name],
        ]} />
      </DashboardCard>
      <DashboardCard title="Open Graph">
        <InfoRows rows={Object.entries(metadata.open_graph).map(([key, value]) => [key, value])} />
      </DashboardCard>
      <DashboardCard title="Twitter card">
        <InfoRows rows={Object.entries(metadata.twitter).map(([key, value]) => [key, value])} />
      </DashboardCard>
      <DashboardCard title="Favicon candidates">
        <UrlList items={metadata.favicon_candidates} />
      </DashboardCard>
      <DashboardCard title="Social profiles">
        <UrlList items={metadata.social_links} />
      </DashboardCard>
      <DashboardCard title="JSON-LD blocks">
        {metadata.json_ld.length ? <JsonList items={metadata.json_ld} /> : <EmptyState label="No JSON-LD metadata found" />}
      </DashboardCard>
    </div>
  );
}

function NavigationTab({ result }: { result: AnalyzerResult }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <DashboardCard title="Navigation trees">
        {result.navigation.trees.length ? <div className="space-y-1">{result.navigation.trees.map((node, index) => <NavigationTree key={`${node.label}-${index}`} node={node} depth={0} />)}</div> : <EmptyState label="No navigation items detected" />}
      </DashboardCard>
      <DashboardCard title="Navigation links">
        <LinkTable links={result.navigation.links} />
      </DashboardCard>
    </div>
  );
}

function SectionsTab({ sections }: { sections: SectionRecord[] }) {
  return (
    <DashboardCard title={`${sections.length} sections`}>
      {sections.length ? (
        <div className="space-y-2">
          {sections.map((section) => (
            <div key={section.id} className="grid gap-3 rounded-xl border border-white/8 bg-white/[0.02] p-4 md:grid-cols-[auto_1fr_auto] md:items-start">
              <Badge className="w-fit">{section.type}</Badge>
              <div className="min-w-0">
                <h3 className="font-medium text-zinc-200">{section.heading || "Untitled section"}</h3>
                <p className="mt-1 line-clamp-3 text-sm leading-6 text-zinc-500">{section.text || "No section text detected"}</p>
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-[10px] text-zinc-600">
                <span>Order {section.order}</span>
                <span>{section.image_ids?.length ?? 0} images</span>
                <span>{section.product_ids?.length ?? 0} products</span>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState label="No sections detected" />}
    </DashboardCard>
  );
}

function ProductsTab({ products, images }: { products: ProductRecord[]; images: ImageRecord[] }) {
  const [query, setQuery] = useState("");
  const [saleOnly, setSaleOnly] = useState(false);
  const imageMap = new Map(images.map((image) => [image.id, image]));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    if (saleOnly && !product.is_on_sale) return false;
    if (!normalizedQuery) return true;
    return [product.title, product.url, product.description, product.source_url]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });

  return (
    <DashboardCard title={`${filteredProducts.length} of ${products.length} ecommerce products`}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search products</span>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, URL, or description" className="h-10 w-full" />
        </label>
        <label className="flex min-h-10 shrink-0 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-400">
          <input type="checkbox" checked={saleOnly} onChange={(event) => setSaleOnly(event.target.checked)} className="size-4 accent-lime-300" />
          Sale only
        </label>
      </div>
      {filteredProducts.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredProducts.map((product) => {
            const thumbnails = (product.image_ids ?? []).map((id) => imageMap.get(id)).filter((image): image is ImageRecord => Boolean(image));
            return (
              <article key={product.id} className="min-w-0 rounded-xl border border-white/8 bg-white/[0.02] p-4">
                <div className="flex gap-3">
                  <ThumbnailStrip images={thumbnails.slice(0, 3)} label={product.title || "Untitled product"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-medium text-zinc-200">{product.title || "Untitled product"}</h3>
                      {product.is_on_sale && <Badge>Sale</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{product.product_type}</p>
                    <p className="mt-1 text-[11px] text-zinc-600">{product.classification_reason}</p>
                    <p className="mt-3 font-mono text-sm text-lime-200">{formatPrice(product.price, product.currency)}</p>
                    {product.old_price !== null && <p className="font-mono text-xs text-zinc-600 line-through">{formatPrice(product.old_price, product.currency)}</p>}
                  </div>
                </div>
                <div className="mt-4 space-y-2 border-t border-white/8 pt-3 text-xs text-zinc-500">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>{thumbnails.length} associated image{thumbnails.length === 1 ? "" : "s"}</span>
                    {product.url && <a href={product.url} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-lime-200/80 hover:bg-white/5 hover:text-lime-200">Product URL <ExternalLink size={11} /></a>}
                  </div>
                  {(product.action_buttons ?? []).length ? (
                    <div className="flex flex-wrap gap-2">
                      {(product.action_buttons ?? []).map((action, index) => (
                        action.href ? (
                          <a key={`${action.label}-${index}`} href={action.href} target="_blank" rel="noreferrer" className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg bg-lime-300/10 px-2.5 text-xs text-lime-200 hover:bg-lime-300/20">
                            <span className="truncate">{action.label}</span><ExternalLink size={11} />
                          </a>
                        ) : <span key={`${action.label}-${index}`} className="inline-flex min-h-9 items-center rounded-lg border border-white/10 px-2.5 text-xs text-zinc-400">{action.label}</span>
                      ))}
                    </div>
                  ) : <span>Action buttons not reported</span>}
                </div>
              </article>
            );
          })}
        </div>
      ) : <EmptyState label={products.length ? "No ecommerce products match the current filters" : "No ecommerce products detected"} />}
    </DashboardCard>
  );
}

function ImagesTab({ images, debug }: { images: ImageRecord[]; debug: AnalyzerResult["debug"] }) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("all");
  const [source, setSource] = useState("all");
  const normalizedQuery = query.trim().toLowerCase();
  const roles = Array.from(new Set(images.map((image) => image.role))).sort();
  const sources = Array.from(new Set(images.map((image) => image.source))).sort();
  const filteredImages = images.filter((image) => {
    if (role !== "all" && image.role !== role) return false;
    if (source !== "all" && image.source !== source) return false;
    if (!normalizedQuery) return true;
    return [image.url, image.alt_text]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(normalizedQuery));
  });
  const validCount = images.filter((image) => !image.rejection).length;
  const rejectedCount = debug.rejection_reasons.reduce((total, item) => total + item.count, 0);
  const rejectionSummary = debug.rejection_reasons.filter((item) => item.count > 0).map((item) => `${item.reason}: ${item.count}`).join(", ");

  return (
    <DashboardCard title={`${filteredImages.length} of ${images.length} images`}>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <label className="min-w-0">
          <span className="sr-only">Search images</span>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search image URL or alt text" className="h-10 w-full" />
        </label>
        <SelectFilter label="Role" value={role} options={roles} onChange={setRole} />
        <SelectFilter label="Source" value={source} options={sources} onChange={setSource} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
        <span className="rounded-full border border-lime-300/15 bg-lime-300/5 px-3 py-1.5 text-lime-200">{validCount} valid</span>
        <span className="rounded-full border border-red-300/15 bg-red-300/5 px-3 py-1.5 text-red-200">{rejectedCount} rejected</span>
      </div>
      {filteredImages.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredImages.map((image) => <ImageCard key={image.id} image={image} />)}
        </div>
      ) : <EmptyState label={images.length ? "No images match the current filters" : rejectionSummary ? `No valid images detected (${rejectionSummary})` : "No valid images detected"} />}
    </DashboardCard>
  );
}

function ImageCard({ image }: { image: ImageRecord }) {
  const [previewError, setPreviewError] = useState(!isRealExtractedAsset(image.url));
  const imageUrl = isRealExtractedAsset(image.url) ? image.url : null;
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-white/8 bg-white/[0.02]">
      <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-[#0a0c0a] p-3">
        {previewError || !imageUrl ? (
          <div className="flex max-w-full min-w-0 flex-col items-center gap-2 px-3 text-center text-xs text-zinc-600">
            <ImageIcon size={22} />
            <span>Preview unavailable · {image.source}</span>
            <span className="max-w-full break-all font-mono text-[10px] text-zinc-700">{image.url || "Image URL not reported"}</span>
          </div>
        ) : (
          <img src={imageUrl} alt={image.alt_text || "Extracted website image"} loading="lazy" onError={() => setPreviewError(true)} className="block h-full w-full object-contain" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <Badge>{image.role}</Badge>
          <Badge className="border-white/10 bg-white/5 text-zinc-400">{image.source}</Badge>
        </div>
        <p className="break-all text-[11px] text-lime-200/80">{image.url}</p>
        <p className="break-all text-xs text-zinc-400">{image.alt_text || "Alt text not reported"}</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-zinc-600">
          <span>{image.width !== null && image.height !== null ? `${image.width} × ${image.height}` : "Dimensions unavailable"}</span>
          <span>{image.section_id ? `Section ${image.section_id}` : "Section not associated"}</span>
          <span>{image.product_id ? `Product ${image.product_id}` : "Product not associated"}</span>
        </div>
        <a href={image.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 break-all text-[11px] text-lime-200/80 hover:text-lime-200">
          Open source <ExternalLink size={11} />
        </a>
      </div>
    </article>
  );
}

function LinksTab({ links }: { links: LinkRecord[] }) {
  return <DashboardCard title={`${links.length} links`}><LinkTable links={links} /></DashboardCard>;
}

function DebugTab({ result }: { result: AnalyzerResult }) {
  const counterValues = new Map(result.debug.counters.map((counter) => [counter.name, counter.value]));
  const counterDefinitions = [
    ["images_scanned", "Images scanned"],
    ["images_valid", "Valid images"],
    ["images_rejected", "Rejected images"],
    ["lazy_images_found", "Lazy images found"],
    ["background_images_found", "Background images found"],
    ["product_images_found", "Product images found"],
    ["category_images_found", "Category images found"],
    ["hero_images_found", "Hero images found"],
    ["blog_images_found", "Blog images found"],
    ["logos_found", "Logos found"],
    ["images_without_parent", "Images without parent"],
    ["duplicate_images_removed", "Duplicate images removed"],
    ["raw_image_candidates", "Raw image candidates"],
    ["normalized_image_candidates", "Normalized image candidates"],
    ["unique_image_assets", "Unique image assets"],
    ["duplicate_references_removed", "Duplicate references removed"],
    ["responsive_variants_detected", "Responsive variants detected"],
    ["images_used_in_multiple_sections", "Images used in multiple sections"],
    ["images_used_in_multiple_entities", "Images used in multiple entities"],
    ["logos_detected", "Logos detected"],
    ["icons_detected", "Icons detected"],
    ["decorative_images_detected", "Decorative images detected"],
    ["product_images_associated", "Product images associated"],
    ["unassociated_images", "Unassociated images"],
    ["all_links", "All links"],
    ["navigation_links", "Navigation links"],
    ["primary_navigation_links", "Primary navigation links"],
    ["footer_links", "Footer links"],
    ["breadcrumb_links", "Breadcrumb links"],
    ["social_links", "Social links"],
    ["product_links", "Product links"],
    ["content_links", "Content links"],
    ["external_links", "External links"],
    ["products_detected", "Products detected"],
    ["products_with_images", "Products with images"],
    ["products_without_images", "Products without images"],
    ["content_items_detected", "Content items detected"],
    ["content_items_non_ecommerce", "Non-ecommerce content items"],
    ["content_items_with_images", "Content items with images"],
    ["prices_detected", "Prices detected"],
    ["product_urls_detected", "Product URLs detected"],
    ["raw_product_candidates", "Raw product candidates"],
    ["unique_ecommerce_products", "Unique ecommerce products"],
    ["raw_content_candidates", "Raw content candidates"],
    ["unique_content_items", "Unique content items"],
    ["duplicate_entities_removed", "Duplicate entities removed"],
    ["carousel_clones_removed", "Carousel clones removed"],
    ["hidden_duplicates_removed", "Hidden duplicates removed"],
  ];
  const rejectionLabels: Record<string, string> = {
    url_missing: "URL missing",
    unsupported_protocol: "Unsupported protocol",
    invalid_url: "Invalid URL",
    placeholder_image: "Placeholder image",
    tracking_pixel: "Tracking pixel",
    blocked_by_validation: "Blocked by validation",
    unknown: "Unknown",
  };
  const rejectionReasons = Object.keys(rejectionLabels).map((reason) => ({
    reason,
    count: result.debug.rejection_reasons.find((item) => item.reason === reason)?.count ?? 0,
  }));
  const rejectionRecords = result.debug.rejection_records ?? [];

  return (
    <div className="space-y-4">
      <DashboardCard title="Analysis status" icon={<ScanSearch size={16} />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <DebugValue label="Requested URL" value={result.website.url} />
          <DebugValue label="Final URL" value={result.website.final_url} />
          <DebugValue label="Fetch status" value={result.website.response_status} />
          <DebugValue label="Rendering status" value={statusForStage(result.debug.processing_stages, "render")} />
          <DebugValue label="Analysis status" value={result.status} />
        </div>
      </DashboardCard>
      <DashboardCard title="Pipeline stages" icon={<ScanSearch size={16} />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.debug.processing_stages.length ? result.debug.processing_stages.map((stage) => (
            <div key={stage.name} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
              <span className="text-sm text-zinc-300">{stage.name}</span>
              <div className="flex shrink-0 items-center gap-2">
                <Badge className={stage.status === "completed" ? "border-lime-300/20 text-lime-200" : "border-zinc-700 bg-zinc-800/50 text-zinc-500"}>{stage.status}</Badge>
                {stage.duration_ms !== null && <span className="font-mono text-[10px] text-zinc-600">{formatDuration(stage.duration_ms)}</span>}
              </div>
            </div>
          )) : <EmptyState label="No pipeline stages reported" />}
        </div>
      </DashboardCard>

      <DashboardCard title="Counters">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {counterDefinitions.map(([name, label]) => (
            <div key={name} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
              <span className="text-xs text-zinc-500">{label}</span>
              <span className="font-mono text-sm text-zinc-200">{counterValues.get(name) ?? 0}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-zinc-600">Image counts report extracted URLs. The analyzer does not download image files; preview success or failure is reported separately in the Images tab.</p>
      </DashboardCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardCard title="Rejection reasons">
          <div className="space-y-2">
            {rejectionReasons.map(({ reason, count }) => (
              <div key={reason} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge className={count ? "border-red-300/20 bg-red-300/5 text-red-200" : "border-white/10 bg-white/5 text-zinc-500"}>{count ? "found" : "zero"}</Badge>
                  <span className="truncate text-sm text-zinc-400">{rejectionLabels[reason]}</span>
                </div>
                <span className="font-mono text-sm text-zinc-200">{count}</span>
              </div>
            ))}
          </div>
          {rejectionRecords.length ? (
            <details className="mt-4 rounded-xl border border-white/8 bg-white/[0.02]">
              <summary className="cursor-pointer px-3 py-3 text-sm text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70">Show {rejectionRecords.length} rejected source record{rejectionRecords.length === 1 ? "" : "s"}</summary>
              <div className="space-y-2 border-t border-white/8 p-3">
                {rejectionRecords.map((record, index) => (
                  <div key={`${record.reason}-${index}`} className="rounded-lg border border-red-300/10 bg-red-300/[0.03] p-3">
                    <div className="flex flex-wrap items-center gap-2"><Badge className="border-red-300/20 bg-red-300/5 text-red-200">{rejectionLabels[record.reason] ?? record.reason}</Badge><span className="font-mono text-[10px] text-zinc-600">{record.reason}</span></div>
                    <div className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">
                      <p className="break-all">Original: {record.source_value ?? "Not reported"}</p>
                      <p className="break-all">Normalized: {record.normalized_value ?? "Not available"}</p>
                      <p>Extraction source: {record.extraction_source ?? "Not reported"}</p>
                      <p>Parent: {record.parent_context?.selector ?? record.parent_context?.tag_name ?? "Not reported"}</p>
                    </div>
                    {record.details && <p className="mt-1 text-xs text-zinc-600">{record.details}</p>}
                  </div>
                ))}
              </div>
            </details>
          ) : <p className="mt-4 text-xs text-zinc-600">No rejected source records reported.</p>}
        </DashboardCard>

        <DashboardCard title="Warnings and extractor errors">
          {result.debug.extraction_warnings.length ? <div className="space-y-2">{result.debug.extraction_warnings.map((warning, index) => <div key={`${warning.code}-${index}`} className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3"><div className="flex flex-wrap items-center gap-2"><Badge className="border-amber-300/20 bg-amber-300/5 text-amber-200">{warning.code.endsWith("_failed") ? "extractor error" : "warning"}</Badge><p className="font-mono text-xs text-amber-200">{warning.code}</p></div><p className="mt-2 text-sm text-zinc-400">{warning.message}</p>{warning.source && <p className="mt-1 text-[11px] text-zinc-600">{warning.source}</p>}</div>)}</div> : <EmptyState label="No warnings or extractor errors returned" />}
        </DashboardCard>
      </div>

      <DashboardCard title="Processing detail">
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-zinc-500">
          <span>Total analyzer duration</span>
          <span className="font-mono text-zinc-200">{result.debug.duration_ms === null ? "Not reported" : formatDuration(result.debug.duration_ms)}</span>
        </div>
        <p className="mt-4 rounded-xl border border-sky-300/10 bg-sky-300/[0.04] p-3 text-xs leading-5 text-sky-100/70">
          Unknown image dimensions are expected for many CDN and lazy-loaded sources. They are not rejection reasons and do not reduce the valid image count.
        </p>
        <div className="mt-4">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">Raw image source diagnostics</p>
          {Object.keys(result.debug.raw_image_source_counts ?? {}).length ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(result.debug.raw_image_source_counts ?? {}).map(([name, value]) => (
                <div key={name} className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2">
                  <span className="break-all font-mono text-[11px] text-zinc-500">{name}</span>
                  <span className="font-mono text-xs text-zinc-200">{value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-zinc-600">No raw image source diagnostics reported.</p>}
        </div>
        {result.debug.raw_image_samples?.length ? (
          <details className="mt-4 rounded-xl border border-white/8 bg-white/[0.02]">
            <summary className="cursor-pointer px-3 py-3 text-sm text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70">Show raw image samples ({result.debug.raw_image_samples.length})</summary>
            <div className="space-y-2 border-t border-white/8 p-3">
              {result.debug.raw_image_samples.map((sample, index) => <div key={`${sample.value}-${index}`} className="rounded-lg border border-white/8 p-2"><p className="font-mono text-[10px] text-lime-200/70">{sample.source}</p><p className="break-all font-mono text-[11px] text-zinc-400">{sample.value}</p></div>)}
            </div>
          </details>
        ) : null}
      </DashboardCard>
    </div>
  );
}

function RawJsonTab({ json, onCopy, copied }: { json: string; onCopy: () => void; copied: boolean }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/8 p-4">
        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400"><FileJson size={15} className="text-lime-300" /> Complete analyzer result</div>
        <button type="button" onClick={onCopy} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-xs text-zinc-400 hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-300/70">{copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}{copied ? "Copied" : "Copy"}</button>
      </div>
      <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-zinc-400">{json}</pre>
    </Card>
  );
}

function DebugValue({ label, value }: { label: string; value: unknown }) {
  return <div className="min-w-0 rounded-xl border border-white/8 bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{label}</p><p className="mt-1 break-all font-mono text-xs text-zinc-200">{value === null || value === undefined || value === "" ? "Not reported" : String(value)}</p></div>;
}

function statusForStage(stages: AnalyzerResult["debug"]["processing_stages"], name: string): string {
  return stages.find((stage) => stage.name.toLowerCase() === name.toLowerCase())?.status ?? "Not reported";
}

function DashboardCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/8 px-5 py-4 text-sm font-medium text-zinc-200">{icon && <span className="text-lime-300">{icon}</span>}{title}</div>
      <div className="min-w-0 p-5">{children}</div>
    </Card>
  );
}

function InfoRows({ rows }: { rows: Array<[string, unknown]> }) {
  return <div className="divide-y divide-white/6">{rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[140px_1fr] sm:gap-4"><span className="text-xs text-zinc-600">{label}</span><span className="min-w-0 break-words text-sm text-zinc-300">{formatValue(value)}</span></div>)}</div>;
}

function LinkTable({ links }: { links: LinkRecord[] }) {
  if (!links.length) return <EmptyState label="No links detected" />;
  return <div className="space-y-2">{links.map((link, index) => <div key={`${link.url}-${index}`} className="min-w-0 rounded-xl border border-white/8 bg-white/[0.02] p-3"><div className="flex flex-wrap items-center gap-2"><Badge className="border-white/10 bg-white/5 text-zinc-500">{link.source_area}</Badge><span className="text-sm text-zinc-300">{link.text || "Unlabelled link"}</span></div><a href={link.url} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1 break-all text-xs text-lime-200/80 hover:text-lime-200">{link.url}<ExternalLink size={11} /></a><p className="mt-1 font-mono text-[10px] text-zinc-600">{link.rel.length ? `rel: ${link.rel.join(", ")}` : "rel not reported"}{link.type ? ` | ${link.type}` : ""}</p></div>)}</div>;
}

function NavigationTree({ node, depth }: { node: NavigationNode; depth: number }) {
  return <div className="border-l border-white/8 pl-3" style={{ marginLeft: Math.min(depth * 8, 32) }}><div className="flex gap-2 py-1.5 text-sm"><span className="break-words text-zinc-300">{node.label || "Unlabelled item"}</span>{node.href && <a href={node.href} target="_blank" rel="noreferrer" className="shrink-0 text-lime-300/70"><ExternalLink size={13} /></a>}</div>{(node.children ?? []).map((child, index) => <NavigationTree key={`${child.label}-${index}`} node={child} depth={depth + 1} />)}</div>;
}

function ThumbnailStrip({ images, label }: { images: ImageRecord[]; label: string }) {
  return <div className="flex w-24 shrink-0 gap-1">{images.length ? images.map((image) => <ProductThumbnail key={image.id} image={image} label={label} />) : <span className="flex size-14 items-center justify-center rounded-lg border border-dashed border-zinc-700 text-zinc-700"><ImageIcon size={17} /></span>}</div>;
}

function ProductThumbnail({ image, label }: { image: ImageRecord; label: string }) {
  const [previewError, setPreviewError] = useState(!isRealExtractedAsset(image.url));
  const imageUrl = isRealExtractedAsset(image.url) ? image.url : null;
  return (
    <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/10 bg-[#0a0c0a]" title={previewError || !imageUrl ? "Preview unavailable" : imageUrl}>
      {previewError || !imageUrl ? (
        <ImageIcon size={16} className="text-zinc-700" aria-label={`${label} image preview unavailable`} />
      ) : (
        <img src={imageUrl} alt={`${label} image`} loading="lazy" onError={() => setPreviewError(true)} className="block size-full object-cover" />
      )}
    </span>
  );
}

function SelectFilter({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="flex min-h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-xs text-zinc-500">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="min-w-0 bg-transparent text-xs text-zinc-200 outline-none">
        <option value="all" className="bg-[#101310]">All</option>
        {options.map((option) => <option key={option} value={option} className="bg-[#101310]">{option}</option>)}
      </select>
    </label>
  );
}

function ListPreview({ label, values }: { label: string; values: string[] }) {
  return <div><p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</p>{values.length ? <ul className="space-y-1.5">{values.map((value, index) => <li key={`${value}-${index}`} className="truncate text-sm text-zinc-400">{value}</li>)}</ul> : <p className="text-sm text-zinc-600">No data detected</p>}</div>;
}

function UrlList({ items }: { items: string[] }) {
  return items.length ? <div className="space-y-2">{items.map((item) => <a key={item} href={item} target="_blank" rel="noreferrer" className="flex items-center gap-2 break-all text-sm text-lime-200/80 hover:text-lime-200"><span className="min-w-0">{item}</span><ExternalLink size={12} className="shrink-0" /></a>)}</div> : <EmptyState label="No URLs detected" />;
}

function JsonList({ items }: { items: unknown[] }) {
  return <div className="space-y-2">{items.map((item, index) => <pre key={index} className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#0a0c0a] p-3 font-mono text-[11px] leading-5 text-zinc-500">{JSON.stringify(item, null, 2)}</pre>)}</div>;
}

function Signal({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3"><p className="font-mono text-xl text-zinc-100">{value}</p><p className="mt-1 text-xs text-zinc-600">{label}</p></div>;
}

function EmptyState({ label }: { label: string }) {
  return <div className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.015] px-4 text-center text-sm text-zinc-600"><CircleAlert size={16} />{label}</div>;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not reported";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatDuration(value: number): string {
  return value < 1000 ? `${value} ms` : `${(value / 1000).toFixed(2)} s`;
}

function formatPrice(value: number | null, currency: string | null): string {
  if (value === null) return "Price not reported";
  return `${currency ? `${currency} ` : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function countMetadata(result: AnalyzerResult): number {
  const { metadata } = result;
  return [metadata.title, metadata.meta_description, metadata.canonical_url, metadata.language, metadata.viewport, ...metadata.favicon_candidates, ...metadata.social_links, ...Object.values(metadata.open_graph), ...Object.values(metadata.twitter)].filter(Boolean).length + metadata.json_ld.length;
}
