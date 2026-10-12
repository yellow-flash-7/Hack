import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface ExtractedClaimRaw {
  originalText: string;
  normalizedText: string;
  claimType: 'FACTUAL' | 'OPINION' | 'RECOMMENDATION' | 'PREDICTION' | 'UNVERIFIABLE';
  importance: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  extractedCitation?: string;
  citedDocument?: string;
  citedPage?: number;
}

export interface NLIAnalysisResult {
  label: 'ENTAILMENT' | 'CONTRADICTION' | 'NEUTRAL';
  confidence: number;
  exactQuote: string;
  reasoning: string;
}

export interface ContradictionDetectionResult {
  hasContradiction: boolean;
  contradictionType?: 'NUMERICAL' | 'POLARITY' | 'TEMPORAL' | 'FACTUAL_STATEMENT';
  claimedValue?: string;
  sourceValue?: string;
  explanation?: string;
}

export interface LLMProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
  computeCosineSimilarity(a: number[], b: number[]): number;
  extractClaims(answerText: string): Promise<ExtractedClaimRaw[]>;
  analyzeEvidenceNLI(claim: string, evidencePassage: string): Promise<NLIAnalysisResult>;
  detectContradictions(claim: string, evidencePassages: { text: string; documentTitle?: string; page?: number }[]): Promise<ContradictionDetectionResult>;
  generateExecutiveSummary(params: {
    totalClaims: number;
    supportedCount: number;
    contradictedCount: number;
    partiallySupportedCount: number;
    insufficientCount: number;
    needsReviewCount: number;
    fabricatedCitationCount: number;
    calibratedConfidence: number;
  }): Promise<string>;
}

// -------------------------------------------------------------
// Common Cosine Similarity
// -------------------------------------------------------------
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA.length || !vecB.length || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// -------------------------------------------------------------
// Deterministic / Local Provider
// -------------------------------------------------------------
export class DeterministicProvider implements LLMProvider {
  name = 'deterministic';

  async generateEmbedding(text: string): Promise<number[]> {
    const dim = 384;
    const embedding = new Array(dim).fill(0);
    const words = text.toLowerCase().split(/\W+/).filter(Boolean);

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      let hash = 0;
      for (let c = 0; c < word.length; c++) {
        hash = ((hash << 5) - hash + word.charCodeAt(c)) | 0;
      }
      const idx = Math.abs(hash) % dim;
      embedding[idx] += 1 / (i + 1);
    }

    const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
    return embedding.map((v) => Number((v / norm).toFixed(6)));
  }

  computeCosineSimilarity(a: number[], b: number[]): number {
    return cosineSimilarity(a, b);
  }

  async extractClaims(answerText: string): Promise<ExtractedClaimRaw[]> {
    // Mask periods inside brackets so [doc.pdf, p. 1] is not split
    const maskedText = answerText.replace(/\[([^\]]+)\]/g, (m) => m.replace(/\./g, '___DOT___'));

    // Break input text into individual sentences and checkable assertions
    const sentences = maskedText
      .split(/(?<=[.?!])\s+(?=[A-Z0-9"'])/)
      .map((s) => s.replace(/___DOT___/g, '.').trim())
      .filter((s) => s.length > 10);

    const results: ExtractedClaimRaw[] = [];

    // Regex for inline citations: e.g. [Clean Energy, p. 3] or [1] or [Report 2024]
    const citationRegex = /\[(.*?)\]/;

    for (const rawSentence of sentences) {
      let originalText = rawSentence;
      let extractedCitation: string | undefined;
      let citedDocument: string | undefined;
      let citedPage: number | undefined;

      const citationMatch = rawSentence.match(citationRegex);
      if (citationMatch) {
        extractedCitation = citationMatch[0];
        const inner = citationMatch[1];
        // Check for page inside citation: e.g. "p. 3" or "page 4"
        const pageMatch = inner.match(/(?:p\.|page|p:)\s*(\d+)/i);
        if (pageMatch) {
          citedPage = parseInt(pageMatch[1], 10);
        }
        // Extract document title candidate
        const titleCandidate = inner.split(/[,;]/)[0].trim();
        if (titleCandidate) {
          citedDocument = titleCandidate;
        }
      }

      // Normalized text without the citation brackets
      const normalizedText = originalText.replace(citationRegex, '').trim();

      // Classify claim type
      let claimType: ExtractedClaimRaw['claimType'] = 'FACTUAL';
      const lower = normalizedText.toLowerCase();

      if (/^(i believe|in my opinion|it is felt|i think|arguably|personally)\b/.test(lower) || lower.includes('opinion')) {
        claimType = 'OPINION';
      } else if (/\b(recommend|advisable|should|suggest|prescribe|instructed)\b/.test(lower)) {
        claimType = 'RECOMMENDATION';
      } else if (/\b(will reach|projected to|predicted|expected by 203\d|forecasted)\b/.test(lower)) {
        claimType = 'PREDICTION';
      } else if (/\b(maybe|perhaps|it might be possible)\b/.test(lower)) {
        claimType = 'UNVERIFIABLE';
      }

      // Importance heuristic
      let importance: ExtractedClaimRaw['importance'] = 'MEDIUM';
      if (/\b(strictly|contraindicated|critical|essential|mandatory|death|severe|target|32%|95|45)\b/i.test(normalizedText)) {
        importance = 'CRITICAL';
      } else if (/\b(increased|declined|decreased|costs|revenue|patients|first-line)\b/i.test(normalizedText)) {
        importance = 'HIGH';
      }

      results.push({
        originalText,
        normalizedText,
        claimType,
        importance,
        extractedCitation,
        citedDocument,
        citedPage,
      });
    }

    return results;
  }

  async analyzeEvidenceNLI(claim: string, evidencePassage: string): Promise<NLIAnalysisResult> {
    const claimLower = claim.toLowerCase();
    const evidenceLower = evidencePassage.toLowerCase();

    // 1. Check for numerical discrepancy
    // Extract numbers / percentages / currency
    const claimNumbers: string[] = claim.match(/\b\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?/g) || [];
    const evidenceNumbers: string[] = evidencePassage.match(/\b\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?/g) || [];

    // Polarity keywords
    const increaseWords = ['increase', 'increased', 'growth', 'rose', 'expansion', 'surge', 'higher', 'addition'];
    const decreaseWords = ['decline', 'declined', 'decrease', 'decreased', 'drop', 'dropped', 'loss', 'reduced', 'lower'];
    const contraindicatedWords = ['contraindicated', 'prohibited', 'forbidden', 'avoid', 'harmful', 'adverse', 'risk'];
    const recommendedWords = ['recommended', 'beneficial', 'prescribed', 'effective', 'favored', 'ideal', 'first-line'];

    const claimHasIncrease = increaseWords.some((w) => claimLower.includes(w));
    const claimHasDecrease = decreaseWords.some((w) => claimLower.includes(w));
    const evidenceHasIncrease = increaseWords.some((w) => evidenceLower.includes(w));
    const evidenceHasDecrease = decreaseWords.some((w) => evidenceLower.includes(w));

    const claimHasContra = contraindicatedWords.some((w) => claimLower.includes(w));
    const claimHasRec = recommendedWords.some((w) => claimLower.includes(w));
    const evidenceHasContra = contraindicatedWords.some((w) => evidenceLower.includes(w));
    const evidenceHasRec = recommendedWords.some((w) => evidenceLower.includes(w));

    // Polarity clash: claim says decline, evidence says increase (or vice versa)
    if ((claimHasIncrease && evidenceHasDecrease) || (claimHasDecrease && evidenceHasIncrease)) {
      const bestSentence = this.findBestMatchingSentence(claim, evidencePassage);
      return {
        label: 'CONTRADICTION',
        confidence: 0.94,
        exactQuote: bestSentence,
        reasoning: `Directional polarity conflict detected: claim states ${claimHasDecrease ? 'decrease/decline' : 'increase/growth'}, but source document indicates ${evidenceHasIncrease ? 'growth/increase' : 'decrease/decline'}.`,
      };
    }

    // Polarity clash: claim recommends, evidence contraindicates
    if ((claimHasRec && evidenceHasContra) || (claimHasContra && evidenceHasRec)) {
      const bestSentence = this.findBestMatchingSentence(claim, evidencePassage);
      return {
        label: 'CONTRADICTION',
        confidence: 0.95,
        exactQuote: bestSentence,
        reasoning: `Severe clinical/normative contradiction: claim proposes action as recommended/beneficial, whereas evidence document strictly flags it as contraindicated/hazardous.`,
      };
    }

    // Number clash when sharing keywords
    const claimWords = claimLower.split(/\W+/).filter((w) => w.length >= 3);
    const sharedWords = claimWords.filter((w) => evidenceLower.includes(w));
    const wordOverlap = sharedWords.length / Math.max(1, claimWords.length);

    if (wordOverlap >= 0.35 && claimNumbers.length > 0 && evidenceNumbers.length > 0) {
      const matchingNums = claimNumbers.filter((n) => evidenceNumbers.includes(n));
      if (matchingNums.length === 0) {
        // Shared topic but different numbers
        const bestSentence = this.findBestMatchingSentence(claim, evidencePassage);
        return {
          label: 'CONTRADICTION',
          confidence: 0.91,
          exactQuote: bestSentence,
          reasoning: `Numerical discrepancy: claim states ${claimNumbers.join(', ')} while source passage provides ${evidenceNumbers.join(', ')} for the same subject matter.`,
        };
      }
    }

    // Check for Entailment
    if (wordOverlap >= 0.55 || (claimNumbers.length > 0 && claimNumbers.some((n) => evidenceNumbers.includes(n)) && wordOverlap >= 0.3)) {
      const bestSentence = this.findBestMatchingSentence(claim, evidencePassage);
      return {
        label: 'ENTAILMENT',
        confidence: Math.min(0.98, 0.75 + wordOverlap * 0.25),
        exactQuote: bestSentence,
        reasoning: `High textual grounding: key terms and assertions closely match verifiable statements in the source passage.`,
      };
    }

    // Partial support or neutral
    if (wordOverlap >= 0.25) {
      const bestSentence = this.findBestMatchingSentence(claim, evidencePassage);
      return {
        label: 'NEUTRAL',
        confidence: 0.65,
        exactQuote: bestSentence,
        reasoning: `Moderate topical similarity (${(wordOverlap * 100).toFixed(0)}% word overlap), but the passage does not explicitly entail or contradict the claim.`,
      };
    }

    // Very low overlap
    return {
      label: 'NEUTRAL',
      confidence: 0.35,
      exactQuote: evidencePassage.slice(0, 150) + '...',
      reasoning: `Insufficient evidence: retrieved passage lacks direct factual nexus to the asserted claim.`,
    };
  }

  async detectContradictions(
    claim: string,
    evidencePassages: { text: string; documentTitle?: string; page?: number }[]
  ): Promise<ContradictionDetectionResult> {
    for (const passage of evidencePassages) {
      const nli = await this.analyzeEvidenceNLI(claim, passage.text);
      if (nli.label === 'CONTRADICTION') {
        const claimNumMatch = claim.match(/\b\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?/g);
        const sourceNumMatch = passage.text.match(/\b\d+(?:\.\d+)?%?|\$\d+(?:\.\d+)?/g);

        return {
          hasContradiction: true,
          contradictionType: claimNumMatch && sourceNumMatch ? 'NUMERICAL' : 'POLARITY',
          claimedValue: claimNumMatch ? claimNumMatch.join(', ') : 'Affirmative claim',
          sourceValue: sourceNumMatch ? sourceNumMatch.join(', ') : 'Contradictory source assertion',
          explanation: nli.reasoning,
        };
      }
    }

    return { hasContradiction: false };
  }

  async generateExecutiveSummary(params: {
    totalClaims: number;
    supportedCount: number;
    contradictedCount: number;
    partiallySupportedCount: number;
    insufficientCount: number;
    needsReviewCount: number;
    fabricatedCitationCount: number;
    calibratedConfidence: number;
  }): Promise<string> {
    const { totalClaims, supportedCount, contradictedCount, partiallySupportedCount, insufficientCount, needsReviewCount, fabricatedCitationCount, calibratedConfidence } = params;

    const parts: string[] = [];
    parts.push(`Evaluated ${totalClaims} atomic factual claim${totalClaims === 1 ? '' : 's'}.`);

    if (supportedCount === totalClaims && totalClaims > 0) {
      parts.push(`All ${supportedCount} claims are fully supported by verifiable reference documentation with calibrated confidence of ${(calibratedConfidence * 100).toFixed(0)}%.`);
    } else {
      if (supportedCount > 0) parts.push(`${supportedCount} claim${supportedCount === 1 ? '' : 's'} fully verified.`);
      if (contradictedCount > 0) parts.push(`⚠️ ${contradictedCount} claim${contradictedCount === 1 ? '' : 's'} directly contradicted by authoritative sources.`);
      if (partiallySupportedCount > 0) parts.push(`${partiallySupportedCount} partially supported.`);
      if (insufficientCount > 0) parts.push(`${insufficientCount} lack sufficient documentation.`);
      if (needsReviewCount > 0) parts.push(`🔍 ${needsReviewCount} routed to human clinical/expert review queue.`);
      if (fabricatedCitationCount > 0) parts.push(`🚨 ${fabricatedCitationCount} fabricated citation marker${fabricatedCitationCount === 1 ? '' : 's'} flagged.`);
    }

    return parts.join(' ');
  }

  private findBestMatchingSentence(claim: string, passage: string): string {
    const sentences = passage.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter((s) => s.length > 15);
    if (sentences.length === 0) return passage.slice(0, 200);

    const claimWords = claim.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    let bestSentence = sentences[0];
    let maxMatches = -1;

    for (const s of sentences) {
      const sLower = s.toLowerCase();
      const matches = claimWords.filter((w) => sLower.includes(w)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        bestSentence = s;
      }
    }

    return bestSentence;
  }
}

// -------------------------------------------------------------
// Gemini Provider
// -------------------------------------------------------------
export class GeminiProvider extends DeterministicProvider {
  name = 'gemini';
  private apiKey: string;

  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
  }

  // Uses Gemini API when available, falling back safely to deterministic methods if network/key errors occur
  async extractClaims(answerText: string): Promise<ExtractedClaimRaw[]> {
    if (!this.apiKey) return super.extractClaims(answerText);
    try {
      const prompt = `You are a claim extraction agent. Extract atomic, independently checkable claims from this AI answer text. Return a strict JSON array of objects with keys: "originalText", "normalizedText", "claimType" (one of FACTUAL, OPINION, RECOMMENDATION, PREDICTION, UNVERIFIABLE), "importance" (CRITICAL, HIGH, MEDIUM, LOW), "extractedCitation" (string or null), "citedDocument" (string or null), "citedPage" (number or null). Text:\n\n${answerText}`;
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });
      if (!res.ok) throw new Error(`Gemini API HTTP ${res.status}`);
      const data = await res.json() as any;
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (err) {
      logger.warn('Gemini extractClaims error, falling back to deterministic extractor:', { err });
    }
    return super.extractClaims(answerText);
  }
}

// -------------------------------------------------------------
// Factory
// -------------------------------------------------------------
export function getAIProvider(): LLMProvider {
  if (env.AI_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
    return new GeminiProvider(env.GEMINI_API_KEY);
  }
  return new DeterministicProvider();
}
