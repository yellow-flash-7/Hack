import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import { CitationBadge } from '../components/CitationBadge';
import { EvidenceCard } from '../components/EvidenceCard';
import {
  Download,
  ShieldCheck,
  AlertTriangle,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';

export const VerificationResultsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [expandedClaims, setExpandedClaims] = useState<Record<string, boolean>>({});

  const { data: run, isLoading, error } = useQuery({
    queryKey: ['verificationRun', id],
    queryFn: () => apiService.getVerificationRun(id!),
    enabled: Boolean(id),
  });

  const { data: report } = useQuery({
    queryKey: ['verificationReport', id],
    queryFn: () => apiService.getVerificationReport(id!),
    enabled: Boolean(id),
  });

  const toggleClaim = (claimId: string) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const downloadReportJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ELOV-Report-${run?.id?.slice(0, 8) || 'run'}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-bold text-white">Loading Verification Report...</h2>
        <p className="text-xs text-slate-400 mt-1">Retrieving evidence excerpts, decisions, and citation registry</p>
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Verification Run Not Found</h2>
        <p className="text-sm text-slate-400 mt-1 mb-6">The requested verification record could not be loaded.</p>
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm font-semibold hover:bg-slate-700"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isVerdictVerified = run.contradictedCount === 0 && run.fabricatedCitationCount === 0 && run.needsReviewCount === 0;
  const isVerdictContradicted = run.contradictedCount > 0 || run.fabricatedCitationCount > 0;
  const isVerdictReview = run.needsReviewCount > 0 && !isVerdictContradicted;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Navigation Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 rounded-lg bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                {run.title || 'Verification Report'}
              </h1>
              <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                {run.mode}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
              <span>Run ID: <span className="font-mono text-slate-300">{run.id.slice(0, 12)}...</span></span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {run.durationMs}ms
              </span>
              <span>•</span>
              <span>v{run.pipelineVersion}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={downloadReportJson}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Download JSON Report</span>
          </button>

          <Link
            to="/verify"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-md shadow-emerald-500/20 transition-all"
          >
            <span>Run Another Check</span>
          </Link>
        </div>
      </div>

      {/* Executive Verdict Banner */}
      <div
        className={`p-6 rounded-2xl border transition-all ${
          isVerdictContradicted
            ? 'bg-rose-950/20 border-rose-500/30'
            : isVerdictReview
            ? 'bg-amber-950/20 border-amber-500/30'
            : 'bg-emerald-950/20 border-emerald-500/30'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2.5">
              {isVerdictContradicted ? (
                <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <XCircle className="w-5 h-5" />
                </div>
              ) : isVerdictReview ? (
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              )}

              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider text-slate-400">
                  Overall System Verdict
                </span>
                <h2 className="text-xl font-extrabold text-white">
                  {report?.overallVerdict === 'VERIFIED'
                    ? 'VERIFIED: Supported by Trustworthy Evidence'
                    : report?.overallVerdict === 'CONTRADICTED'
                    ? 'CONTRADICTED: Discrepancies or Fabrications Detected'
                    : report?.overallVerdict === 'NEEDS_HUMAN_REVIEW'
                    ? 'NEEDS REVIEW: Ambiguous or High-Risk Assertions'
                    : 'UNVERIFIED: Insufficient Reference Evidence'}
                </h2>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed font-sans pt-1">
              {report?.executiveSummary ||
                'The factual claims were checked against reference documentation using hybrid semantic and keyword retrieval.'}
            </p>
          </div>

          <div className="flex items-center gap-6 self-start lg:self-center shrink-0 border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-4 lg:pt-0 lg:pl-6">
            <ConfidenceGauge
              score={run.calibratedConfidence}
              size="lg"
              label="Calibrated Confidence"
            />
          </div>
        </div>

        {/* Metrics Row Inside Verdict */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
          <div>
            <div className="text-slate-400">Total Claims</div>
            <div className="text-base font-extrabold text-white font-mono mt-0.5">{run.totalClaims}</div>
          </div>
          <div>
            <div className="text-emerald-400 font-medium">Supported</div>
            <div className="text-base font-extrabold text-emerald-400 font-mono mt-0.5">{run.supportedCount}</div>
          </div>
          <div>
            <div className="text-rose-400 font-medium">Contradicted</div>
            <div className="text-base font-extrabold text-rose-400 font-mono mt-0.5">{run.contradictedCount}</div>
          </div>
          <div>
            <div className="text-sky-400 font-medium">Partial Support</div>
            <div className="text-base font-extrabold text-sky-400 font-mono mt-0.5">{run.partiallySupportedCount}</div>
          </div>
          <div>
            <div className="text-amber-400 font-medium">Flagged Review</div>
            <div className="text-base font-extrabold text-amber-400 font-mono mt-0.5">{run.needsReviewCount}</div>
          </div>
          <div>
            <div className="text-rose-300 font-medium">Fabricated Cites</div>
            <div className="text-base font-extrabold text-rose-300 font-mono mt-0.5">{run.fabricatedCitationCount}</div>
          </div>
        </div>
      </div>

      {/* Raw Answer Accordion */}
      <div className="glass-panel rounded-2xl border border-slate-800 p-5 space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Original Evaluated Answer Text</span>
        </div>
        <p className="text-sm font-serif text-slate-300 leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
          {run.rawAnswer}
        </p>
      </div>

      {/* Claim-by-Claim Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Claim-by-Claim Verification Breakdown ({run.claims?.length || 0})</span>
          </h3>
          <span className="text-xs text-slate-400">Click card to expand evidence provenance</span>
        </div>

        <div className="space-y-4">
          {run.claims?.map((claim) => {
            const isExpanded = expandedClaims[claim.id] !== false; // default expanded
            const decision = claim.verificationDecision;
            const citations = claim.citations || [];
            const evidenceLinks = claim.evidenceLinks || [];

            return (
              <div
                key={claim.id}
                className="glass-panel rounded-2xl border border-slate-800 overflow-hidden transition-all"
              >
                {/* Claim Card Header */}
                <div
                  onClick={() => toggleClaim(claim.id)}
                  className="p-5 cursor-pointer hover:bg-slate-800/30 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-colors"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-xs font-mono font-bold">
                        {claim.claimIndex}
                      </span>
                      <StatusBadge status={claim.status} size="md" />
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        {claim.claimType}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Importance: {claim.importance}
                      </span>

                      {/* Calibrated Confidence Badge */}
                      <span className="ml-auto md:ml-0 px-2 py-0.5 rounded text-xs font-mono font-bold bg-slate-900 border border-slate-800 text-emerald-400">
                        Calibrated Score: {(claim.calibratedScore * 100).toFixed(0)}%
                      </span>
                    </div>

                    <h4 className="text-base font-semibold text-slate-100 leading-snug">
                      {claim.originalText}
                    </h4>

                    {claim.normalizedText !== claim.originalText && (
                      <p className="text-xs text-slate-400 italic">
                        Normalized: &ldquo;{claim.normalizedText}&rdquo;
                      </p>
                    )}

                    {/* Inline Citations */}
                    {citations.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <span className="text-xs text-slate-400">Citations:</span>
                        {citations.map((cit) => (
                          <CitationBadge key={cit.id} citation={cit} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end md:self-start">
                    {claim.reviewTask && (
                      <Link
                        to="/reviews"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Queued for Review</span>
                      </Link>
                    )}

                    <button className="text-slate-400 hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-5 border-t border-slate-800/80 bg-slate-950/40 space-y-4">
                    {/* Contradiction Alert Box if any */}
                    {decision?.contradictionInfo && (
                      <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-300">
                          <AlertOctagon className="w-4 h-4 text-rose-400" />
                          <span>Empirical Contradiction Detected:</span>
                        </div>
                        <p className="leading-relaxed">
                          {decision.explanation || 'Claim explicitly conflicts with verified source text.'}
                        </p>
                        {decision.contradictionInfo.claimedValue && decision.contradictionInfo.sourceValue && (
                          <div className="grid grid-cols-2 gap-2 pt-2 font-mono">
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Claimed:</span>
                              <span className="text-rose-400 font-semibold">{decision.contradictionInfo.claimedValue}</span>
                            </div>
                            <div className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-slate-400 block text-[10px]">Authoritative Source:</span>
                              <span className="text-emerald-400 font-semibold">{decision.contradictionInfo.sourceValue}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Abstention Explanation if any */}
                    {decision?.abstentionReason && (
                      <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Abstention Policy Triggered: </span>
                          <span>{decision.abstentionReason}</span>
                        </div>
                      </div>
                    )}

                    {/* Decision Reasoning */}
                    {decision?.explanation && !decision.contradictionInfo && (
                      <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
                        <span className="font-bold text-slate-200">Algorithmic Reasoning: </span>
                        <span>{decision.explanation}</span>
                      </div>
                    )}

                    {/* Retrieved Ground-Truth Evidence Excerpts */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-400">
                        <span>Ground-Truth Evidence Excerpts ({evidenceLinks.length})</span>
                        <span className="font-mono text-[11px] text-slate-500">Hybrid FTS + Semantic Vector Reranking</span>
                      </div>

                      {evidenceLinks.length === 0 ? (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-500 italic text-center">
                          No matching evidence passages retrieved from library.
                        </div>
                      ) : (
                        evidenceLinks.map((link) => {
                          const item = link.evidenceItem;
                          const chunk = item.chunk;
                          const doc = chunk?.document;

                          return (
                            <EvidenceCard
                              key={link.id}
                              documentTitle={doc?.title || 'Unknown Document'}
                              documentFilename={doc?.filename || 'unknown.pdf'}
                              pageNumber={chunk?.pageNumber || 1}
                              sectionHeading={chunk?.sectionHeading || undefined}
                              exactQuote={item.exactQuote || chunk?.content || ''}
                              relevanceScore={item.relevanceScore}
                              nliLabel={item.nliLabel}
                              nliConfidence={item.nliConfidence}
                            />
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
