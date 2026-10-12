import { getAIProvider } from '../ai/provider.js';
import { VerificationRun, Claim, Citation, VerificationDecision, EvidenceItem, DocumentChunk, Document } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface FormattedReport {
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
    contradictionInfo?: any;
  }>;
  pipelineVersion: string;
  timestamp: string;
}

export class ReportGenerationAgent {
  private provider = getAIProvider();

  async generate(run: any): Promise<FormattedReport> {
    logger.info(`Compiling verification report for run: ${run.id}`);

    const {
      id,
      title,
      status,
      totalClaims,
      supportedCount,
      contradictedCount,
      partiallySupportedCount,
      insufficientCount,
      needsReviewCount,
      fabricatedCitationCount,
      calibratedConfidence,
      pipelineVersion,
      durationMs,
      createdAt,
      claims = [],
    } = run;

    // Overall verdict
    let overallVerdict: FormattedReport['overallVerdict'] = 'VERIFIED';
    if (contradictedCount > 0 || fabricatedCitationCount > 0) {
      overallVerdict = 'CONTRADICTED';
    } else if (needsReviewCount > 0) {
      overallVerdict = 'NEEDS_HUMAN_REVIEW';
    } else if (supportedCount === 0 && totalClaims > 0) {
      overallVerdict = 'UNVERIFIED';
    }

    const executiveSummary = await this.provider.generateExecutiveSummary({
      totalClaims,
      supportedCount,
      contradictedCount,
      partiallySupportedCount,
      insufficientCount,
      needsReviewCount,
      fabricatedCitationCount,
      calibratedConfidence,
    });

    const formattedClaims = claims.map((c: any) => {
      const decision = c.verificationDecision;
      const citations = (c.citations || []).map((cit: any) => ({
        citationText: cit.citationText,
        isValid: cit.isValid,
        isFabricated: cit.isFabricated,
        failureReason: cit.failureReason || undefined,
        citedDocumentTitle: cit.document?.title,
        citedPage: cit.citedPage || undefined,
      }));

      const evidence = (c.evidenceLinks || []).map((link: any) => {
        const item = link.evidenceItem;
        const chunk = item?.chunk;
        const doc = chunk?.document;

        return {
          documentTitle: doc?.title || 'Unknown Document',
          documentFilename: doc?.filename || 'unknown.pdf',
          pageNumber: chunk?.pageNumber || 1,
          sectionHeading: chunk?.sectionHeading || undefined,
          exactQuote: item?.exactQuote || chunk?.content || '',
          relevanceScore: item?.relevanceScore || 0,
          nliLabel: item?.nliLabel || 'NEUTRAL',
          nliConfidence: item?.nliConfidence || 0,
        };
      });

      return {
        claimIndex: c.claimIndex,
        originalText: c.originalText,
        normalizedText: c.normalizedText,
        claimType: c.claimType,
        importance: c.importance,
        status: decision?.finalStatus || c.status,
        calibratedScore: decision?.calibratedScore ?? c.calibratedScore,
        explanation: decision?.explanation || c.reasoning,
        abstentionReason: decision?.abstentionReason || undefined,
        contradictionInfo: decision?.contradictionInfo || undefined,
        citations,
        evidence,
      };
    });

    return {
      id,
      title: title || 'Verification Run',
      status,
      overallVerdict,
      executiveSummary,
      metrics: {
        totalClaims,
        supportedCount,
        contradictedCount,
        partiallySupportedCount,
        insufficientCount,
        needsReviewCount,
        fabricatedCitationCount,
        calibratedConfidence,
        durationMs,
      },
      claims: formattedClaims,
      pipelineVersion: pipelineVersion || '1.0.0',
      timestamp: (createdAt || new Date()).toISOString(),
    };
  }
}
