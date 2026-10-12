import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiService } from '../services/api';
import {
  ShieldCheck,
  Upload,
  Link as LinkIcon,
  FileText,
  X,
  Sparkles,
  Sliders,
  CheckCircle,
  AlertCircle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { VerificationMode } from '../types';

export const NewVerificationPage: React.FC = () => {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [rawAnswer, setRawAnswer] = useState('');
  const [mode, setMode] = useState<VerificationMode>('BALANCED');
  const [sourceUrl, setSourceUrl] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);

  // Fetch existing documents for selection
  const { data: existingDocs } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiService.getDocuments(),
  });

  const samplePrompts = [
    {
      label: 'Verified Solar PV & Storage',
      title: 'Solar & Battery Cost Audit',
      text: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1]. In addition, average lithium-iron-phosphate battery storage costs declined to $135 per kilowatt-hour by Q4 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 3].',
    },
    {
      label: 'Fabricated Citation & Discrepancy',
      title: 'Offshore Wind Target Investigation',
      text: 'International consortium targets mandate 95 gigawatts of offshore wind capacity by 2030 [Clean_Energy_Transition_Report_2024.pdf, p. 88]. Furthermore, solar installations dropped 15% due to supply chain shortages in 2023.',
    },
    {
      label: 'Clinical Contraindication (Human Review)',
      title: 'Antihypertensive Combination Therapy Check',
      text: 'Combining ACE inhibitors with Angiotensin Receptor Blockers is widely recommended by modern clinicians for enhanced cardiovascular and renal protection.',
    },
  ];

  const verifyMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('title', title || 'Verification Run');
      formData.append('rawAnswer', rawAnswer);
      formData.append('mode', mode);

      if (sourceUrl.trim()) {
        formData.append('sourceUrls', JSON.stringify([sourceUrl.trim()]));
      }

      if (selectedDocIds.length > 0) {
        formData.append('documentIds', JSON.stringify(selectedDocIds));
      }

      for (const file of files) {
        formData.append('documents', file);
      }

      // The API currently returns only the final result, not live per-stage events.
      // Keep the UI honest instead of showing simulated progress.
      return apiService.createVerificationRun(formData);
    },
    onSuccess: (data) => {
      navigate(`/runs/${data.run.id}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDocSelection = (id: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]
    );
  };

  const loadSample = (sample: typeof samplePrompts[0]) => {
    setTitle(sample.title);
    setRawAnswer(sample.text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawAnswer.trim()) return;
    verifyMutation.mutate();
  };

  const pipelineStages = [
    'Document Ingestion & Chunking',
    'Atomic Claim Extraction',
    'PostgreSQL FTS + Vector Retrieval',
    'Source & Citation Validity Check',
    'Natural Language Inference (NLI)',
    'Contradiction & Polarity Detection',
    'Calibrated Decision Calculation',
    'Audit Trail & Provenance Compilation',
    'Final Verification Report Generation',
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Verify AI Output
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Submit an AI-generated answer to extract claims, retrieve ground-truth passages, detect fabricated citations, and verify empirical support.
        </p>
      </div>

      {/* Preset Prompts */}
      <div className="mb-6 p-4 rounded-xl glass-panel border border-slate-800">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-3">
          <Sparkles className="w-4 h-4" />
          <span>Load Preset Test Cases</span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {samplePrompts.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => loadSample(s)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Verification Title */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Verification Title (Optional)
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Clinical Trial Analysis, Renewable Energy Facts"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* AI-Generated Answer */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                AI-Generated Answer Text <span className="text-rose-400">*</span>
              </label>
              <span className="text-xs text-slate-500 font-mono">{rawAnswer.length} chars</span>
            </div>
            <textarea
              rows={6}
              required
              value={rawAnswer}
              onChange={(e) => setRawAnswer(e.target.value)}
              placeholder="Paste the AI-generated answer here with any inline citations, e.g.:&#10;'Solar capacity increased by 32% in 2023 [Clean Energy Report, p. 1]...'"
              className="w-full p-3.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-sans leading-relaxed focus:outline-none focus:border-emerald-500 transition-colors"
            />
          </div>
        </div>

        {/* Verification Mode Selector */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
            <Sliders className="w-4 h-4 text-emerald-400" />
            <span>Verification Threshold Mode</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: 'STRICT' as VerificationMode,
                name: 'Strict Mode',
                desc: 'Threshold >= 0.82. For medical, clinical, and regulatory claims.',
              },
              {
                id: 'BALANCED' as VerificationMode,
                name: 'Balanced Mode',
                desc: 'Threshold >= 0.75. Standard enterprise fact-checking default.',
              },
              {
                id: 'EXPLORATORY' as VerificationMode,
                name: 'Exploratory Mode',
                desc: 'Threshold >= 0.62. Discovery for exploratory drafts.',
              },
            ].map((m) => (
              <label
                key={m.id}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  mode === m.id
                    ? 'bg-emerald-500/10 border-emerald-500 text-white'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold">{m.name}</span>
                  <input
                    type="radio"
                    name="mode"
                    value={m.id}
                    checked={mode === m.id}
                    onChange={() => setMode(m.id)}
                    className="accent-emerald-500"
                  />
                </div>
                <p className="text-xs text-slate-400">{m.desc}</p>
              </label>
            ))}
          </div>
        </div>

        {/* Reference Documents Upload */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Upload New Reference Documents</h3>
              <p className="text-xs text-slate-400">PDF, TXT, or DOCX files containing ground-truth evidence</p>
            </div>
            <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Choose Files</span>
              <input
                type="file"
                multiple
                accept=".pdf,.txt,.docx,.md"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {files.length > 0 && (
            <div className="space-y-2 pt-2">
              {files.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-slate-500 font-mono">
                      ({Math.round(file.size / 1024)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="text-slate-400 hover:text-rose-400 p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Optional Source URL */}
          <div className="pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Optional Source URL (Protected by SSRF Guard)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="url"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="https://example.org/policy-report.txt"
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Existing Document Library Selection */}
          {existingDocs && existingDocs.length > 0 && (
            <div className="pt-3 border-t border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-2">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Or Select From Existing Verified Library ({existingDocs.length} available):</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {existingDocs.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <label
                      key={doc.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDocSelection(doc.id)}
                        className="accent-emerald-500"
                      />
                      <span className="truncate">{doc.title}</span>
                      <span className="text-[10px] text-slate-500 shrink-0">({doc.pageCount}p)</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Error Notification */}
        {verifyMutation.isError && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>
              {(verifyMutation.error as any)?.response?.data?.error || (verifyMutation.error as any)?.message || 'Verification execution failed.'}
            </span>
          </div>
        )}

        {/* Animated Loading Status */}
        {verifyMutation.isPending && (
          <div className="p-5 rounded-2xl glass-panel border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              <div>
                <div className="font-semibold text-white text-sm">Running verification pipeline…</div>
                <p className="text-xs text-slate-400 mt-1">The server is processing your answer. Stage-by-stage live progress is not available, so this indicator reflects the actual request state.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {pipelineStages.map((stage) => (
                <div key={stage} className="flex items-center gap-2 text-xs text-slate-300">
                  <div className="w-2 h-2 rounded-full bg-emerald-400/70 shrink-0" />
                  <span>{stage}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={verifyMutation.isPending || !rawAnswer.trim()}
            className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-emerald-500/25 flex items-center gap-2 transition-all"
          >
            {verifyMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Claims...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Execute Fact-Check</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
