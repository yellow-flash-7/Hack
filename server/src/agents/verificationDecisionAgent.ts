import { ClaimStatus, ClaimImportance, ClaimType, VerificationMode, ReviewPriority } from '@prisma/client';
import { ClaimEvidenceAnalysisResult } from './evidenceAnalysisAgent.js';
import { CitationValidationResult } from './citationValidationAgent.js';
import { DetailedContradictionReport } from './contradictionDetectionAgent.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface FinalVerificationDecision {
  finalStatus: ClaimStatus;
  calibratedScore: number;
  uncertaintyFactors: {
    evidenceRelevance: number;
    nliConfidence: number;
    citationValid: boolean;
    citationFabricated: boolean;
    contradictionDetected: boolean;
    ambiguityMargin: number;
  };
  abstentionReason?: string;
  explanation: string;
  shouldCreateReviewTask: boolean;
  reviewPriority: ReviewPriority;
  contradictionInfo?: any;
}

export class VerificationDecisionAgent {
  decide(params: {
    claimText: string;
    claimType: ClaimType;
    importance: ClaimImportance;
    mode: VerificationMode;
    analysis: ClaimEvidenceAnalysisResult;
    citation?: CitationValidationResult;
    contradiction: DetailedContradictionReport;
  }): FinalVerificationDecision {
    const { claimType, importance, mode, analysis, citation, contradiction } = params;

    logger.info(`Evaluating verification decision for claim importance: ${importance}, mode: ${mode}`);

    const primary = analysis.primaryEvidence;
    const evidenceRelevance = primary ? primary.relevanceScore : 0.0;
    const nliConfidence = primary ? primary.nliConfidence : 0.0;
    const isCitationFabricated = citation?.isFabricated ?? false;
    const isCitationValid = citation?.isValid ?? false;
    const hasContradiction = contradiction.hasContradiction || analysis.hasContradiction;

    // Thresholds by mode
    let supportThreshold = env.SUPPORT_THRESHOLD;
    if (mode === VerificationMode.STRICT) supportThreshold = 0.82;
    if (mode === VerificationMode.EXPLORATORY) supportThreshold = 0.62;

    const uncertaintyFactors = {
      evidenceRelevance,
      nliConfidence,
      citationValid: isCitationValid,
      citationFabricated: isCitationFabricated,
      contradictionDetected: hasContradiction,
      ambiguityMargin: Math.abs(evidenceRelevance - supportThreshold),
    };

    // 1. Clinical / Treatment Recommendations with Contradiction -> Immediate Abstention to Human Review
    if (claimType === ClaimType.RECOMMENDATION && hasContradiction) {
      return {
        finalStatus: ClaimStatus.NEEDS_REVIEW,
        calibratedScore: 0.40,
        uncertaintyFactors,
        abstentionReason: 'Clinical / treatment recommendation directly conflicts with established contraindication guidelines. Automated abstention triggered for physician review.',
        explanation: contradiction.explanation || 'Claim proposes an intervention that conflicts with verified safety guidelines. Mandatory human clinical review required.',
        shouldCreateReviewTask: true,
        reviewPriority: ReviewPriority.CRITICAL,
        contradictionInfo: {
          type: contradiction.type,
          claimedValue: contradiction.claimedValue,
          sourceValue: contradiction.sourceValue,
          sourceDocument: contradiction.sourceDocument,
          page: contradiction.page,
        },
      };
    }

    // 2. HARD FAILURE: Direct Empirical Contradiction Detected
    if (hasContradiction) {
      const calibratedScore = Number((0.05 + Math.random() * 0.1).toFixed(2));
      return {
        finalStatus: ClaimStatus.CONTRADICTED,
        calibratedScore,
        uncertaintyFactors,
        explanation: contradiction.explanation || analysis.overallReasoning || 'Direct empirical contradiction identified against source documentation.',
        shouldCreateReviewTask: importance === ClaimImportance.CRITICAL,
        reviewPriority: ReviewPriority.HIGH,
        contradictionInfo: {
          type: contradiction.type,
          claimedValue: contradiction.claimedValue,
          sourceValue: contradiction.sourceValue,
          sourceDocument: contradiction.sourceDocument,
          page: contradiction.page,
        },
      };
    }

    // 2. HARD FAILURE: Fabricated Citation Marker
    if (isCitationFabricated) {
      const calibratedScore = 0.10;
      return {
        finalStatus: ClaimStatus.CONTRADICTED,
        calibratedScore,
        uncertaintyFactors,
        explanation: citation?.failureReason || 'Fabricated citation detected. AI asserted verification from a non-existent source or page.',
        shouldCreateReviewTask: true,
        reviewPriority: ReviewPriority.HIGH,
      };
    }

    // 3. Clinical / Critical Recommendations requiring Expert Sign-off
    if (claimType === ClaimType.RECOMMENDATION && importance === ClaimImportance.CRITICAL) {
      if (evidenceRelevance < 0.90 || analysis.preliminaryStatus !== ClaimStatus.SUPPORTED) {
        return {
          finalStatus: ClaimStatus.NEEDS_REVIEW,
          calibratedScore: 0.45,
          uncertaintyFactors,
          abstentionReason: 'Clinical / safety recommendation lacks unequivocal verbatim documentation. System abstaining from automated pass.',
          explanation: 'Critical action recommendation flagged for certified specialist sign-off.',
          shouldCreateReviewTask: true,
          reviewPriority: ReviewPriority.CRITICAL,
        };
      }
    }

    // 4. Conflicting sources observed
    if (analysis.conflictingSources) {
      return {
        finalStatus: ClaimStatus.NEEDS_REVIEW,
        calibratedScore: 0.50,
        uncertaintyFactors,
        abstentionReason: 'Conflicting source documents: Entailment and contradiction discovered across independent reference files.',
        explanation: 'Contradictory findings across source documents require human arbitration.',
        shouldCreateReviewTask: true,
        reviewPriority: ReviewPriority.HIGH,
      };
    }

    // 5. Insufficient Evidence
    if (analysis.preliminaryStatus === ClaimStatus.INSUFFICIENT_EVIDENCE || evidenceRelevance < env.MIN_RETRIEVAL_SIMILARITY) {
      return {
        finalStatus: ClaimStatus.INSUFFICIENT_EVIDENCE,
        calibratedScore: 0.20,
        uncertaintyFactors,
        abstentionReason: 'No relevant evidence passages found in verified library.',
        explanation: 'The claim cannot be verified because no matching factual passages exist in reference documents.',
        shouldCreateReviewTask: importance === ClaimImportance.CRITICAL,
        reviewPriority: ReviewPriority.MEDIUM,
      };
    }

    // 6. Supported
    if (analysis.preliminaryStatus === ClaimStatus.SUPPORTED && evidenceRelevance >= supportThreshold) {
      const calibratedScore = Number(Math.min(0.99, (evidenceRelevance * 0.6 + nliConfidence * 0.4)).toFixed(2));
      return {
        finalStatus: ClaimStatus.SUPPORTED,
        calibratedScore,
        uncertaintyFactors,
        explanation: analysis.overallReasoning || 'Verifiable statement substantiated by authoritative reference documents with high confidence.',
        shouldCreateReviewTask: false,
        reviewPriority: ReviewPriority.LOW,
      };
    }

    // 7. Partially Supported
    const calibratedScore = Number((0.50 + evidenceRelevance * 0.25).toFixed(2));
    return {
      finalStatus: ClaimStatus.PARTIALLY_SUPPORTED,
      calibratedScore,
      uncertaintyFactors,
      explanation: analysis.overallReasoning || 'Partial topical alignment found, but complete factual assertion is not fully entailed.',
      shouldCreateReviewTask: importance === ClaimImportance.HIGH || importance === ClaimImportance.CRITICAL,
      reviewPriority: ReviewPriority.MEDIUM,
    };
  }
}
