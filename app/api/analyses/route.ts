import { NextResponse } from "next/server";
import { z } from "zod";
import type { AnalyzerResult } from "@/lib/analyzer/types";
import { analysisStore } from "@/lib/store/analysis-store";

export const runtime = "nodejs";
const MAX_IMPORT_BYTES = 10_000_000;

const idSchema = z.string().uuid();

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      const parsedId = idSchema.safeParse(id);
      if (!parsedId.success) return NextResponse.json({ error: "Invalid analysis ID." }, { status: 400 });
      const analysis = await analysisStore.get(parsedId.data);
      return analysis
        ? NextResponse.json({ analysis, storage_mode: analysisStore.mode, persistent: analysisStore.mode === "filesystem" })
        : NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }
    return NextResponse.json({
      analyses: await analysisStore.list(),
      storage_mode: analysisStore.mode,
      persistent: analysisStore.mode === "filesystem",
      limitation: analysisStore.mode === "memory" ? "In-memory history is cleared when the server restarts." : null,
    });
  } catch {
    return NextResponse.json({ error: "Analysis history is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: "Analysis import is too large." }, { status: 413 });
  }

  try {
    const body: unknown = await request.json();
    const candidate = body && typeof body === "object" && "result" in body ? body.result : body;
    if (!isCompletedAnalyzerResult(candidate)) {
      return NextResponse.json({ error: "A completed analysis result is required." }, { status: 400 });
    }
    const analysis = await analysisStore.save(candidate);
    return NextResponse.json({ analysis, storage_mode: analysisStore.mode }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "The analysis could not be saved." }, { status: 500 });
  }

  function isCompletedAnalyzerResult(value: unknown): value is AnalyzerResult {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<AnalyzerResult>;
    return candidate.status === "completed"
      && Boolean(candidate.website)
      && Array.isArray(candidate.products)
      && Array.isArray(candidate.images)
      && Array.isArray(candidate.sections)
      && Array.isArray(candidate.links);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const id = new URL(request.url).searchParams.get("id");
  const parsedId = idSchema.safeParse(id);
  if (!parsedId.success) return NextResponse.json({ error: "A valid analysis ID is required." }, { status: 400 });
  try {
    const deleted = await analysisStore.delete(parsedId.data);
    return deleted ? NextResponse.json({ deleted: true }) : NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  } catch {
    return NextResponse.json({ error: "The analysis could not be deleted." }, { status: 500 });
  }
}
