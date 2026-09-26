'use client';

import { useState } from 'react';
import { Activity, FileCode, Code2, FileText } from 'lucide-react';

type Tab = 'issues' | 'fixed' | 'tests' | 'report';

interface ResultsTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  issueCount?: number;
}

export function ResultsTabs({ activeTab, onTabChange, issueCount = 0 }: ResultsTabsProps) {
  const tabs: Array<{ id: Tab; label: string; icon: any; count?: number }> = [
    { id: 'issues', label: 'Issues', icon: Activity, count: issueCount },
    { id: 'fixed', label: 'Fixed Code', icon: FileCode },
    { id: 'tests', label: 'Tests', icon: Code2 },
    { id: 'report', label: 'Report', icon: FileText },
  ];

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-lg overflow-hidden">
      <div className="flex items-center p-2 space-x-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-[#27272a] text-[#a3e635]'
                : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#27272a]/50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-2 py-0.5 text-xs font-semibold bg-[#27272a] rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
