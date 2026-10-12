import React from 'react';

interface Props {
  score: number; // 0.0 to 1.0
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const ConfidenceGauge: React.FC<Props> = ({ score, size = 'md', label = 'Calibrated Confidence' }) => {
  const percentage = Math.round(score * 100);

  let colorClass = 'text-emerald-400 stroke-emerald-500';
  let bgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  let textAssessment = 'High Veracity';

  if (percentage < 40) {
    colorClass = 'text-rose-400 stroke-rose-500';
    bgClass = 'bg-rose-500/10 text-rose-400 border-rose-500/30';
    textAssessment = 'High Hallucination Risk';
  } else if (percentage < 75) {
    colorClass = 'text-amber-400 stroke-amber-500';
    bgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    textAssessment = 'Ambiguous / Requires Scrutiny';
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center gap-3">
      {/* SVG Ring Gauge */}
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg className="w-14 h-14 -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            className="stroke-slate-800"
            strokeWidth="9"
            fill="transparent"
          />
          <circle
            cx="50"
            cy="50"
            r={radius}
            className={`transition-all duration-1000 ease-out ${colorClass}`}
            strokeWidth="9"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
          />
        </svg>
        <span className="absolute font-bold text-sm tracking-tight text-white font-mono">
          {percentage}%
        </span>
      </div>

      <div>
        <div className="text-xs font-medium text-slate-400">{label}</div>
        <div className="text-xs font-semibold text-slate-200 mt-0.5">{textAssessment}</div>
      </div>
    </div>
  );
};
