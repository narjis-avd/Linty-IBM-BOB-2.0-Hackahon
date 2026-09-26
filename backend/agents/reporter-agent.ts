import { BaseAgent } from './base-agent';
import { AgentResponse, z } from '../utils/schemas';

const ReporterInputSchema = z.object({
  code: z.string(),
  fixedCode: z.string(),
  issues: z.array(z.object({
    id: z.string(),
    line: z.number(),
    severity: z.enum(['error', 'warning', 'info']),
    type: z.string(),
    message: z.string(),
  })),
  complexity: z.object({
    score: z.number(),
    metrics: z.object({
      cyclomaticComplexity: z.number(),
      linesOfCode: z.number(),
      functionCount: z.number(),
      nestingDepth: z.number(),
    }),
  }),
  testCases: z.array(z.object({
    id: z.string(),
    description: z.string(),
    type: z.string(),
  })),
});

const ReporterOutputSchema = z.object({
  summary: z.string(),
  report: z.object({
    overallScore: z.number().min(0).max(100),
    scoreBreakdown: z.object({
      bugScore: z.number(),
      complexityScore: z.number(),
      securityScore: z.number(),
      testScore: z.number(),
      maintainabilityScore: z.number(),
    }),
    recommendations: z.array(z.string()),
    conclusion: z.string(),
  }),
});

export class ReporterAgent extends BaseAgent {
  constructor(client: any) {
    super(client, 'ReporterAgent');
  }

  async execute(input: any): Promise<AgentResponse> {
    try {
      const validated = ReporterInputSchema.parse(input);
      const { code, fixedCode, issues, complexity, testCases } = validated;

      const severityCounts = {
        error: issues.filter(i => i.severity === 'error').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
      };

      const prompt = `You are a code analysis report generator. Create a comprehensive report for the code analysis.

ORIGINAL CODE (lines ${code.split('\n').length} lines):
\`\`\`javascript
${code.substring(0, 1000)}${code.length > 1000 ? '\n... (truncated for report)' : ''}
\`\`\`

FIXED CODE:
\`\`\`javascript
${fixedCode}
\`\`\`

ANALYSIS SUMMARY:
- Total Issues: ${issues.length}
  - Errors: ${severityCounts.error}
  - Warnings: ${severityCounts.warning}
  - Info: ${severityCounts.info}
- Complexity Score: ${complexity.score}/100
- Test Cases Generated: ${testCases.length}

Generate a professional analysis report with:
1. Executive summary
2. Score breakdown (5 categories: Bug, Complexity, Security, Test, Maintainability)
3. Key recommendations
4. Overall conclusion

Respond with valid JSON:
{
  "summary": "Brief executive summary of the analysis",
  "report": {
    "overallScore": 0-100,
    "scoreBreakdown": {
      "bugScore": 0-100,
      "complexityScore": 0-100,
      "securityScore": 0-100,
      "testScore": 0-100,
      "maintainabilityScore": 0-100
    },
    "recommendations": ["recommendation1", "recommendation2", ...],
    "conclusion": "Final assessment and next steps"
  }
}`;

      const result = await this.generateWithFallback(
        prompt,
        ReporterOutputSchema,
        z.object({
          summary: z.string(),
          report: z.object({
            overallScore: z.number(),
            scoreBreakdown: z.object({
              bugScore: z.number(),
              complexityScore: z.number(),
              securityScore: z.number(),
              testScore: z.number(),
              maintainabilityScore: z.number(),
            }),
            recommendations: z.array(z.string()),
            conclusion: z.string(),
          }),
        })
      );

      return {
        agent: 'ReporterAgent',
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('ReporterAgent execution failed:', error);
      return {
        agent: 'ReporterAgent',
        status: 'failed',
        data: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
