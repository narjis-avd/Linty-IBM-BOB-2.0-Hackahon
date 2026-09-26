'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

interface Issue {
  id: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info';
  type: string;
  message: string;
  code: string;
  suggestions: string[];
}

interface IssuesListProps {
  issues: Issue[];
}

export function IssuesList({ issues }: IssuesListProps) {
  if (issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <CheckCircle2 className="w-16 h-16 text-[#22c55e] mb-4" />
        <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No Issues Found!</h3>
        <p className="text-[#71717a] max-w-md">
          Your code is clean and well-structured. No bugs or issues detected.
        </p>
      </div>
    );
  }

  return (
    <div className="issues-container">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Issues Found ({issues.length})</h3>
        <div className="flex gap-2">
          <span className="text-xs px-2 py-1 bg-[#ef4444]/20 text-[#ef4444] rounded">
            {issues.filter(i => i.severity === 'error').length} Errors
          </span>
          <span className="text-xs px-2 py-1 bg-[#eab308]/20 text-[#eab308] rounded">
            {issues.filter(i => i.severity === 'warning').length} Warnings
          </span>
          <span className="text-xs px-2 py-1 bg-[#3b82f6]/20 text-[#3b82f6] rounded">
            {issues.filter(i => i.severity === 'info').length} Info
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {issues.map((issue) => (
          <div
            key={issue.id}
            className={`issue-card ${issue.severity}`}
          >
            <div className="issue-header">
              <span className="issue-type">{issue.type}</span>
              <span className="issue-severity ${issue.severity}">
                {issue.severity.toUpperCase()}
              </span>
            </div>

            <div className="issue-message">
              <p className="font-medium">{issue.message}</p>
              {issue.code && (
                <code className="block mt-2 px-2 py-1 bg-[#09090b] rounded text-sm text-[#71717a]">
                  {issue.code}
                </code>
              )}
            </div>

            {issue.suggestions && issue.suggestions.length > 0 && (
              <div className="issue-suggestions">
                <p className="text-sm font-medium text-[#a1a1aa] mb-2">
                  Recommended Fix:
                </p>
                {issue.suggestions.map((suggestion, index) => (
                  <div key={index} className="issue-suggestion">
                    {suggestion}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-[#27272a]">
              <p className="text-xs text-[#71717a]">
                Location: Line {issue.line}, Column {issue.column}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
