'use client';

import { Code2, CheckCircle2, CheckCircle2 as TestIcon } from 'lucide-react';
import { MonacoEditor } from './monaco-editor';

interface TestCase {
  id: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'edge-case';
  code: string;
  coverage?: number;
}

interface TestCasesListProps {
  testCases: TestCase[];
  testFramework: string;
}

export function TestCasesList({ testCases, testFramework }: TestCasesListProps) {
  if (testCases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Code2 className="w-16 h-16 text-[#71717a] mb-4" />
        <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No Test Cases</h3>
        <p className="text-[#71717a] max-w-md">
          No test cases were generated. Try analyzing different code.
        </p>
      </div>
    );
  }

  return (
    <div className="test-cases-container">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Generated Test Cases</h3>
          <p className="text-sm text-[#71717a] mt-1">
            Framework: <span className="text-[#a3e635]">{testFramework}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#a3e635]">{testCases.length}</p>
            <p className="text-xs text-[#71717a]">Tests</p>
          </div>
          {testCases[0]?.coverage !== undefined && (
            <div className="text-center">
              <p className="text-2xl font-bold text-[#22c55e]">
                {testCases[0].coverage}%
              </p>
              <p className="text-xs text-[#71717a]">Coverage</p>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {testCases.map((testCase) => (
          <div key={testCase.id} className="test-case">
            <div className="test-case-header">
              <div className="flex items-center gap-2">
                <TestIcon className="w-5 h-5 text-[#a3e635]" />
                <span className="test-type">{testCase.type}</span>
                {testCase.coverage !== undefined && (
                  <span className="test-coverage">{testCase.coverage}% coverage</span>
                )}
              </div>
              <span className="text-xs text-[#71717a]">
                {testCase.id}
              </span>
            </div>
            <p className="text-sm text-[#a1a1aa] mb-3">
              {testCase.description}
            </p>
            <div className="test-code">
              <pre>{testCase.code}</pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
