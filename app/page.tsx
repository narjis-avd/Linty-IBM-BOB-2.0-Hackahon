'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight, Braces, Play, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { MonacoEditor } from '@/components/monaco-editor';
import { ResultsTabs } from '@/components/results-tabs';
import { CodeDiff } from '@/components/code-diff';
import { IssuesList } from '@/components/issues-list';
import { TestCasesList } from '@/components/test-cases-list';
import { AnalysisReport } from '@/components/analysis-report';
import { ProgressIndicator } from '@/components/progress-indicator';
import { Button } from '@/components/ui/button';
import type { AnalysisResult } from '@/backend/utils/schemas';
import type { Step } from '@/components/progress-indicator';

const sampleCode = `// Sample TypeScript code with bugs
function calculateSum(numbers: number[]): number {
  let sum = 0;
  for (let i = 0; i <= numbers.length; i++) {
    sum += numbers[i];
  }
  return sum;
}

function getUserById(id: string): any {
  const users = [
    { id: '1', name: 'John Doe' },
    { id: '2', name: 'Jane Smith' },
  ];
  return users.find(u => u.id === id);
}

class UserController {
  private users: any[] = [];

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
    return this.users.find(u => u.id === id);
  }
}

export function processData(data: any) {
  return data.map((item: any) => ({
    ...item,
    nested: item.nested || {}
  }));
}`;

export default function Home() {
  const [code, setCode] = useState(sampleCode);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'issues' | 'fixed' | 'tests' | 'report'>('issues');

  const steps: Step[] = [
    { id: 'analyzer', label: 'Analyzing Code', status: 'pending' },
    { id: 'fixer', label: 'Fixing Issues', status: 'pending' },
    { id: 'tester', label: 'Generating Tests', status: 'pending' },
    { id: 'reporter', label: 'Generating Report', status: 'pending' },
  ];

  const [stepStatus, setStepStatus] = useState<Record<string, 'pending' | 'in-progress' | 'completed' | 'error'>>({
    analyzer: 'pending',
    fixer: 'pending',
    tester: 'pending',
    reporter: 'pending',
  });

  const handleAnalyze = async () => {
    setIsAnalyzing(true);

    // Update step status
    setStepStatus({
      analyzer: 'in-progress',
      fixer: 'pending',
      tester: 'pending',
      reporter: 'pending',
    });

    try {
      const response = await fetch('/api/code-analyzer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          language: 'typescript',
        }),
      });

      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const data = await response.json();
      if (data.ok && data.result) {
        setAnalysisResult(data.result);

        // Update step status to completed
        setStepStatus({
          analyzer: 'completed',
          fixer: 'completed',
          tester: 'completed',
          reporter: 'completed',
        });

        // Set initial tab to issues
        setActiveTab('issues');
      } else {
        throw new Error(data.error?.message || 'Analysis failed');
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setStepStatus({
        analyzer: 'error',
        fixer: 'error',
        tester: 'error',
        reporter: 'error',
      });
      alert(error instanceof Error ? error.message : 'Analysis failed. Please check your IBM watsonx API configuration.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <main className="relative isolate min-h-[100dvh] overflow-hidden bg-[#09090b]">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-5 py-8">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-white/10 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg border border-[#a3e635]/30 bg-[#a3e635]/10">
              <Braces className="h-4 w-4 text-[#a3e635]" strokeWidth={1.8} />
            </div>
            <span className="font-mono text-sm font-semibold tracking-[-0.02em] text-[#fafafa]">
              AI<span className="text-[#a3e635]">Code</span>Forge
            </span>
          </div>
          <span className="px-3 py-1 rounded-full bg-[#a3e635]/10 text-[#a3e635] text-xs font-semibold">
            Multi-Agent System
          </span>
        </header>

        <div className="grid flex-1 grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
          {/* Left Panel - Code Editor */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#fafafa]">Code Editor</h2>
                <p className="text-sm text-[#71717a]">TypeScript / JavaScript</p>
              </div>
              <Button
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    Run AI Analysis
                  </>
                )}
              </Button>
            </div>

            <div className="flex-1 rounded-lg border border-[#27272a] overflow-hidden bg-[#09090b]">
              <MonacoEditor
                value={code}
                onChange={setCode}
                language="typescript"
                height="100%"
                loading={<div className="h-full flex items-center justify-center text-[#71717a]">Loading editor...</div>}
              />
            </div>
          </div>

          {/* Right Panel - Results */}
          <div className="flex flex-col gap-4 overflow-hidden">
            {/* Progress Indicator */}
            {isAnalyzing && (
              <div className="rounded-lg border border-[#27272a] bg-[#18181b] p-4">
                <ProgressIndicator steps={steps} />
              </div>
            )}

            {/* Results Container */}
            {analysisResult && !isAnalyzing ? (
              <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                <ResultsTabs
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  issueCount={analysisResult.issues.length}
                />

                <div className="flex-1 overflow-y-auto space-y-4">
                  {activeTab === 'issues' && (
                    <IssuesList issues={analysisResult.issues} />
                  )}

                  {activeTab === 'fixed' && (
                    <CodeDiff
                      originalCode={analysisResult.originalCode}
                      fixedCode={analysisResult.fixedCode}
                      issues={analysisResult.issues}
                    />
                  )}

                  {activeTab === 'tests' && (
                    <TestCasesList
                      testCases={analysisResult.testCases}
                      testFramework={analysisResult.testFramework || 'Jest'}
                    />
                  )}

                  {activeTab === 'report' && (
                    <AnalysisReport
                      report={analysisResult.report}
                      issues={analysisResult.issues}
                      testCases={analysisResult.testCases}
                    />
                  )}
                </div>
              </div>
            ) : !isAnalyzing && !analysisResult && code !== sampleCode ? (
              <div className="flex-1 rounded-lg border border-dashed border-[#27272a] flex flex-col items-center justify-center text-center p-8">
                <ArrowUpRight className="h-12 w-12 text-[#71717a] mb-4" />
                <h3 className="text-lg font-semibold text-[#fafafa] mb-2">No Analysis Yet</h3>
                <p className="text-[#71717a] max-w-md">
                  Run AI analysis on your code to detect bugs, get fixes, generate tests, and receive a comprehensive report.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 py-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs text-[#71717a]">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#a3e635]" />
                <span>4 AI Agents</span>
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3" />
                <span>IBM watsonx Powered</span>
              </span>
              <span className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                <span>Automated Testing</span>
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>v1.0.0</span>
              <span className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Multi-Agent System</span>
              </span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
