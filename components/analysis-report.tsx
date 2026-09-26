'use client';

import { Activity, AlertTriangle, TrendingUp, BookOpen, FileText } from 'lucide-react';

interface ReportSection {
  score: number;
  label: string;
  value: number | (() => number);
  color: string | 'function';
  icon: any;
}

interface ReportProps {
  report: any;
  issues: any[];
  testCases: any[];
}

export function AnalysisReport({ report, issues, testCases }: ReportProps) {
  const calculateOverallScore = () => {
    if (!report?.scoreBreakdown) return 0;

    const breakdown = report.scoreBreakdown;
    const total = breakdown.bugScore + breakdown.complexityScore +
                 breakdown.securityScore + breakdown.testScore + breakdown.maintainabilityScore;
    return Math.round(total / 5);
  };

  const getScoreColor = (score: number): 'good' | 'average' | 'poor' => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'average';
    return 'poor';
  };

  const getScoreColorClass = (score: number): string => {
    const colorClass = getScoreColor(score);
    switch (colorClass) {
      case 'good':
        return 'text-[#a3e635]';
      case 'average':
        return 'text-[#facc15]';
      case 'poor':
        return 'text-[#ef4444]';
      default:
        return 'text-[#71717a]';
    }
  };

  const reportSections: ReportSection[] = [
    {
      score: calculateOverallScore(),
      label: 'Overall Score',
      value: calculateOverallScore(),
      color: '[#a3e635]',
      icon: Activity,
    },
    {
      score: report?.scoreBreakdown?.bugScore || 0,
      label: 'Bug Score',
      value: report?.scoreBreakdown?.bugScore || 0,
      color: 'function',
      icon: AlertTriangle,
    },
    {
      score: report?.scoreBreakdown?.complexityScore || 0,
      label: 'Complexity',
      value: report?.scoreBreakdown?.complexityScore || 0,
      color: 'function',
      icon: TrendingUp,
    },
    {
      score: report?.scoreBreakdown?.securityScore || 0,
      label: 'Security',
      value: report?.scoreBreakdown?.securityScore || 0,
      color: 'function',
      icon: AlertTriangle,
    },
    {
      score: report?.scoreBreakdown?.testScore || 0,
      label: 'Test Coverage',
      value: report?.scoreBreakdown?.testScore || 0,
      color: 'function',
      icon: BookOpen,
    },
    {
      score: report?.scoreBreakdown?.maintainabilityScore || 0,
      label: 'Maintainability',
      value: report?.scoreBreakdown?.maintainabilityScore || 0,
      color: 'function',
      icon: FileText,
    },
  ];

  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-16 h-16 text-[#71717a] mb-4" />
        <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No Report</h3>
        <p className="text-[#71717a] max-w-md">
          Run analysis to generate a comprehensive report.
        </p>
      </div>
    );
  }

  return (
    <div className="report-container">
      {/* Overall Score Circle */}
      <div className="score-circle">
        <span className="score-number">{calculateOverallScore()}</span>
        <span className="score-label">/ 100</span>
      </div>

      {/* Executive Summary */}
      <div className="bg-[#27272a]/50 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
        <p className="text-[#a1a1aa]">{report.summary}</p>
      </div>

      {/* Score Breakdown */}
      <h3 className="text-lg font-semibold mb-4">Score Breakdown</h3>
      <div className="score-breakdown">
        {reportSections.map((section, index) => {
          const Icon = section.icon;
          const scoreValue = typeof section.value === 'function'
            ? section.value()
            : section.value;
          
          let iconColor: string;
          if (section.color === 'function') {
            iconColor = getScoreColorClass(section.score);
          } else {
            iconColor = section.color;
          }

          return (
            <div key={index} className="score-item">
              <Icon className="w-8 h-8 mx-auto mb-3" style={{ color: iconColor }} />
              <p className="score-item-label">{section.label}</p>
              <p className={`score-item-value ${getScoreColorClass(scoreValue)}`}>{scoreValue}</p>
            </div>
          );
        })}
      </div>

      {/* Recommendations */}
      {report.recommendations && report.recommendations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">Key Recommendations</h3>
          <ul className="space-y-3">
            {report.recommendations.map((recommendation: string, index: number) => (
              <li key={index} className="flex items-start gap-3 p-3 bg-[#27272a]/50 rounded-lg">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#a3e635]/20 flex items-center justify-center text-sm font-bold text-[#a3e635]">
                  {index + 1}
                </span>
                <p className="text-[#a1a1aa]">{recommendation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Conclusion */}
      <div className="mt-8 p-4 bg-[#27272a]/50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">Conclusion</h3>
        <p className="text-[#a1a1aa]">{report.conclusion}</p>
      </div>

      {/* Metrics Summary */}
      <div className="mt-8 p-4 bg-[#27272a]/50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Analysis Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-[#71717a]">Issues Found</p>
            <p className="text-xl font-bold text-[#fafafa]">{issues.length}</p>
          </div>
          <div>
            <p className="text-xs text-[#71717a]">Tests Generated</p>
            <p className="text-xl font-bold text-[#fafafa]">{testCases.length}</p>
          </div>
          <div>
            <p className="text-xs text-[#71717a]">Security Score</p>
            <p className="text-xl font-bold text-[#fafafa]">
              {report?.scoreBreakdown?.securityScore || 0}/100
            </p>
          </div>
          <div>
            <p className="text-xs text-[#71717a]">Complexity Score</p>
            <p className="text-xl font-bold text-[#fafafa]">
              {report?.scoreBreakdown?.complexityScore || 0}/100
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
