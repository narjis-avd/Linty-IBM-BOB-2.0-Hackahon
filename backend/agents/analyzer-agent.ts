import { BaseAgent } from './base-agent';
import { AgentResponse, z } from '../utils/schemas';

const AnalyzerInputSchema = z.object({
  code: z.string(),
  language: z.enum(['javascript', 'typescript']),
});

const IssuesSchema = z.array(z.object({
  id: z.string(),
  line: z.number(),
  column: z.number(),
  severity: z.enum(['error', 'warning', 'info']),
  type: z.string(),
  message: z.string(),
  code: z.string(),
  suggestions: z.array(z.string()),
}));

const ComplexitySchema = z.object({
  score: z.number().min(0).max(100),
  metrics: z.object({
    cyclomaticComplexity: z.number(),
    linesOfCode: z.number(),
    functionCount: z.number(),
    nestingDepth: z.number(),
  }),
});

const AnalyzerOutputSchema = z.object({
  issues: IssuesSchema,
  complexity: ComplexitySchema,
  securityIssues: z.array(z.object({
    severity: z.enum(['high', 'medium', 'low']),
    issue: z.string(),
    location: z.string(),
  })),
  warnings: z.array(z.object({
    message: z.string(),
    location: z.string(),
  })),
});

export class AnalyzerAgent extends BaseAgent {
  constructor(client: any) {
    super(client, 'AnalyzerAgent');
  }

  async execute(input: any): Promise<AgentResponse> {
    try {
      const validated = AnalyzerInputSchema.parse(input);
      const { code, language } = validated;

      const prompt = `You are an expert code analyzer for ${language} code. Analyze the following code thoroughly and identify:
1. Bugs and errors (errors, null pointer exceptions, etc.)
2. Code quality issues (naming, structure, complexity)
3. Security vulnerabilities
4. Performance issues
5. Best practice violations

CODE:
\`\`\`${language}
${code}
\`\`\`

Respond ONLY with valid JSON matching this schema:
{
  "issues": [
    {
      "id": "unique-id",
      "line": 1,
      "column": 10,
      "severity": "error|warning|info",
      "type": "bug|security|performance|style",
      "message": "detailed description",
      "code": "ERROR-CODE",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "complexity": {
    "score": 0-100,
    "metrics": {
      "cyclomaticComplexity": number,
      "linesOfCode": number,
      "functionCount": number,
      "nestingDepth": number
    }
  },
  "securityIssues": [
    {
      "severity": "high|medium|low",
      "issue": "description",
      "location": "line:column"
    }
  ],
  "warnings": [
    {
      "message": "warning description",
      "location": "line:column"
    }
  ]
}`;

      const result = await this.generateWithFallback(
        prompt,
        AnalyzerOutputSchema,
        z.object({
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
          complexity: ComplexitySchema,
          securityIssues: z.array(z.object({
            severity: z.enum(['high', 'medium', 'low']),
            issue: z.string(),
            location: z.string(),
          })),
          warnings: z.array(z.object({
            message: z.string(),
            location: z.string(),
          })),
        })
      );

      return {
        agent: 'AnalyzerAgent',
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('AnalyzerAgent execution failed:', error);
      return {
        agent: 'AnalyzerAgent',
        status: 'failed',
        data: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
