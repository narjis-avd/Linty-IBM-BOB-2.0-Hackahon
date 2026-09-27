import { z } from 'zod';

// One schema shared by every producer of a Linty report: the Bob IDE
// workflow (scripts/linty.mjs finalize) and the live watsonx pipeline.

export const IssueSchema = z.object({
  id: z.string(),
  type: z.enum(['Syntax', 'Logical', 'Runtime', 'Performance', 'Security']),
  description: z.string(),
  line: z.number().int().nullable(),
  severity: z.enum(['Low', 'Medium', 'High']),
  suggestion: z.string().optional(),
});

export const AnalysisSchema = z.object({
  errors: z.array(IssueSchema),
  risk_level: z.enum(['Low', 'Medium', 'High']),
  summary: z.string(),
});

export const FixSchema = z.object({
  fixedCode: z.string(),
  fixes: z.array(z.object({ issueId: z.string(), change: z.string() })),
});

export const TestsSchema = z.object({
  framework: z.string(),
  code: z.string(),
  cases: z.array(z.object({ name: z.string(), issueId: z.string().nullable() })),
});

export const ReporterSchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.string()),
});

const TestRunSchema = z.object({
  passed: z.number().int(),
  failed: z.number().int(),
  total: z.number().int(),
});

export const LintyReportSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  title: z.string(),
  fileName: z.string(),
  language: z.enum(['typescript', 'javascript']),
  source: z.object({
    kind: z.enum(['bob', 'watsonx']),
    model: z.string().optional(),
    recordedAt: z.string(),
    author: z.string().optional(),
  }),
  originalCode: z.string(),
  analysis: AnalysisSchema,
  fix: FixSchema,
  tests: TestsSchema,
  report: ReporterSchema,
  // Real test execution: generated tests run against the original and the fixed code.
  verification: z
    .object({
      command: z.string(),
      original: TestRunSchema,
      fixed: TestRunSchema,
    })
    .optional(),
  // Seeded-bug ground truth from samples/<name>.expected.json, when available.
  detection: z
    .object({
      expected: z.number().int(),
      caught: z.number().int(),
      missed: z.array(z.string()),
    })
    .optional(),
  timings: z
    .object({
      analyzeMs: z.number(),
      fixMs: z.number(),
      testMs: z.number(),
      reportMs: z.number(),
      totalMs: z.number(),
      method: z.string(),
    })
    .optional(),
});

export type Issue = z.infer<typeof IssueSchema>;
export type Analysis = z.infer<typeof AnalysisSchema>;
export type Fix = z.infer<typeof FixSchema>;
export type Tests = z.infer<typeof TestsSchema>;
export type Reporter = z.infer<typeof ReporterSchema>;
export type LintyReport = z.infer<typeof LintyReportSchema>;

export const STAGES = ['analyze', 'fix', 'test', 'report'] as const;
export type Stage = (typeof STAGES)[number];

export type PipelineEvent =
  | { type: 'stage'; stage: Stage; status: 'running' | 'done' | 'error'; ms?: number; error?: string }
  | { type: 'result'; report: LintyReport }
  | { type: 'error'; message: string };
