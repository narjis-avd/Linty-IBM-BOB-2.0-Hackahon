import { NextRequest, NextResponse } from 'next/server';
import { WatsonXClient } from '../utils/watsonx-client';
import { AnalysisResultSchema } from '../utils/schemas';
import {
  AnalyzerAgent,
  FixerAgent,
  TesterAgent,
  ReporterAgent,
} from '../agents';

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

    if (code.length > 100_000) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'validation_error',
            message: 'Code is too large. Maximum size is 100KB',
            details: ['Code must be less than 100KB'],
          },
          result: null,
        },
        { status: 400 }
      );
    }

    // Initialize IBM watsonx client
    const apiKey = process.env.WATSONX_API_KEY;
    const url = process.env.WATSONX_URL || 'https://us-south.ml.cloud.ibm.com';
    const projectId = process.env.WATSONX_PROJECT_ID;
    const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-13b-chat-v2';

    if (!apiKey || !projectId) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'configuration_error',
            message: 'Missing required environment variables',
            details: ['WATSONX_API_KEY and WATSONX_PROJECT_ID are required'],
          },
          result: null,
        },
        { status: 500 }
      );
    }

    const client = new WatsonXClient({ apiKey, url, projectId, modelId });

    // Initialize agents
    const analyzer = new AnalyzerAgent(client);
    const fixer = new FixerAgent(client);
    const tester = new TesterAgent(client);
    const reporter = new ReporterAgent(client);

    // Create analysis result object
    const analysisId = `analysis-${Date.now()}`;
    const timestamp = new Date().toISOString();

    // Start agent execution sequence
    const result: any = {
      id: analysisId,
      status: 'analyzing',
      timestamp,
      language,
      originalCode: code,
      issues: [],
      fixedCode: code,
      testCases: [],
      report: null,
    };

    // Step 1: Analyze code
    result.status = 'analyzing';
    const analyzerResult = await analyzer.execute({ code, language });
    if (analyzerResult.status === 'success') {
      result.issues = analyzerResult.data.issues;
      result.complexity = analyzerResult.data.complexity;
      result.securityIssues = analyzerResult.data.securityIssues;
      result.warnings = analyzerResult.data.warnings;
    } else {
      result.status = 'error';
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'analysis_failed',
            message: 'Failed to analyze code',
            details: [analyzerResult.error || 'Unknown error'],
          },
          result,
        },
        { status: 500 }
      );
    }

    // Step 2: Fix issues
    result.status = 'fixing';
    const fixerResult = await fixer.execute({
      code,
      language,
      issues: result.issues,
    });
    if (fixerResult.status === 'success') {
      result.fixedCode = fixerResult.data.fixedCode;
      result.fixes = fixerResult.data.fixes;
    } else {
      result.status = 'error';
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'fixing_failed',
            message: 'Failed to fix issues',
            details: [fixerResult.error || 'Unknown error'],
          },
          result,
        },
        { status: 500 }
      );
    }

    // Step 3: Generate tests
    result.status = 'testing';
    const testerResult = await tester.execute({
      language,
      fixedCode: result.fixedCode,
      issues: result.issues,
    });
    if (testerResult.status === 'success') {
      result.testCases = testerResult.data.testCases;
      result.testFramework = testerResult.data.testFramework;
    }

    // Step 4: Generate report
    result.status = 'reporting';
    const reporterResult = await reporter.execute({
      code,
      fixedCode: result.fixedCode,
      issues: result.issues,
      complexity: result.complexity,
      testCases: result.testCases,
    });
    if (reporterResult.status === 'success') {
      result.report = reporterResult.data;
    }

    // Mark as complete
    result.status = 'completed';

    // Validate and return result
    const validatedResult = AnalysisResultSchema.parse(result);

    return NextResponse.json(
      {
        ok: true,
        result: validatedResult,
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
