'use client';

import { useState } from 'react';
import { FileCode, GitCompare, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { MonacoEditor } from './monaco-editor';

interface CodeDiffProps {
  originalCode: string;
  fixedCode: string;
  issues: any[];
}

export function CodeDiff({ originalCode, fixedCode, issues }: CodeDiffProps) {
  const [activeTab, setActiveTab] = useState<'original' | 'fixed'>('original');
  const [diff, setDiff] = useState<string>('');

  // Dummy onChange function for read-only editor
  const handleEditorChange = (value: string) => {
    // Do nothing for read-only editor
  };

  const hasIssues = issues.length > 0;

  return (
    <div className="code-diff-container">
      <div className="code-diff-header">
        <div className="flex items-center gap-3">
          <FileCode className="w-5 h-5 text-[#a3e635]" />
          <h3 className="text-lg font-semibold">Code Diff</h3>
        </div>
        <div className="code-diff-tabs">
          <button
            onClick={() => setActiveTab('original')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'original'
                ? 'bg-[#27272a] text-[#a3e635]'
                : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a]/50'
            }`}
          >
            Original Code
          </button>
          <button
            onClick={() => setActiveTab('fixed')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === 'fixed'
                ? 'bg-[#27272a] text-[#a3e635]'
                : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a]/50'
            }`}
          >
            Fixed Code
          </button>
        </div>
      </div>

      {hasIssues && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-[#27272a]/50 rounded-lg">
          <GitCompare className="w-5 h-5 text-[#a3e635]" />
          <span className="text-sm text-[#a1a1aa]">
            Found {issues.length} issue(s) that were fixed
          </span>
        </div>
      )}

      <div className="relative">
        {activeTab === 'original' ? (
          <MonacoEditor
            value={originalCode}
            onChange={handleEditorChange}
            language="javascript"
            height="500px"
            readOnly
          />
        ) : (
          <MonacoEditor
            value={fixedCode}
            onChange={handleEditorChange}
            language="javascript"
            height="500px"
            readOnly
          />
        )}
      </div>
    </div>
  );
}
