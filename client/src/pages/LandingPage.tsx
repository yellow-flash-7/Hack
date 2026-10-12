import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  FileSearch,
  BookOpen,
  ArrowRight,
  Database,
  Search,
  Scale,
  UserCheck,
  Zap,
  Sparkles,
  Layers,
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const pipelineSteps = [
    { num: '01', name: 'Input Ingestion', desc: 'Accept AI output, upload reference PDFs/DOCXs, or source URLs with SSRF guard.' },
    { num: '02', name: 'Claim Extraction', desc: 'Decompose answer into atomic factual propositions; filter opinions & predictions.' },
    { num: '03', name: 'Document Processing', desc: 'Extract text, detect section titles, preserve page numbers, generate overlapping chunks.' },
    { num: '04', name: 'Hybrid Retrieval', desc: 'PostgreSQL Full-Text Search fused with semantic vector/cosine similarity embeddings.' },
    { num: '05', name: 'Citation Validation', desc: 'Verify source document exists and page number is valid; flag fabricated citations.' },
    { num: '06', name: 'Evidence NLI Analysis', desc: 'Natural Language Inference classifying entailment, neutral, and contradiction.' },
    { num: '07', name: 'Contradiction Checker', desc: 'Detect empirical discrepancies, polarity reversals, conflicting numbers, and dates.' },
    { num: '08', name: 'Calibrated Decision Engine', desc: 'Statistically grounded confidence score; enforces abstention policy when ambiguous.' },
    { num: '09', name: 'Audit Report Generator', desc: 'Produce explainable, provenance-linked report with exact quotes and download options.' },
    { num: '10', name: 'Human Review Escalation', desc: 'Route ambiguous or high-risk claims to human experts with permanent audit logging.' },
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Background Glow Accents */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-emerald-500/10 via-teal-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-wider mb-8 animate-fade-in">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Independent AI Verification Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-tight max-w-4xl mx-auto mb-6">
          Never Trust AI Output Without{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400">
            Verifiable Evidence
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed font-normal">
          ELOV independently decomposes AI-generated assertions into checkable factual claims, performs hybrid
          retrieval over trustworthy source documents, detects fabricated citations, and provides calibrated veracity reports.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/verify"
            className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5"
          >
            <ShieldCheck className="w-5 h-5" />
            <span>Start Verification Now</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>

          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-base transition-all hover:-translate-y-0.5"
          >
            <span>View Verification Dashboard</span>
          </Link>
        </div>
      </section>

      {/* Value Pillars */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-12">
          <h2 className="text-xs uppercase tracking-widest font-bold text-emerald-400 mb-2">Architectural Pillars</h2>
          <p className="text-2xl sm:text-3xl font-bold text-white">Why Self-Reported LLM Confidence Fails</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 text-emerald-400">
              <FileSearch className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Atomic Claim Decomposition</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Deconstructs complex paragraphs into checkable factual units. Separates objective claims from unverifiable opinions and predictions.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-5 text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Fabrication & Hallucination Guard</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Validates citations against verified document page bounds and exact text. Exposes fabricated citations vs real-but-irrelevant references.
            </p>
          </div>

          <div className="glass-panel glass-panel-hover p-6 rounded-2xl">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 text-cyan-400">
              <Scale className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Calibrated Abstention Engine</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Never equates semantic similarity with truth. Abstains and routes ambiguous or safety-critical claims to human clinical and legal reviewers.
            </p>
          </div>
        </div>
      </section>

      {/* 10-Step Sequential Pipeline Diagram */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/60">
        <div className="text-center mb-14">
          <span className="text-xs uppercase tracking-widest font-bold text-emerald-400">Sequential Execution Pipeline</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">10-Step End-to-End Verification Flow</h2>
          <p className="text-sm text-slate-400 mt-2 max-w-xl mx-auto">
            From raw AI text and reference documents to fully audited, evidence-backed verification decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {pipelineSteps.map((step) => (
            <div key={step.num} className="glass-panel p-4 rounded-xl border border-slate-800 relative group hover:border-emerald-500/40 transition-all">
              <div className="text-xs font-mono font-bold text-emerald-400 mb-2">{step.num}</div>
              <h4 className="text-sm font-bold text-white mb-1.5">{step.name}</h4>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
