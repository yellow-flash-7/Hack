import { prisma } from '../config/db.js';
import { getAIProvider, cosineSimilarity } from '../ai/provider.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface RetrievedCandidate {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  documentFilename: string;
  pageNumber: number;
  sectionHeading?: string;
  content: string;
  ftsScore: number;
  vectorScore: number;
  hybridScore: number;
}

function stem(word: string): string {
  return word.toLowerCase().replace(/(?:ing|ers|ors|es|s)$/i, '');
}

export class EvidenceRetrievalAgent {
  private provider = getAIProvider();

  async retrieveCandidates(claimText: string, documentIds?: string[], limit = 5): Promise<RetrievedCandidate[]> {
    logger.info(`Retrieving candidates for claim: "${claimText.slice(0, 60)}..."`);
    const claimLower = claimText.toLowerCase();

    // 1. Generate claim vector
    const claimEmbedding = await this.provider.generateEmbedding(claimText);

    // 2. Fetch all eligible chunks from database
    const whereClause: any = {};
    if (documentIds && documentIds.length > 0) {
      whereClause.documentId = { in: documentIds };
    }

    const chunks = await prisma.documentChunk.findMany({
      where: whereClause,
      include: {
        document: {
          select: { id: true, title: true, filename: true },
        },
      },
    });

    if (chunks.length === 0) {
      logger.warn('No document chunks available in library for retrieval.');
      return [];
    }

    // 3. Prepare search tokens with stemming
    const rawTokens = claimText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const searchTokens = rawTokens.map((t) => ({
      original: t,
      stemmed: stem(t),
    }));

    const scored: RetrievedCandidate[] = [];

    for (const chunk of chunks) {
      // Vector score
      const chunkEmbedding = (chunk.embedding as number[]) || [];
      const vectorScore = chunkEmbedding.length > 0
        ? Math.max(0, cosineSimilarity(claimEmbedding, chunkEmbedding))
        : 0;

      // Full-Text / Keyword match score with stemming
      const chunkLower = chunk.content.toLowerCase();
      let matchCount = 0;
      for (const token of searchTokens) {
        if (
          chunkLower.includes(token.original) ||
          (token.stemmed.length >= 3 && chunkLower.includes(token.stemmed))
        ) {
          matchCount++;
        }
      }

      // Check acronym alias: e.g. "angiotensin receptor blocker" <-> "arb"
      if (
        (claimLower.includes('angiotensin') || claimLower.includes('arb')) &&
        (chunkLower.includes('angiotensin') || chunkLower.includes('arb'))
      ) {
        matchCount += 2;
      }
      if (
        claimLower.includes('ace') && chunkLower.includes('ace')
      ) {
        matchCount += 2;
      }

      const ftsScore = searchTokens.length > 0
        ? Math.min(1.0, matchCount / searchTokens.length)
        : 0;

      // Hybrid fusion score (55% vector, 45% keyword)
      const hybridScore = (vectorScore * 0.55) + (ftsScore * 0.45);

      if (hybridScore >= env.MIN_RETRIEVAL_SIMILARITY || ftsScore >= 0.25 || vectorScore >= 0.4) {
        scored.push({
          chunkId: chunk.id,
          documentId: chunk.document.id,
          documentTitle: chunk.document.title,
          documentFilename: chunk.document.filename,
          pageNumber: chunk.pageNumber,
          sectionHeading: chunk.sectionHeading || undefined,
          content: chunk.content,
          ftsScore: Number(ftsScore.toFixed(4)),
          vectorScore: Number(vectorScore.toFixed(4)),
          hybridScore: Number(hybridScore.toFixed(4)),
        });
      }
    }

    // Sort descending by hybridScore
    scored.sort((a, b) => b.hybridScore - a.hybridScore);

    return scored.slice(0, limit);
  }
}
