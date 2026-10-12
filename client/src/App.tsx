import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { NewVerificationPage } from './pages/NewVerificationPage';
import { VerificationResultsPage } from './pages/VerificationResultsPage';
import { HumanReviewPage } from './pages/HumanReviewPage';
import { DocumentLibraryPage } from './pages/DocumentLibraryPage';
import { ShieldCheck, Database, GitCommit, Heart } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // 30 seconds
      retry: 1,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100 font-sans">
          <Navbar />

          <main className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/verify" element={<NewVerificationPage />} />
              <Route path="/runs/:id" element={<VerificationResultsPage />} />
              <Route path="/reviews" element={<HumanReviewPage />} />
              <Route path="/documents" element={<DocumentLibraryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800/80 bg-slate-950/60 py-6 text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="font-bold text-slate-300">ELOV</span>
                <span>— Evidence-First LLM Output Verifier</span>
              </div>

              <div className="flex items-center gap-4 text-[11px] font-mono">
                <span className="flex items-center gap-1">
                  <Database className="w-3.5 h-3.5 text-cyan-400" /> PostgreSQL 17 (Prisma)
                </span>
                <span>•</span>
                <span>Hybrid FTS + Vector RAG</span>
                <span>•</span>
                <span>10-Stage Agent Pipeline</span>
              </div>
            </div>
          </footer>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
