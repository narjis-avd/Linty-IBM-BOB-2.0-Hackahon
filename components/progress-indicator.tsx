'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export interface Step {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
}

interface ProgressIndicatorProps {
  steps: Step[];
}

export function ProgressIndicator({ steps }: ProgressIndicatorProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const completed = steps.filter(s => s.status === 'completed').length;
    const total = steps.length;
    const inProgress = steps.filter(s => s.status === 'in-progress').length;
    const error = steps.filter(s => s.status === 'error').length;

    let newProgress = (completed / total) * 100;
    if (inProgress > 0) {
      newProgress += (inProgress / total) * 100 * 0.5; // Give extra weight to in-progress
    }
    if (error > 0) {
      newProgress -= (error / total) * 100;
    }

    setProgress(Math.min(100, Math.max(0, newProgress)));
  }, [steps]);

  const getStepIcon = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-[#a3e635]" />;
      case 'in-progress':
        return <Clock className="w-5 h-5 text-[#a3e635] animate-spin" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-[#ef4444]" />;
      default:
        return <div className="w-5 h-5 rounded-full bg-[#27272a]" />;
    }
  };

  const getStatusColor = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return 'text-[#a3e635]';
      case 'in-progress':
        return 'text-[#a3e635] animate-pulse';
      case 'error':
        return 'text-[#ef4444]';
      default:
        return 'text-[#71717a]';
    }
  };

  const getStatusBgColor = (step: Step) => {
    switch (step.status) {
      case 'completed':
        return 'bg-[#a3e635] text-[#09090b]';
      case 'in-progress':
        return 'bg-[#a3e635] text-[#09090b]';
      case 'error':
        return 'bg-[#ef4444] text-white';
      default:
        return 'bg-[#27272a] text-[#71717a]';
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Progress Bar */}
      <div className="progress-bar">
        <div
          className="progress-bar-fill"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-3">
            <div
              className={`relative flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300 ${
                step.status === 'completed'
                  ? 'border-[#a3e635] bg-[#a3e635]/20'
                  : step.status === 'in-progress'
                  ? 'border-[#a3e635] border-4'
                  : step.status === 'error'
                  ? 'border-[#ef4444]'
                  : 'border-[#27272a] bg-[#09090b]'
              }`}
            >
              {getStepIcon(step)}
            </div>
            <div className="text-left">
              <p className={`text-sm font-medium ${getStatusColor(step)}`}>{step.label}</p>
              {step.status === 'error' && (
                <p className="text-xs text-[#ef4444]">Failed</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
