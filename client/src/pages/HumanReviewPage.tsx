import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import { StatusBadge } from '../components/StatusBadge';
import { EvidenceCard } from '../components/EvidenceCard';
import {
  UserCheck,
  CheckCircle,
  XCircle,
  Edit3,
  HelpCircle,
  AlertTriangle,
  History,
  Clock,
  ShieldCheck,
  FileText,
  Send,
  Loader2,
} from 'lucide-react';
import { ClaimStatus, ReviewTaskStatus, ReviewTask } from '../types';

export const HumanReviewPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('PENDING');
  const [activeTask, setActiveTask] = useState<ReviewTask | null>(null);

  // Form states for active review decision
  const [actionType, setActionType] = useState<'ACCEPT' | 'REJECT' | 'MODIFY' | 'REQUEST_EVIDENCE'>('ACCEPT');
  const [newStatus, setNewStatus] = useState<ClaimStatus>('SUPPORTED');
  const [explanation, setExplanation] = useState('');
  const [correctionText, setCorrectionText] = useState('');
  const [reviewerName, setReviewerName] = useState('Dr. Sarah Chen');

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['reviews', selectedStatusTab],
    queryFn: () => apiService.getReviews(selectedStatusTab === 'ALL' ? undefined : selectedStatusTab),
  });

  const submitDecisionMutation = useMutation({
    mutationFn: async () => {
      if (!activeTask) return;
      return apiService.submitReviewDecision(activeTask.id, {
        actionType,
        newStatus,
        explanation,
        correctionText: correctionText.trim() || undefined,
        reviewerName,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setActiveTask(null);
      setExplanation('');
      setCorrectionText('');
    },
  });

  const handleOpenReview = (task: ReviewTask) => {
    setActiveTask(task);
    setNewStatus(task.claim.status);
    setActionType('ACCEPT');
    setExplanation('');
    setCorrectionText('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
          <UserCheck className="w-8 h-8 text-emerald-400" />
          <span>Human Review & Audit Portal</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Review claims flagged for ambiguity or clinical/regulatory sensitivity. All decisions preserve immutable audit histories.
        </p>
      </div>

      {submitDecisionMutation.isError && (
        <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
          <strong>Decision was not saved:</strong>{' '}
          {(submitDecisionMutation.error as any)?.response?.data?.error || (submitDecisionMutation.error as any)?.message || 'Check the server connection and try again.'}
          <button type="button" className="ml-3 underline" onClick={() => submitDecisionMutation.reset()}>Dismiss</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        {['PENDING', 'APPROVED', 'MODIFIED', 'REJECTED', 'ALL'].map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedStatusTab(tab)}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px ${
              selectedStatusTab === tab
                ? 'border-emerald-400 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab === 'PENDING' ? 'Awaiting Review' : tab}
          </button>
        ))}
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Task List */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Review Queue ({tasks?.length ?? 0})
          </h2>

          {isLoading ? (
            <div className="p-8 text-center text-slate-500 text-xs">Loading review tasks...</div>
          ) : !tasks || tasks.length === 0 ? (
            <div className="p-8 text-center glass-panel rounded-2xl border border-slate-800 text-slate-400 text-xs">
              No review tasks found in this queue.
            </div>
          ) : (
            tasks.map((task) => {
              const isSelected = activeTask?.id === task.id;
              return (
                <div
                  key={task.id}
                  onClick={() => handleOpenReview(task)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md'
                      : 'glass-panel hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        task.priority === 'CRITICAL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : task.priority === 'HIGH'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(task.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-xs font-semibold text-slate-200 line-clamp-2 mb-2">
                    {task.claim.originalText}
                  </h3>

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-slate-800/80">
                    <StatusBadge status={task.claim.status} size="sm" />
                    <span className="text-slate-500 truncate max-w-[120px]">
                      {task.verificationRun?.title || 'Run'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Active Review Workstation */}
        <div className="lg:col-span-2">
          {activeTask ? (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
              {/* Task Header */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300">
                      Task ID: {activeTask.id.slice(0, 8)}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/20 text-amber-300">
                      Status: {activeTask.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Run: <span className="text-white font-medium">{activeTask.verificationRun?.title}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Flagged Reason: </span>
                    <span>{activeTask.reason}</span>
                  </div>
                </div>
              </div>

              {/* Claim Under Review */}
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Target Claim Assertion
                </div>
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-sm font-semibold text-white leading-relaxed">
                  {activeTask.claim.originalText}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                  <span>Type: <strong className="text-slate-200">{activeTask.claim.claimType}</strong></span>
                  <span>•</span>
                  <span>Importance: <strong className="text-slate-200">{activeTask.claim.importance}</strong></span>
                  <span>•</span>
                  <span>Current Status: <StatusBadge status={activeTask.claim.status} size="sm" /></span>
                </div>
              </div>

              {/* Evidence Inspector */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Retrieved Ground-Truth Passages ({activeTask.claim.evidenceLinks?.length || 0})
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {!activeTask.claim.evidenceLinks || activeTask.claim.evidenceLinks.length === 0 ? (
                    <div className="p-3 rounded-lg bg-slate-900 text-xs text-slate-500 italic">
                      No matching evidence passages available in database.
                    </div>
                  ) : (
                    activeTask.claim.evidenceLinks.map((link) => {
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

              {/* Reviewer Decision Controls */}
              <div className="border-t border-slate-800 pt-5 space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  <span>Submit Human Reviewer Decision</span>
                </h3>

                {/* Action Type Radio Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'ACCEPT', label: 'Accept Verdict', icon: CheckCircle },
                    { id: 'REJECT', label: 'Reject / Flag', icon: XCircle },
                    { id: 'MODIFY', label: 'Override Status', icon: Edit3 },
                    { id: 'REQUEST_EVIDENCE', label: 'Need Evidence', icon: HelpCircle },
                  ].map((act) => {
                    const Icon = act.icon;
                    return (
                      <button
                        key={act.id}
                        type="button"
                        onClick={() => setActionType(act.id as any)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all ${
                          actionType === act.id
                            ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{act.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Target New Status (if modifying) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Target Verified Status
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value as ClaimStatus)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="SUPPORTED">SUPPORTED</option>
                      <option value="CONTRADICTED">CONTRADICTED</option>
                      <option value="PARTIALLY_SUPPORTED">PARTIALLY_SUPPORTED</option>
                      <option value="INSUFFICIENT_EVIDENCE">INSUFFICIENT_EVIDENCE</option>
                      <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Reviewer Identity / Signature
                    </label>
                    <input
                      type="text"
                      value={reviewerName}
                      onChange={(e) => setReviewerName(e.target.value)}
                      placeholder="Reviewer Name"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                {/* Explanation text */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Mandatory Audit Rationale / Explanation <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Provide specific medical, legal, or empirical justification for this decision. This will be permanently recorded in the audit trail."
                    className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Optional Correction */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Corrected Assertion Text (Optional)
                  </label>
                  <input
                    type="text"
                    value={correctionText}
                    onChange={(e) => setCorrectionText(e.target.value)}
                    placeholder="Provide corrected claim statement if modifying factual proposition"
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTask(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    disabled={submitDecisionMutation.isPending || explanation.trim().length < 3 || !reviewerName.trim()}
                    onClick={() => submitDecisionMutation.mutate()}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-500/20"
                  >
                    {submitDecisionMutation.isPending ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Recording Decision...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Confirm & Commit Decision</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Immutable Decision History Audit Trail */}
              {activeTask.actions && activeTask.actions.length > 0 && (
                <div className="border-t border-slate-800 pt-5 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Audit Trail History ({activeTask.actions.length})</span>
                  </h4>

                  <div className="space-y-2">
                    {activeTask.actions.map((act) => (
                      <div
                        key={act.id}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-emerald-400">{act.actionType}</span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(act.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-slate-300">{act.explanation}</p>
                        <div className="text-[11px] text-slate-500">
                          Status Transition: <span className="line-through">{act.previousStatus}</span> → <strong>{act.newStatus}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center glass-panel rounded-2xl border border-slate-800 text-center p-8">
              <UserCheck className="w-12 h-12 text-slate-600 mb-3" />
              <h3 className="text-base font-bold text-slate-200">Select a Task from Queue</h3>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Choose an item on the left to inspect claim assertions, retrieved passages, and submit human review decisions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
