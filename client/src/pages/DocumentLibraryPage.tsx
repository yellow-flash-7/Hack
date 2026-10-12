import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService } from '../services/api';
import {
  BookOpen,
  Upload,
  Search,
  Trash2,
  FileText,
  Bookmark,
  Layers,
  Link as LinkIcon,
  X,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Document } from '../types';

export const DocumentLibraryPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedDocForChunks, setSelectedDocForChunks] = useState<Document | null>(null);

  // Upload modal state
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [sourceUrl, setSourceUrl] = useState('');
  const [docTitle, setDocTitle] = useState('');

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', searchTerm],
    queryFn: () => apiService.getDocuments(searchTerm || undefined),
  });

  const { data: inspectedDoc, isLoading: chunkLoading } = useQuery({
    queryKey: ['document', selectedDocForChunks?.id],
    queryFn: () => apiService.getDocument(selectedDocForChunks!.id),
    enabled: Boolean(selectedDocForChunks?.id),
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      if (docTitle.trim()) formData.append('title', docTitle.trim());
      if (sourceUrl.trim()) formData.append('sourceUrl', sourceUrl.trim());
      for (const file of uploadFiles) {
        formData.append('files', file);
      }
      return apiService.uploadDocuments(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      setShowUploadModal(false);
      setUploadFiles([]);
      setSourceUrl('');
      setDocTitle('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: apiService.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete "${name}" from the verified library? This will delete all its chunks.`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setUploadFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header & Upload Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-emerald-400" />
            <span>Verified Document Registry</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Ground-truth documents ingested for factual verification, hybrid search, and citation checks.
          </p>
        </div>

        <button
          onClick={() => setShowUploadModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold shadow-md shadow-emerald-500/20 transition-all self-start sm:self-auto"
        >
          <Upload className="w-4 h-4" />
          <span>Upload Document</span>
        </button>
      </div>

      {(uploadMutation.isError || deleteMutation.isError) && (
        <div role="alert" className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm">
          <strong>Action failed:</strong>{' '}
          {((uploadMutation.error || deleteMutation.error) as any)?.response?.data?.error ||
            ((uploadMutation.error || deleteMutation.error) as any)?.message ||
            'The document could not be processed. Check the server and database, then try again.'}
          <button type="button" className="ml-3 underline" onClick={() => { uploadMutation.reset(); deleteMutation.reset(); }}>Dismiss</button>
        </div>
      )}

      {/* Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search documents by title or filename..."
          className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-slate-500"
        />
      </div>

      {/* Document Catalog */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400">Loading document library...</div>
        ) : !documents || documents.length === 0 ? (
          <div className="p-16 text-center">
            <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-200">No Documents Ingested</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Upload PDF or TXT reference materials to enable ground-truth claim verification.
            </p>
            <button
              onClick={() => setShowUploadModal(true)}
              className="px-4 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold"
            >
              Upload First Document
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-5 hover:bg-slate-800/30 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      {doc.title}
                    </h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700">
                      {doc.filename.endsWith('.pdf') ? 'PDF' : doc.filename.endsWith('.docx') ? 'DOCX' : 'TXT'}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {doc.status}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 font-mono truncate">
                    File: {doc.filename}
                  </p>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    <span>{doc.pageCount} Pages</span>
                    <span>•</span>
                    <span>{doc._count?.chunks || doc.chunks?.length || 0} Overlapping Chunks</span>
                    <span>•</span>
                    <span>{Math.round(doc.fileSize / 1024)} KB</span>
                    <span>•</span>
                    <span className="font-mono text-[11px] text-slate-500">
                      Hash: {doc.hash.slice(0, 10)}...
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  <button
                    onClick={() => setSelectedDocForChunks(doc)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-cyan-400" />
                    <span>View Chunks</span>
                  </button>

                  <button
                    onClick={() => handleDelete(doc.id, doc.title)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    title="Delete Document"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-lg p-6 rounded-2xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Upload Reference Documents</span>
              </h3>
              <button
                type="button"
                onClick={() => { if (!uploadMutation.isPending) setShowUploadModal(false); }}
                disabled={uploadMutation.isPending}
                aria-label="Close upload dialog"
                className="text-slate-400 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadMutation.isError && (
              <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs">
                {(uploadMutation.error as any)?.response?.data?.error || (uploadMutation.error as any)?.message || 'Upload failed. Please check the file and server connection.'}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Document Title (Optional)
                </label>
                <input
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="e.g. Clinical Trial 2024 Protocol"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Files (PDF, TXT, DOCX)
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx,.md"
                  onChange={handleFileChange}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:text-white file:font-semibold hover:file:bg-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Or Ingest from URL (Protected by SSRF Guard)
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://example.org/guidelines.txt"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={uploadMutation.isPending || (uploadFiles.length === 0 && !sourceUrl.trim())}
                onClick={() => uploadMutation.mutate()}
                className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-2"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing Chunks...</span>
                  </>
                ) : (
                  <span>Ingest Document</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Document Chunks Modal */}
      {selectedDocForChunks && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-2xl border border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  <span>Document Chunks: {selectedDocForChunks.title}</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedDocForChunks.pageCount} pages • {inspectedDoc?.chunks?.length || 0} indexed chunks
                </p>
              </div>
              <button
                onClick={() => setSelectedDocForChunks(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {chunkLoading ? (
                <div className="p-8 text-center text-slate-500 text-xs">Loading chunk index...</div>
              ) : !inspectedDoc?.chunks || inspectedDoc.chunks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No chunks generated.</div>
              ) : (
                inspectedDoc.chunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between text-slate-400">
                      <div className="flex items-center gap-2 font-mono">
                        <span className="font-bold text-emerald-400">Chunk #{chunk.chunkIndex + 1}</span>
                        <span>• Page {chunk.pageNumber}</span>
                        {chunk.sectionHeading && (
                          <span className="text-slate-300 italic font-sans">
                            ({chunk.sectionHeading})
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {chunk.charCount} chars • ~{chunk.tokenCount} tokens
                      </span>
                    </div>

                    <p className="text-slate-200 font-serif leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                      {chunk.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setSelectedDocForChunks(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
