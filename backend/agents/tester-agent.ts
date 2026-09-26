import { BaseAgent } from './base-agent';
import { AgentResponse, z } from '../utils/schemas';

const TesterInputSchema = z.object({
  language: z.enum(['javascript', 'typescript']),
  fixedCode: z.string(),
  issues: z.array(z.object({
    id: z.string(),
    line: z.number(),
    type: z.string(),
    message: z.string(),
  })),
});

const TestCaseSchema = z.object({
  id: z.string(),
  description: z.string(),
  type: z.enum(['unit', 'integration', 'e2e', 'edge-case']),
  code: z.string(),
  coverage: z.number().optional(),
});

const TesterOutputSchema = z.object({
  testCases: z.array(TestCaseSchema),
  testFramework: z.string().default('Jest'),
});

export class TesterAgent extends BaseAgent {
  constructor(client: any) {
    super(client, 'TesterAgent');
  }

  async execute(input: any): Promise<AgentResponse> {
    try {
      const validated = TesterInputSchema.parse(input);
      const { language, fixedCode, issues } = validated;

      const prompt = `You are an expert test generator for ${language} code. Generate comprehensive test cases for the following code.

CODE TO TEST:
\`\`\`${language}
${fixedCode}
\`\`\`

ISSUES TO TEST FOR:
${issues.map(issue => `- ${issue.type}: ${issue.message}`).join('\n')}

Generate test cases that cover:
1. Unit tests for individual functions
2. Integration tests for main workflows
3. Edge cases and boundary conditions
4. Error handling scenarios

For each test case, provide:
- Clear description
- Test type (unit/integration/e2e/edge-case)
- Complete test code
- Estimated code coverage

Respond with valid JSON:
{
  "testCases": [
    {
      "id": "test-1",
      "description": "Test case description",
      "type": "unit",
      "code": "// complete test code",
      "coverage": 85
    }
  ],
  "testFramework": "Jest"
}`;

      const result = await this.generateWithFallback(
        prompt,
        TesterOutputSchema,
        z.object({
          testCases: z.array(TestCaseSchema),
          testFramework: z.string(),
        })
      );

      return {
        agent: 'TesterAgent',
        status: 'success',
        data: result,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('TesterAgent execution failed:', error);
      return {
        agent: 'TesterAgent',
        status: 'failed',
        data: null,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
