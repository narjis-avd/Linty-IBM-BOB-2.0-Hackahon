import { BaseAgent } from './base-agent';
import { AgentResponse, z } from '../utils/schemas';

const FixerInputSchema = z.object({
  code: z.string(),
  language: z.enum(['javascript', 'typescript']),
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
});

const FixerOutputSchema = z.object({
  fixedCode: z.string(),
  fixes: z.array(z.object({
    issueId: z.string(),
    description: z.string(),
    applied: z.boolean(),
  })),
});

export class FixerAgent extends BaseAgent {
  constructor(client: any) {
    super(client, 'FixerAgent');
  }

  async execute(input: any): Promise<AgentResponse> {
    try {
      const validated = FixerInputSchema.parse(input);
      const { code, language, issues } = validated;

      const issuesSummary = issues.map((issue, index) => {
        return `[${index}] ${issue.type.toUpperCase()} at line ${issue.line}: ${issue.message}
   Suggestion: ${issue.suggestions[0] || 'Apply the suggested fix'}
   Severity: ${issue.severity}`;
      }).join('\n\n');

      const prompt = `You are an expert code fixer for ${language} code. Your task is to fix the issues identified in the code below.

ORIGINAL CODE:
\`\`\`${language}
${code}
\`\`\`

ISSUES TO FIX:
${issuesSummary}

Instructions:
1. Fix ALL errors and critical issues first
2. Apply appropriate fixes with minimal changes
3. Preserve the original functionality
4. Keep code style consistent
5. Return ONLY the FIXED CODE without any explanations or markdown formatting

Respond with:
{
  "fixedCode": "the actual fixed code",
  "fixes": [
    {
      "issueId": "issue-1",
      "description": "Fix applied",
      "applied": true
    }
  ]
}`;

      const result = await this.generateWithFallback(
        prompt,
        FixerOutputSchema,
        z.object({
          fixedCode: z.string(),
          fixes: z.array(z.object({
            issueId: z.string(),
            description: z.string(),
            applied: z.boolean(),
          })),
        })
      );

      return {
        agent: 'FixerAgent',
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('FixerAgent execution failed:', error);
      return {
        agent: 'FixerAgent',
        status: 'failed',
        data: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
