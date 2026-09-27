import { z } from 'zod';
import { runPipeline } from '@/backend/pipeline';
import { watsonxConfigFromEnv } from '@/backend/watsonx';
import type { PipelineEvent } from '@/lib/linty/schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

const RequestSchema = z.object({
  code: z.string().trim().min(1, 'Paste some code first.').max(20_000, 'Keep it under 20,000 characters.'),
  language: z.enum(['typescript', 'javascript']).default('typescript'),
  fileName: z.string().max(120).default('snippet.ts'),
});

// Lets the UI know whether live analysis is available on this deployment.
export function GET() {
  const config = watsonxConfigFromEnv();
  return Response.json({ live: Boolean(config), model: config?.modelId ?? null });
}

// Streams newline-delimited JSON PipelineEvents so the UI can show each agent as it runs.
export async function POST(request: Request) {
  const config = watsonxConfigFromEnv();
  if (!config) {
    return Response.json(
      { error: 'Live analysis is not configured on this deployment. Open a recorded Bob run instead.' },
      { status: 503 },
    );
  }

  const parsed = RequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: PipelineEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      try {
        const report = await runPipeline(config, parsed.data, emit);
        emit({ type: 'result', report });
      } catch (error) {
        emit({ type: 'error', message: error instanceof Error ? error.message : 'Analysis failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
