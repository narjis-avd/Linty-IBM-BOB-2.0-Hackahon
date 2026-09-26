import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface AnalysisRequest {
  code: string;
  language?: 'javascript' | 'typescript';
}

export async function POST(request: NextRequest) {
  try {
    const body: AnalysisRequest = await request.json();
    const { code, language = 'typescript' } = body;

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Code is required and must be a non-empty string',
            details: ['Code must be provided'],
          },
          result: null,
        },
        { status: 400 }
      );
    }

    // Mock analysis result for testing
    const analysisId = `analysis-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Mock issues based on common TypeScript patterns
    const mockIssues = [
      {
        id: 'bug-1',
        line: 19,
        column: 21,
        severity: 'error',
        type: 'bug',
        message: 'Array index out of bounds. Loop goes up to array length (exclusive)',
        code: 'OUT_OF_BOUNDS',
        suggestions: [
          'Change condition to `i < numbers.length` instead of `i <= numbers.length`'
        ]
      },
      {
        id: 'security-1',
        line: 25,
        column: 43,
        severity: 'warning',
        type: 'security',
        message: 'Returning `any` type loses type safety and security',
        code: 'TYPE_SAFETY',
        suggestions: [
          'Define a proper User interface with specific types',
          'Use a stricter return type instead of `any`'
        ]
      },
      {
        id: 'style-1',
        line: 34,
        column: 18,
        severity: 'info',
        type: 'style',
        message: 'Class property visibility could be more restrictive',
        code: 'VISIBILITY',
        suggestions: [
          'Consider making properties private if they are only used internally'
        ]
      },
      {
        id: 'performance-1',
        line: 43,
        column: 8,
        severity: 'warning',
        type: 'performance',
        message: 'Consider using error handling instead of null returns',
        code: 'ERROR_HANDLING',
        suggestions: [
          'Use try-catch blocks for better error handling',
          'Consider returning Result<T, Error> type pattern'
        ]
      }
    ];

    // Mock fixed code with corrections
    const mockFixedCode = `// Fixed TypeScript code
function calculateSum(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i < numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

function getUserById(id: string): {
  id: string;
  name: string;
} | null {
  const users = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
  ];
  const user = users.find(u => u.id === id);
  return user || null;
}

class UserController {
  private users: { id: string; name: string }[];

  constructor() {
    this.users = [
      { id: '1', name: 'John Doe' },
      { id: '2', name: 'Jane Smith' },
    ];
  }

  async createUser(name: string) {
    const user = { id: Date.now().toString(), name };
    this.users.push(user);
    return user;
  }

  getUser(id: string) {
    return this.users.find(u => u.id === id) || null;
  }
}

export function processData(data: any[]) {
  return data.map((item: any) => ({
    ...item,
    nested: item.nested || {}
  }));
}`;

    // Mock test cases
    const mockTestCases = [
      {
        id: 'test-1',
        description: 'Test calculateSum with positive numbers',
        type: 'unit',
        code: `test('calculateSum with positive numbers', () => {
  const numbers = [1, 2, 3, 4, 5];
  expect(calculateSum(numbers)).toBe(15);
});`,
        coverage: 85
      },
      {
        id: 'test-2',
        description: 'Test calculateSum with empty array',
        type: 'unit',
        code: `test('calculateSum with empty array', () => {
  expect(calculateSum([])).toBe(0);
});`,
        coverage: 95
      },
      {
        id: 'test-3',
        description: 'Test getUserById with existing user',
        type: 'unit',
        code: `test('getUserById with existing user', () => {
  const user = getUserById('1');
  expect(user).toEqual({ id: '1', name: 'John Doe' });
});`,
        coverage: 90
      },
      {
        id: 'test-4',
        description: 'Test getUserById with non-existent user',
        type: 'unit',
        code: `test('getUserById with non-existent user', () => {
  const user = getUserById('999');
  expect(user).toBeNull();
});`,
        coverage: 88
      }
    ];

    // Mock analysis report
    const mockReport = {
      summary: 'The code has been analyzed and several issues have been identified. The code contains a potential array bounds error, security concerns with any type usage, and opportunities for improved type safety and error handling.',
      scoreBreakdown: {
        bugScore: 75,
        complexityScore: 60,
        securityScore: 70,
        testScore: 85,
        maintainabilityScore: 80
      },
      recommendations: [
        'Fix the array bounds error in calculateSum function',
        'Replace any types with proper interfaces',
        'Improve error handling with try-catch blocks',
        'Consider adding input validation',
        'Enhance test coverage for edge cases'
      ],
      conclusion: 'The code is functional but has several areas for improvement. Focus on type safety, error handling, and comprehensive testing to ensure robust application behavior.'
    };

    const result = {
      id: analysisId,
      status: 'completed',
      timestamp,
      language,
      originalCode: code,
      issues: mockIssues,
      fixedCode: mockFixedCode,
      testCases: mockTestCases,
      report: mockReport
    };

    return NextResponse.json(
      {
        ok: true,
        result,
      },
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Analysis error:', error);

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'server_error',
          message: 'An unexpected error occurred during analysis',
          details: [error instanceof Error ? error.message : 'Unknown error'],
        },
        result: {
          status: 'error',
          timestamp: new Date().toISOString(),
          error: true,
        },
      },
      { status: 500 }
    );
  }
}