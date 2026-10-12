import { prisma } from '../config/db.js';
import { logger } from '../utils/logger.js';

export interface CitationValidationResult {
  citationText: string;
  citedDocumentId?: string;
  citedDocumentTitle?: string;
  citedPage?: number;
  isValid: boolean;
  isFabricated: boolean;
  failureReason?: string;
  exactSourceQuote?: string;
}

export class CitationValidationAgent {
  async validateCitation(
    citationText: string,
    claimText: string,
    citedDocName?: string,
    citedPage?: number
  ): Promise<CitationValidationResult> {
    logger.info(`Validating citation: ${citationText}`);

    // Fetch all documents in library
    const documents = await prisma.document.findMany({
      include: {
        chunks: true,
      },
    });

    if (documents.length === 0) {
      return {
        citationText,
        isValid: false,
        isFabricated: true,
        failureReason: 'Fabricated source: No documents exist in the source registry.',
      };
    }

    // Try to match document by title or filename
    let matchedDoc = documents.find((d) => {
      if (citedDocName) {
        const docNameLower = citedDocName.toLowerCase();
        return (
          d.filename.toLowerCase().includes(docNameLower) ||
          d.title.toLowerCase().includes(docNameLower) ||
          docNameLower.includes(d.filename.toLowerCase()) ||
          docNameLower.includes(d.title.toLowerCase())
        );
      }
      return false;
    });

    // If still unmatched, try matching citation text against document titles
    if (!matchedDoc) {
      const citeLower = citationText.toLowerCase();
      matchedDoc = documents.find(
        (d) =>
          citeLower.includes(d.filename.toLowerCase()) ||
          citeLower.includes(d.title.toLowerCase().replace(/report|guidelines/g, '').trim())
      );
    }

    // If still unmatched and format is numeric like [1] or [Doc 1]
    if (!matchedDoc) {
      const numMatch = citationText.match(/\[(?:Doc\s*)?(\d+)\]/i);
      if (numMatch) {
        const docIdx = parseInt(numMatch[1], 10) - 1;
        if (docIdx >= 0 && docIdx < documents.length) {
          matchedDoc = documents[docIdx];
        }
      }
    }

    // 1. Source does not exist at all -> Fabricated citation
    if (!matchedDoc) {
      return {
        citationText,
        isValid: false,
        isFabricated: true,
        failureReason: `Fabricated citation: Referenced source '${citedDocName || citationText}' does not exist in the verified document registry.`,
      };
    }

    // 2. Check page number validity
    if (citedPage !== undefined && citedPage !== null) {
      if (citedPage <= 0 || citedPage > matchedDoc.pageCount) {
        return {
          citationText,
          citedDocumentId: matchedDoc.id,
          citedDocumentTitle: matchedDoc.title,
          citedPage,
          isValid: false,
          isFabricated: true,
          failureReason: `Fabricated citation: Cited page ${citedPage} exceeds actual document total page count (${matchedDoc.pageCount}) in '${matchedDoc.filename}'.`,
        };
      }
    }

    // 3. Check if the matched document actually mentions or supports the claim concepts
    const claimKeywords = claimText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    // Filter chunks by page if page specified
    const candidateChunks = citedPage
      ? matchedDoc.chunks.filter((c) => c.pageNumber === citedPage)
      : matchedDoc.chunks;

    const chunksToInspect = candidateChunks.length > 0 ? candidateChunks : matchedDoc.chunks;

    let bestMatchingChunk = chunksToInspect[0];
    let maxKeywordMatches = 0;

    for (const chunk of chunksToInspect) {
      const chunkLower = chunk.content.toLowerCase();
      const matches = claimKeywords.filter((k) => chunkLower.includes(k)).length;
      if (matches > maxKeywordMatches) {
        maxKeywordMatches = matches;
        bestMatchingChunk = chunk;
      }
    }

    // If zero keyword match with the claim, it's a real document but irrelevant citation!
    if (maxKeywordMatches < 2 && claimKeywords.length >= 3) {
      return {
        citationText,
        citedDocumentId: matchedDoc.id,
        citedDocumentTitle: matchedDoc.title,
        citedPage,
        isValid: false,
        isFabricated: false, // NOT fabricated (source exists), but IRRELEVANT
        failureReason: `Real citation with irrelevant evidence: '${matchedDoc.filename}' exists, but does not contain factual evidence supporting this claim.`,
      };
    }

    // Valid citation!
    return {
      citationText,
      citedDocumentId: matchedDoc.id,
      citedDocumentTitle: matchedDoc.title,
      citedPage: bestMatchingChunk?.pageNumber || citedPage || 1,
      isValid: true,
      isFabricated: false,
      exactSourceQuote: bestMatchingChunk?.content.slice(0, 160) + '...',
    };
  }
}
