import axios from 'axios';
import {
  VerificationRun,
  VerificationReport,
  Document,
  ReviewTask,
  DashboardStats,
  ClaimStatus,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Stats
  async getStats(): Promise<DashboardStats> {
    const res = await api.get('/stats');
    return res.data.data;
  },

  // Verification Runs
  async getVerificationRuns(page = 1, limit = 20): Promise<{ runs: VerificationRun[]; total: number; totalPages: number }> {
    const res = await api.get(`/verification-runs?page=${page}&limit=${limit}`);
    return {
      runs: res.data.data,
      total: res.data.pagination.total,
      totalPages: res.data.pagination.totalPages,
    };
  },

  async getVerificationRun(id: string): Promise<VerificationRun> {
    const res = await api.get(`/verification-runs/${id}`);
    return res.data.data;
  },

  async getVerificationReport(id: string): Promise<VerificationReport> {
    const res = await api.get(`/verification-runs/${id}/report`);
    return res.data.data;
  },

  async createVerificationRun(formData: FormData): Promise<{ run: VerificationRun; report: VerificationReport }> {
    const res = await api.post('/verification-runs', formData);
    return res.data.data;
  },

  async deleteVerificationRun(id: string): Promise<void> {
    await api.delete(`/verification-runs/${id}`);
  },

  // Documents
  async getDocuments(search?: string): Promise<Document[]> {
    const res = await api.get('/documents', { params: { search } });
    return res.data.data;
  },

  async getDocument(id: string): Promise<Document> {
    const res = await api.get(`/documents/${id}`);
    return res.data.data;
  },

  async uploadDocuments(formData: FormData): Promise<Document[]> {
    const res = await api.post('/documents', formData);
    return res.data.data;
  },

  async deleteDocument(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },

  // Human Reviews
  async getReviews(status?: string): Promise<ReviewTask[]> {
    const res = await api.get('/reviews', { params: { status } });
    return res.data.data;
  },

  async submitReviewDecision(
    reviewId: string,
    decision: {
      actionType: 'ACCEPT' | 'REJECT' | 'MODIFY' | 'REQUEST_EVIDENCE';
      newStatus: ClaimStatus;
      explanation: string;
      correctionText?: string;
      reviewerName?: string;
    }
  ): Promise<{ task: ReviewTask; action: any }> {
    const res = await api.post(`/reviews/${reviewId}/decision`, decision);
    return res.data.data;
  },

  // Audit Logs
  async getAuditLogs(limit = 50): Promise<any[]> {
    const res = await api.get('/audit-logs', { params: { limit } });
    return res.data.data;
  },

  // Health Check
  async getHealth(): Promise<any> {
    const res = await api.get('/health');
    return res.data;
  },
};
