'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'javascript' | 'typescript';
  height?: string;
  readOnly?: boolean;
  className?: string;
  loading?: React.ReactNode;
}

export function MonacoEditor({
  value,
  onChange,
  language = 'typescript',
  height = '400px',
  readOnly = false,
  className = '',
  loading,
}: MonacoEditorProps) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isError, setIsError] = useState(false);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  // Handle code editing
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!readOnly) {
      onChange(e.target.value);
    }
  };

  // Add line numbers
  const getLineNumbers = (code: string) => {
    if (!code) return '';
    const lines = code.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  };

  if (isError) {
    return (
      <div className={`relative ${className}`} style={{ height }}>
        <textarea
          value={value}
          onChange={handleCodeChange}
          readOnly={readOnly}
          className="w-full h-full bg-[#09090b] text-[#fafafa] font-mono text-sm p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#a3e635]"
          style={{ 
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            lineHeight: '1.5',
            height
          }}
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className} rounded-lg overflow-hidden border border-[#27272a]`} style={{ height }}>
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#18181b] border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[#1a1a1a] px-2 py-1 rounded border border-[#27272a]">
            <div className="w-2 h-2 rounded-full bg-[#ff5f57]"></div>
            <div className="w-2 h-2 rounded-full bg-[#ffbd2e]"></div>
            <div className="w-2 h-2 rounded-full bg-[#28ca42]"></div>
          </div>
          <span className="text-xs text-[#71717a] font-mono bg-[#1a1a1a] px-2 py-1 rounded border border-[#27272a]">
            {language}
          </span>
          {readOnly && (
            <span className="text-xs text-[#a3e635] bg-[#1a1a1a] px-2 py-1 rounded border border-[#27272a]">
              READONLY
            </span>
          )}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex h-full">
        {/* Line Numbers */}
        <div className="bg-[#09090b] text-[#71717a] font-mono text-sm p-4 border-r border-[#27272a] select-none text-right overflow-hidden">
          {getLineNumbers(value)}
        </div>

        {/* Code Editor */}
        <textarea
          value={value}
          onChange={handleCodeChange}
          readOnly={readOnly}
          className="flex-1 bg-[#09090b] text-[#fafafa] font-mono text-sm p-4 resize-none focus:outline-none"
          style={{ 
            fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
            lineHeight: '1.5',
            height,
            minHeight: '200px'
          }}
          spellCheck={false}
        />
      </div>

      {/* Loading Overlay */}
      {!isInitialized && (
        <div className="absolute inset-0 bg-[#09090b] bg-opacity-90 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#a3e635] mx-auto mb-2" />
            <p className="text-[#71717a] text-sm">Initializing Editor...</p>
          </div>
        </div>
      )}
    </div>
  );
}