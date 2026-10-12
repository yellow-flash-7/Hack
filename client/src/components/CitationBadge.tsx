import React from 'react';
import { Citation } from '../types';
import { BookCheck, AlertOctagon, HelpCircle } from 'lucide-react';

interface Props {
  citation: Citation | {
    citationText: string;
    isValid: boolean;
    isFabricated: boolean;
    failureReason?: string;
    citedDocumentTitle?: string;
    citedPage?: number;
  };
}

export const CitationBadge: React.FC<Props> = ({ citation }) => {
  if (citation.isFabricated) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span className="font-semibold">{citation.citationText}</span>
        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-[10px] uppercase font-bold text-rose-400">
          Fabricated
        </span>
      </div>
    );
  }

  if (citation.isValid) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
        <BookCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>{citation.citationText}</span>
        {citation.citedPage && (
          <span className="text-slate-400 text-[11px]">(p. {citation.citedPage})</span>
        )}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
      <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
      <span>{citation.citationText}</span>
      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[10px] uppercase font-bold text-amber-400">
        Irrelevant
      </span>
    </div>
  );
};
