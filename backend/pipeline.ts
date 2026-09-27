import type { ZodType } from 'zod';
import {
  AnalysisSchema,
  FixSchema,
  ReporterSchema,
  TestsSchema,
  type LintyReport,
  type PipelineEvent,
  type Stage,
} from '@/lib/linty/schema';
import { chat, extractJson, type WatsonxConfig } from './watsonx';
import { numberLines, renderPrompt } from './prompts';

interface PipelineInput {
  code: string;
  language: 'typescript' | 'javascript';
  fileName: string;
}

// Analyzer -> Fixer -> Tester -> Reporter, each a separate watsonx call.
export async function runPipeline(
  config: WatsonxConfig,
  input: PipelineInput,
  emit: (event: PipelineEvent) => void,
): Promise<LintyReport> {
  const timings: Record<Stage, number> = { analyze: 0, fix: 0, test: 0, report: 0 };

  async function stage<T>(name: Stage, prompt: string, schema: ZodType<T>): Promise<T> {
    emit({ type: 'stage', stage: name, status: 'running' });
    const started = Date.now();
    try {
      let lastError: unknown;
      // One retry: small models occasionally return malformed JSON.
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = schema.parse(extractJson(await chat(config, prompt)));
          timings[name] = Date.now() - started;
          emit({ type: 'stage', stage: name, status: 'done', ms: timings[name] });
          return result;
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      emit({ type: 'stage', stage: name, status: 'error', error: message });
      throw new Error(`${name} stage failed: ${message}`);
    }
  }

  const { code, language } = input;

  const analysis = await stage(
    'analyze',
    renderPrompt('analyzer', { language, code_input: numberLines(code) }),
    AnalysisSchema,
  );
  const analysisJson = JSON.stringify(analysis, null, 2);

  const fix = await stage(
    'fix',
    renderPrompt('fixer', { language, code_input: code, analysis_json: analysisJson }),
    FixSchema,
  );

  const tests = await stage(
    'test',
    renderPrompt('tester', { language, fixed_code: fix.fixedCode, analysis_json: analysisJson }),
    TestsSchema,
  );

  const report = await stage(
    'report',
    renderPrompt('reporter', {
      analysis_json: analysisJson,
      fixes_json: JSON.stringify(fix.fixes, null, 2),
      test_count: String(tests.cases.length),
    }),
    ReporterSchema,
  );

  return {
    schemaVersion: 1,
    id: `live-${Date.now()}`,
    title: input.fileName,
    fileName: input.fileName,
    language,
    source: { kind: 'watsonx', model: config.modelId, recordedAt: new Date().toISOString() },
    originalCode: code,
    analysis,
    fix,
    tests,
    report,
    timings: {
      analyzeMs: timings.analyze,
      fixMs: timings.fix,
      testMs: timings.test,
      reportMs: timings.report,
      totalMs: timings.analyze + timings.fix + timings.test + timings.report,
      method: 'Measured server-side around each watsonx call',
    },
  };
}
