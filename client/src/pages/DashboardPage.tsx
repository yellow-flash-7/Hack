import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { ConfidenceGauge } from '../components/ConfidenceGauge';
import {
  FileCheck,
  AlertTriangle,
  UserCheck,
  ShieldAlert,
  ArrowRight,
  PlusCircle,
  Trash2,
  ExternalLink,
  BookOpen,
  Calendar,
  Layers,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: apiService.getStats,
  });

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['verificationRuns', 1],
    queryFn: () => apiService.getVerificationRuns(1, 10),
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteVerificationRun,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verificationRuns'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this verification run?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Verification Dashboard
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time veracity telemetry, claim breakdown, and citation audit trail
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/documents"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium border border-slate-700 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span>Document Library</span>
          </Link>

          <Link
            to="/verify"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium shadow-md shadow-emerald-500/20 transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>New Verification</span>
          </Link>
        </div>
      </div>

      {deleteMutation.isError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
          Could not delete this verification run. {(deleteMutation.error as any)?.response?.data?.error || (deleteMutation.error as any)?.message || 'Check the server connection and try again.'}
          <button type="button" className="ml-3 underline" onClick={() => deleteMutation.reset()}>Dismiss</button>
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Runs */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider">Verification Runs</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {statsLoading ? '...' : stats?.totalRuns ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Evaluating <span className="text-slate-200 font-semibold">{stats?.totalClaims ?? 0}</span> atomic claims
          </div>
        </div>

        {/* Supported Claims */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Supported Claims</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">
            {statsLoading ? '...' : stats?.statusCounts?.SUPPORTED ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            <span className="text-emerald-400 font-semibold">{stats?.accuracyRate ?? 0}%</span> overall empirical grounding
          </div>
        </div>

        {/* Contradicted Claims */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">Contradictions</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400 tracking-tight">
            {statsLoading ? '...' : stats?.statusCounts?.CONTRADICTED ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Direct discrepancies against source docs
          </div>
        </div>

        {/* Pending Human Reviews */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">Pending Review</span>
            <UserCheck className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 tracking-tight">
            {statsLoading ? '...' : stats?.pendingReviews ?? 0}
          </div>
          <div className="text-xs text-slate-400 mt-2">
            <Link to="/reviews" className="text-amber-400 hover:underline flex items-center gap-1">
              <span>View Review Queue</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Fabricated Citation Alert Banner (if any detected) */}
      {(stats?.fabricatedCitations ?? 0) > 0 && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="font-semibold text-rose-200 text-sm">
                🚨 {stats?.fabricatedCitations} Fabricated Citation Markers Flagged
              </div>
              <div className="text-xs text-rose-300/80">
                The citation validation agent detected references to non-existent sources or out-of-bounds page numbers.
              </div>
            </div>
          </div>
          <Link
            to="/verify"
            className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-medium border border-rose-500/30"
          >
            Review Runs
          </Link>
        </div>
      )}

      {/* Recent Verification Activity */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Recent Verification Runs</h2>
            <p className="text-xs text-slate-400 mt-0.5">Chronological record of verified model responses</p>
          </div>
          <Link
            to="/verify"
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
          >
            <span>Run New Verification</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {runsLoading ? (
          <div className="p-12 text-center text-slate-400">Loading verification records...</div>
        ) : !runsData?.runs || runsData.runs.length === 0 ? (
          <div className="p-12 text-center">
            <FileCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No verification runs recorded yet</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Start your first automated fact-checking run</p>
            <Link
              to="/verify"
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold"
            >
              Verify First Answer
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {runsData.runs.map((run) => (
              <div
                key={run.id}
                className="p-5 hover:bg-slate-800/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/runs/${run.id}`}
                      className="font-bold text-slate-100 hover:text-emerald-400 text-sm tracking-tight truncate block"
                    >
                      {run.title || 'Verification Run'}
                    </Link>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {run.mode}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-1 font-mono">
                    {run.rawAnswer.slice(0, 140)}...
                  </p>

                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(run.createdAt).toLocaleDateString()} at{' '}
                      {new Date(run.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>•</span>
                    <span>{run.totalClaims} Claims Extracted</span>
                    <span>•</span>
                    <span className="text-emerald-400 font-medium">{run.supportedCount} Supported</span>
                    {run.contradictedCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="text-rose-400 font-medium">{run.contradictedCount} Contradicted</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end md:self-center shrink-0">
                  <ConfidenceGauge score={run.calibratedConfidence} size="sm" label="Calibrated Score" />

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/runs/${run.id}`}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <span>Inspect Report</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      onClick={(e) => handleDelete(run.id, e)}
                      title="Delete Run"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
