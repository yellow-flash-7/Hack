import { getAIProvider, ContradictionDetectionResult } from '../ai/provider.js';
import { EvaluatedEvidenceItem } from './evidenceAnalysisAgent.js';
import { logger } from '../utils/logger.js';

export interface DetailedContradictionReport {
  hasContradiction: boolean;
  type?: 'NUMERICAL' | 'POLARITY' | 'TEMPORAL' | 'INTRA_ANSWER' | 'FACTUAL_STATEMENT';
  claimedValue?: string;
  sourceValue?: string;
  sourceDocument?: string;
  page?: number;
  explanation?: string;
}

export class ContradictionDetectionAgent {
  private provider = getAIProvider();

  async detect(
    claimText: string,
    evidenceItems: EvaluatedEvidenceItem[],
    allClaimsInRun?: string[]
  ): Promise<DetailedContradictionReport> {
    logger.info(`Running ContradictionDetectionAgent for claim: "${claimText.slice(0, 45)}..."`);

    // 1. Evidence-level contradiction check
    const passages = evidenceItems.map((e) => ({
      text: e.exactQuote || '',
      documentTitle: e.documentTitle,
      page: e.pageNumber,
    }));

    const result: ContradictionDetectionResult = await this.provider.detectContradictions(claimText, passages);

    if (result.hasContradiction) {
      const conflictingEvidence = evidenceItems.find((e) => e.nliLabel === 'CONTRADICTION') || evidenceItems[0];
      return {
        hasContradiction: true,
        type: result.contradictionType,
        claimedValue: result.claimedValue,
        sourceValue: result.sourceValue,
        sourceDocument: conflictingEvidence?.documentFilename || conflictingEvidence?.documentTitle,
        page: conflictingEvidence?.pageNumber,
        explanation: result.explanation,
      };
    }

    // 2. Intra-answer contradiction check: does this claim contradict any other claim in the same answer?
    if (allClaimsInRun && allClaimsInRun.length > 1) {
      const claimLower = claimText.toLowerCase();
      const incKeywords = ['increase', 'increased', 'growth', 'rose', 'expansion'];
      const decKeywords = ['decline', 'declined', 'decrease', 'decreased', 'drop'];

      const claimHasInc = incKeywords.some((w) => claimLower.includes(w));
      const claimHasDec = decKeywords.some((w) => claimLower.includes(w));

      for (const otherClaim of allClaimsInRun) {
        if (otherClaim === claimText) continue;
        const otherLower = otherClaim.toLowerCase();

        // Check for shared topic tokens
        const claimTokens = claimLower.split(/\W+/).filter((w) => w.length > 3);
        const otherTokens = otherLower.split(/\W+/).filter((w) => w.length > 3);
        const overlap = claimTokens.filter((t) => otherTokens.includes(t)).length;

        if (overlap >= 2) {
          const otherHasInc = incKeywords.some((w) => otherLower.includes(w));
          const otherHasDec = decKeywords.some((w) => otherLower.includes(w));

          if ((claimHasInc && otherHasDec) || (claimHasDec && otherHasInc)) {
            return {
              hasContradiction: true,
              type: 'INTRA_ANSWER',
              claimedValue: claimText,
              sourceValue: otherClaim,
              explanation: `Internal inconsistency within AI answer: Claim asserts conflicting trajectory compared to another assertion in the same response.`,
            };
          }
        }
      }
    }

    return { hasContradiction: false };
  }
}
