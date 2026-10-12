import { getAIProvider } from '../ai/provider.js';
import { RetrievedCandidate } from './evidenceRetrievalAgent.js';
import { ClaimStatus, NliLabel } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface EvaluatedEvidenceItem {
  chunkId: string;
  documentTitle: string;
  documentFilename: string;
  pageNumber: number;
  sectionHeading?: string;
  exactQuote: string;
  relevanceScore: number;
  nliLabel: NliLabel;
  nliConfidence: number;
  reasoning: string;
}

export interface ClaimEvidenceAnalysisResult {
  preliminaryStatus: ClaimStatus;
  primaryEvidence?: EvaluatedEvidenceItem;
  allEvidence: EvaluatedEvidenceItem[];
  hasContradiction: boolean;
  hasEntailment: boolean;
  conflictingSources: boolean;
  overallReasoning: string;
}

export class EvidenceAnalysisAgent {
  private provider = getAIProvider();

  async analyzeClaimEvidence(
    claimText: string,
    candidates: RetrievedCandidate[]
  ): Promise<ClaimEvidenceAnalysisResult> {
    logger.info(`Analyzing evidence for claim: "${claimText.slice(0, 50)}..." against ${candidates.length} candidate(s).`);

    if (candidates.length === 0) {
      return {
        preliminaryStatus: ClaimStatus.INSUFFICIENT_EVIDENCE,
        allEvidence: [],
        hasContradiction: false,
        hasEntailment: false,
        conflictingSources: false,
        overallReasoning: 'No relevant evidence passages found in reference documents.',
      };
    }

    const evaluatedItems: EvaluatedEvidenceItem[] = [];
    let entailmentCount = 0;
    let contradictionCount = 0;

    for (const c of candidates) {
      const nli = await this.provider.analyzeEvidenceNLI(claimText, c.content);

      let label: NliLabel = NliLabel.NEUTRAL;
      if (nli.label === 'ENTAILMENT') {
        label = NliLabel.ENTAILMENT;
        entailmentCount++;
      } else if (nli.label === 'CONTRADICTION') {
        label = NliLabel.CONTRADICTION;
        contradictionCount++;
      }

      evaluatedItems.push({
        chunkId: c.chunkId,
        documentTitle: c.documentTitle,
        documentFilename: c.documentFilename,
        pageNumber: c.pageNumber,
        sectionHeading: c.sectionHeading,
        exactQuote: nli.exactQuote,
        relevanceScore: c.hybridScore,
        nliLabel: label,
        nliConfidence: nli.confidence,
        reasoning: nli.reasoning,
      });
    }

    // Determine status
    const hasContradiction = contradictionCount > 0;
    const hasEntailment = entailmentCount > 0;
    const conflictingSources = hasContradiction && hasEntailment;

    let preliminaryStatus: ClaimStatus = ClaimStatus.INSUFFICIENT_EVIDENCE;
    let primaryEvidence: EvaluatedEvidenceItem | undefined = evaluatedItems[0];
    let overallReasoning = '';

    if (conflictingSources) {
      preliminaryStatus = ClaimStatus.NEEDS_REVIEW;
      overallReasoning = 'Conflicting evidence: One source entails the assertion while another contradicts it. Human escalation required.';
    } else if (hasContradiction) {
      preliminaryStatus = ClaimStatus.CONTRADICTED;
      primaryEvidence = evaluatedItems.find((e) => e.nliLabel === NliLabel.CONTRADICTION) || evaluatedItems[0];
      overallReasoning = primaryEvidence.reasoning;
    } else if (hasEntailment) {
      primaryEvidence = evaluatedItems.find((e) => e.nliLabel === NliLabel.ENTAILMENT) || evaluatedItems[0];
      if (primaryEvidence.relevanceScore >= 0.70 && primaryEvidence.nliConfidence >= 0.75) {
        preliminaryStatus = ClaimStatus.SUPPORTED;
        overallReasoning = primaryEvidence.reasoning;
      } else {
        preliminaryStatus = ClaimStatus.PARTIALLY_SUPPORTED;
        overallReasoning = 'Partial entailment: Source supports general proposition but lacks verbatim full-scope confirmation.';
      }
    } else {
      // Neutral items only
      if (evaluatedItems[0].relevanceScore >= 0.50) {
        preliminaryStatus = ClaimStatus.PARTIALLY_SUPPORTED;
        overallReasoning = 'Topically aligned source passages identified, but precise assertion not explicitly verified.';
      } else {
        preliminaryStatus = ClaimStatus.INSUFFICIENT_EVIDENCE;
        overallReasoning = 'Retrieved source passages do not substantiate the claim with adequate confidence.';
      }
    }

    return {
      preliminaryStatus,
      primaryEvidence,
      allEvidence: evaluatedItems,
      hasContradiction,
      hasEntailment,
      conflictingSources,
      overallReasoning,
    };
  }
}
