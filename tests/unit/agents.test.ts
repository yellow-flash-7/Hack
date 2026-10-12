import { describe, it, expect } from 'vitest';
import { ClaimExtractionAgent } from '../../server/src/agents/claimExtractionAgent.js';
import { CitationValidationAgent } from '../../server/src/agents/citationValidationAgent.js';
import { ContradictionDetectionAgent } from '../../server/src/agents/contradictionDetectionAgent.js';
import { isPrivateIp } from '../../server/src/utils/ssrfGuard.js';
import { chunkPlainText } from '../../server/src/utils/textChunker.js';

describe('ELOV Unit Tests: Agent Pipeline & Core Logic', () => {
  const claimExtractor = new ClaimExtractionAgent();
  const citationValidator = new CitationValidationAgent();
  const contradictionDetector = new ContradictionDetectionAgent();

  it('SSRF Guard: correctly identifies private vs public IP addresses', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.0.0.5')).toBe(true);
    expect(isPrivateIp('192.168.1.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true);
    expect(isPrivateIp('172.20.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('104.244.42.1')).toBe(false);
  });

  it('Text Chunker: chunks text while preserving boundaries and calculating tokens', () => {
    const text = 'Paragraph 1 with sufficient length for testing.\n\nParagraph 2 introducing secondary topics.\n\nParagraph 3.';
    const chunks = chunkPlainText(text, 50, 10);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
    expect(chunks[0].charCount).toBeGreaterThan(0);
  });

  it('Claim Extraction Agent: decomposes text into checkable factual claims and detects inline citations', async () => {
    const answer = 'Solar capacity grew by 32% in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1]. I believe renewable power will be ubiquitous soon.';
    const claims = await claimExtractor.execute(answer);

    expect(claims.length).toBe(2);
    expect(claims[0].claimType).toBe('FACTUAL');
    expect(claims[0].extractedCitation).toBe('[Clean_Energy_Transition_Report_2024.pdf, p. 1]');
    expect(claims[0].citedPage).toBe(1);
    expect(claims[1].claimType).toBe('OPINION');
  });

  it('Citation Validation Agent: detects fabricated citations with non-existent pages', async () => {
    const result = await citationValidator.validateCitation(
      '[Clean_Energy_Transition_Report_2024.pdf, p. 99]',
      'Solar energy expanded rapidly',
      'Clean_Energy_Transition_Report_2024.pdf',
      99
    );

    expect(result.isValid).toBe(false);
    expect(result.isFabricated).toBe(true);
    expect(result.failureReason).toContain('exceeds actual document total page count');
  });

  it('Contradiction Detection Agent: detects intra-answer directional contradictions', async () => {
    const claim = 'Global solar deployment experienced severe decline in 2023.';
    const allClaims = [
      'Global solar deployment experienced severe decline in 2023.',
      'Global solar deployment experienced tremendous growth in 2023.',
    ];

    const result = await contradictionDetector.detect(claim, [], allClaims);
    expect(result.hasContradiction).toBe(true);
    expect(result.type).toBe('INTRA_ANSWER');
  });
});
