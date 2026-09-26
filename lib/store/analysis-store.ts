import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnalyzerResult } from "@/lib/analyzer/types";

export interface AnalysisSummary {
  total_ecommerce_products: number;
  total_unique_images: number;
  total_links: number;
  total_sections: number;
  total_content_items: number;
}

export interface StoredAnalysis {
  id: string;
  url: string;
  title: string | null;
  analyzed_at: string;
  status: AnalyzerResult["status"];
  summary: AnalysisSummary;
  result: AnalyzerResult;
}

export interface AnalysisStore {
  save(result: AnalyzerResult): Promise<StoredAnalysis>;
  list(): Promise<StoredAnalysis[]>;
  get(id: string): Promise<StoredAnalysis | null>;
  delete(id: string): Promise<boolean>;
  mode: "filesystem" | "memory";
}

const memoryStore = new Map<string, StoredAnalysis>();
const filePath = process.env.REPLICAFORGE_ANALYSIS_STORE
  ? path.resolve(process.env.REPLICAFORGE_ANALYSIS_STORE)
  : null;

class LocalAnalysisStore implements AnalysisStore {
  readonly mode = filePath ? "filesystem" : "memory" as const;

  async save(result: AnalyzerResult): Promise<StoredAnalysis> {
    const record: StoredAnalysis = {
      id: randomUUID(),
      url: result.website.url,
      title: result.website.title,
      analyzed_at: result.website.analyzed_at,
      status: result.status,
      summary: {
        total_ecommerce_products: result.summary.total_ecommerce_products,
        total_unique_images: result.summary.total_unique_images,
        total_links: result.summary.total_links,
        total_sections: result.summary.total_sections,
        total_content_items: result.summary.total_content_items,
      },
      result,
    };
    const records = await this.read();
    records.unshift(record);
    await this.write(records);
    return record;
  }

  async list(): Promise<StoredAnalysis[]> {
    return this.read();
  }

  async get(id: string): Promise<StoredAnalysis | null> {
    return (await this.read()).find((record) => record.id === id) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const records = await this.read();
    const remaining = records.filter((record) => record.id !== id);
    if (remaining.length === records.length) return false;
    await this.write(remaining);
    return true;
  }

  private async read(): Promise<StoredAnalysis[]> {
    if (!filePath) return [...memoryStore.values()];
    try {
      const content = await readFile(filePath, "utf8");
      const parsed: unknown = JSON.parse(content);
      return Array.isArray(parsed) ? parsed.filter(isStoredAnalysis) : [];
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return [];
      throw new Error("The local analysis store could not be read.");
    }
  }

  private async write(records: StoredAnalysis[]): Promise<void> {
    if (!filePath) {
      memoryStore.clear();
      records.forEach((record) => memoryStore.set(record.id, record));
      return;
    }
    await mkdir(path.dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(records), "utf8");
    await rename(temporaryPath, filePath);
  }
}

export const analysisStore: AnalysisStore = new LocalAnalysisStore();

function isStoredAnalysis(value: unknown): value is StoredAnalysis {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoredAnalysis>;
  return typeof candidate.id === "string"
    && typeof candidate.url === "string"
    && typeof candidate.analyzed_at === "string"
    && typeof candidate.status === "string"
    && Boolean(candidate.result);
}

function isNodeError(value: unknown): value is NodeJS.ErrnoException {
  return value instanceof Error && "code" in value;
}
