import React from 'react';
import { FileText, Bookmark, Target, Check, AlertTriangle, ArrowRight } from 'lucide-react';

interface Props {
  documentTitle: string;
  documentFilename: string;
  pageNumber: number;
  sectionHeading?: string;
  exactQuote: string;
  relevanceScore: number;
  nliLabel: string;
  nliConfidence: number;
}

export const EvidenceCard: React.FC<Props> = ({
  documentTitle,
  documentFilename,
  pageNumber,
  sectionHeading,
  exactQuote,
  relevanceScore,
  nliLabel,
  nliConfidence,
}) => {
  const isEntailment = nliLabel === 'ENTAILMENT';
  const isContradiction = nliLabel === 'CONTRADICTION';

  return (
    <div
      className={`rounded-xl border p-4 text-sm transition-all ${
        isContradiction
          ? 'bg-rose-950/20 border-rose-500/30'
          : isEntailment
          ? 'bg-emerald-950/20 border-emerald-500/30'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-semibold text-slate-200">{documentTitle}</span>
          <span className="text-xs text-slate-400">({documentFilename})</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
            <Bookmark className="w-3 h-3 text-slate-400" />
            Page {pageNumber}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-slate-800 text-slate-300 font-mono">
            <Target className="w-3 h-3 text-cyan-400" />
            Sim: {(relevanceScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {sectionHeading && (
        <div className="text-xs font-medium text-slate-400 mb-2 italic">
          Section: <span className="text-slate-300">{sectionHeading}</span>
        </div>
      )}

      {/* Verbatim Passage Quote */}
      <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/60 font-serif text-slate-200 text-sm leading-relaxed mb-3">
        <span className="text-emerald-500 font-bold select-none mr-1">&ldquo;</span>
        {exactQuote}
        <span className="text-emerald-500 font-bold select-none ml-1">&rdquo;</span>
      </div>

      {/* NLI Label & Confidence */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">NLI Inference:</span>
          {isEntailment && (
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-400">
              <Check className="w-3.5 h-3.5" /> Entailment (Support)
            </span>
          )}
          {isContradiction && (
            <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
              <AlertTriangle className="w-3.5 h-3.5" /> Empirical Contradiction
            </span>
          )}
          {!isEntailment && !isContradiction && (
            <span className="inline-flex items-center gap-1 font-semibold text-slate-400">
              Neutral / Insufficient Direct Grounding
            </span>
          )}
        </div>

        <div className="text-slate-400 font-mono">
          Confidence: <span className="text-slate-200 font-semibold">{(nliConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};
