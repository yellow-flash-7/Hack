import { getAIProvider, ExtractedClaimRaw } from '../ai/provider.js';
import { logger } from '../utils/logger.js';

export interface ProcessedClaimItem extends ExtractedClaimRaw {
  claimIndex: number;
  requiredEvidence: string;
}

export class ClaimExtractionAgent {
  private provider = getAIProvider();

  async execute(answerText: string): Promise<ProcessedClaimItem[]> {
    logger.info('Executing ClaimExtractionAgent on answer text...');
    const rawClaims = await this.provider.extractClaims(answerText);

    return rawClaims.map((claim, idx) => {
      // Derive required evidence key concepts
      const keywords = claim.normalizedText
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter((w) => w.length > 3 && !['this', 'that', 'with', 'from', 'have', 'were', 'been', 'which'].includes(w));

      return {
        ...claim,
        claimIndex: idx + 1,
        requiredEvidence: keywords.slice(0, 8).join(', '),
      };
    });
  }
}
