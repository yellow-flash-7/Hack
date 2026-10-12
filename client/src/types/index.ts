export type Role = 'ADMIN' | 'REVIEWER' | 'AUDITOR' | 'VIEWER';
export type DocumentStatus = 'PROCESSING' | 'READY' | 'FAILED';
export type VerificationMode = 'STRICT' | 'BALANCED' | 'EXPLORATORY';
export type ClaimType = 'FACTUAL' | 'OPINION' | 'RECOMMENDATION' | 'PREDICTION' | 'UNVERIFIABLE';
export type ClaimImportance = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ClaimStatus =
  | 'PENDING'
  | 'SUPPORTED'
  | 'CONTRADICTED'
  | 'PARTIALLY_SUPPORTED'
  | 'INSUFFICIENT_EVIDENCE'
  | 'NEEDS_REVIEW';
export type NliLabel = 'ENTAILMENT' | 'CONTRADICTION' | 'NEUTRAL';
export type ReviewTaskStatus = 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED' | 'MODIFIED';
export type ReviewPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Document {
  id: string;
  title: string;
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  pageCount: number;
  sourceUrl?: string | null;
  hash: string;
  status: DocumentStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    chunks: number;
  };
  chunks?: DocumentChunk[];
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  pageNumber: number;
  sectionHeading?: string | null;
  content: string;
  charCount: number;
  tokenCount: number;
  createdAt: string;
  document?: Document;
}

export interface Citation {
  id: string;
  verificationRunId: string;
  claimId?: string | null;
  citationText: string;
  citedDocumentId?: string | null;
  citedPage?: number | null;
  isValid: boolean;
  isFabricated: boolean;
  failureReason?: string | null;
  exactSourceQuote?: string | null;
  document?: Document | null;
}

export interface EvidenceItem {
  id: string;
  chunkId: string;
  exactQuote: string;
  relevanceScore: number;
  nliLabel: NliLabel;
  nliConfidence: number;
  reasoning?: string | null;
  chunk?: DocumentChunk;
}

export interface ClaimEvidence {
  id: string;
  claimId: string;
  evidenceItemId: string;
  weight: number;
  evidenceItem: EvidenceItem;
}

export interface VerificationDecision {
  id: string;
  verificationRunId: string;
  claimId: string;
  finalStatus: ClaimStatus;
  calibratedScore: number;
  uncertaintyFactors?: any;
  abstentionReason?: string | null;
  explanation?: string | null;
  contradictionInfo?: {
    type?: string;
    claimedValue?: string;
    sourceValue?: string;
    sourceDocument?: string;
    page?: number;
  } | null;
}

export interface ReviewAction {
  id: string;
  reviewTaskId: string;
  reviewerId?: string | null;
  actionType: 'ACCEPT' | 'REJECT' | 'MODIFY' | 'REQUEST_EVIDENCE';
  previousStatus: ClaimStatus;
  newStatus: ClaimStatus;
  explanation: string;
  correctionText?: string | null;
  createdAt: string;
  reviewer?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export interface ReviewTask {
  id: string;
  verificationRunId: string;
  claimId: string;
  status: ReviewTaskStatus;
  priority: ReviewPriority;
  reason: string;
  createdAt: string;
  resolvedAt?: string | null;
  claim: Claim;
  verificationRun?: {
    id: string;
    title?: string;
    mode: VerificationMode;
    createdAt: string;
  };
  actions?: ReviewAction[];
}

export interface Claim {
  id: string;
  verificationRunId: string;
  claimIndex: number;
  originalText: string;
  normalizedText: string;
  claimType: ClaimType;
  importance: ClaimImportance;
  requiredEvidence?: string | null;
  status: ClaimStatus;
  calibratedScore: number;
  reasoning?: string | null;
  createdAt: string;
  citations?: Citation[];
  evidenceLinks?: ClaimEvidence[];
  verificationDecision?: VerificationDecision | null;
  reviewTask?: ReviewTask | null;
}

export interface VerificationRun {
  id: string;
  title?: string | null;
  rawAnswer: string;
  mode: VerificationMode;
  status: string;
  totalClaims: number;
  supportedCount: number;
  contradictedCount: number;
  partiallySupportedCount: number;
  insufficientCount: number;
  needsReviewCount: number;
  fabricatedCitationCount: number;
  calibratedConfidence: number;
  durationMs: number;
  pipelineVersion: string;
  createdAt: string;
  updatedAt: string;
  claims?: Claim[];
}

export interface DashboardStats {
  totalRuns: number;
  totalDocuments: number;
  totalClaims: number;
  statusCounts: Record<string, number>;
  pendingReviews: number;
  fabricatedCitations: number;
  accuracyRate: number;
}

export interface VerificationReport {
  id: string;
  title?: string;
  status: string;
  overallVerdict: 'VERIFIED' | 'CONTRADICTED' | 'NEEDS_HUMAN_REVIEW' | 'UNVERIFIED';
  executiveSummary: string;
  metrics: {
    totalClaims: number;
    supportedCount: number;
    contradictedCount: number;
    partiallySupportedCount: number;
    insufficientCount: number;
    needsReviewCount: number;
    fabricatedCitationCount: number;
    calibratedConfidence: number;
    durationMs: number;
  };
  claims: Array<{
    claimIndex: number;
    originalText: string;
    normalizedText: string;
    claimType: string;
    importance: string;
    status: string;
    calibratedScore: number;
    explanation?: string;
    abstentionReason?: string;
    contradictionInfo?: any;
    citations: Array<{
      citationText: string;
      isValid: boolean;
      isFabricated: boolean;
      failureReason?: string;
      citedDocumentTitle?: string;
      citedPage?: number;
    }>;
    evidence: Array<{
      documentTitle: string;
      documentFilename: string;
      pageNumber: number;
      sectionHeading?: string;
      exactQuote: string;
      relevanceScore: number;
      nliLabel: string;
      nliConfidence: number;
    }>;
  }>;
  pipelineVersion: string;
  timestamp: string;
}
