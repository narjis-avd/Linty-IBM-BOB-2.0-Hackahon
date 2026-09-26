import { z } from 'zod';

// Export z for other modules to use
export { z };

// Main Analysis Result Schema
export const AnalysisResultSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'analyzing', 'fixing', 'testing', 'reporting', 'completed', 'error']),
  timestamp: z.string(),
  language: z.enum(['javascript', 'typescript']),
  originalCode: z.string(),
  issues: z.array(z.object({
    id: z.string(),
    line: z.number(),
    column: z.number(),
    severity: z.enum(['error', 'warning', 'info']),
    type: z.string(),
    message: z.string(),
    code: z.string(),
    suggestions: z.array(z.string()),
  })),
  fixedCode: z.string(),
  testCases: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.enum(['unit', 'integration', 'e2e', 'edge-case']),
    code: z.string(),
    coverage: z.number().optional(),
  })),
  testFramework: z.string().optional(),
  report: z.object({
    summary: z.string(),
    complexity: z.object({
      score: z.number(),
      metrics: z.object({
        cyclomaticComplexity: z.number(),
        linesOfCode: z.number(),
        functionCount: z.number(),
        nestingDepth: z.number(),
      }),
    }),
    security: z.object({
      score: z.number(),
      issues: z.array(z.object({
        severity: z.enum(['high', 'medium', 'low']),
        issue: z.string(),
        location: z.string(),
      })),
    }),
    maintainability: z.object({
      score: z.number(),
      recommendations: z.array(z.string()),
    }),
  }),
});

// Type for Analysis Result
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

// Base Agent Response Schema
export const AgentResponseSchema = z.object({
  agent: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  data: z.any(),
  timestamp: z.string(),
  error: z.string().optional(),
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;
