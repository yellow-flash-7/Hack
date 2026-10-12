import { prisma } from '../config/db.js';
import { ClaimExtractionAgent } from '../agents/claimExtractionAgent.js';
import { DocumentProcessingAgent, IngestDocumentInput } from '../agents/documentProcessingAgent.js';
import { EvidenceRetrievalAgent } from '../agents/evidenceRetrievalAgent.js';
import { CitationValidationAgent } from '../agents/citationValidationAgent.js';
import { EvidenceAnalysisAgent } from '../agents/evidenceAnalysisAgent.js';
import { ContradictionDetectionAgent } from '../agents/contradictionDetectionAgent.js';
import { VerificationDecisionAgent } from '../agents/verificationDecisionAgent.js';
import { ReportGenerationAgent } from '../agents/reportGenerationAgent.js';
import { VerificationMode, ClaimStatus, ClaimType, ClaimImportance, ReviewTaskStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

export interface ExecutePipelineOptions {
  title?: string;
  rawAnswer: string;
  mode?: VerificationMode;
  documentFiles?: Array<{
    originalName: string;
    buffer: Buffer;
    mimeType: string;
  }>;
  sourceUrls?: string[];
  documentIds?: string[];
}

export class VerificationPipelineService {
  private claimExtractor = new ClaimExtractionAgent();
  private docProcessor = new DocumentProcessingAgent();
  private evidenceRetriever = new EvidenceRetrievalAgent();
  private citationValidator = new CitationValidationAgent();
  private evidenceAnalyzer = new EvidenceAnalysisAgent();
  private contradictionDetector = new ContradictionDetectionAgent();
  private decisionEngine = new VerificationDecisionAgent();
  private reportGenerator = new ReportGenerationAgent();

  async executePipeline(options: ExecutePipelineOptions) {
    const startTime = Date.now();
    const mode = options.mode || VerificationMode.BALANCED;
    logger.info(`Starting Verification Pipeline in ${mode} mode...`);

    // STEP 1: DOCUMENT INGESTION (if new documents or URLs provided)
    const targetDocumentIds: string[] = [...(options.documentIds || [])];

    if (options.documentFiles && options.documentFiles.length > 0) {
      for (const file of options.documentFiles) {
        try {
          const doc = await this.docProcessor.processFile({
            originalName: file.originalName,
            buffer: file.buffer,
            mimeType: file.mimeType,
          });
          if (doc && !targetDocumentIds.includes(doc.id)) {
            targetDocumentIds.push(doc.id);
          }
        } catch (docErr) {
          logger.error(`Error processing uploaded file ${file.originalName}:`, { docErr });
          const reason = docErr instanceof Error ? docErr.message : 'Unknown document processing error';
          throw new Error(`Could not process reference file "${file.originalName}": ${reason}`);
        }
      }
    }

    if (options.sourceUrls && options.sourceUrls.length > 0) {
      for (const url of options.sourceUrls) {
        try {
          const doc = await this.docProcessor.processFile({
            originalName: url,
            sourceUrl: url,
          });
          if (doc && !targetDocumentIds.includes(doc.id)) {
            targetDocumentIds.push(doc.id);
          }
        } catch (urlErr) {
          logger.error(`Error processing source URL ${url}:`, { urlErr });
          const reason = urlErr instanceof Error ? urlErr.message : 'Unknown URL processing error';
          throw new Error(`Could not ingest source URL "${url}": ${reason}`);
        }
      }
    }

    // STEP 2: CLAIM EXTRACTION
    const extractedClaims = await this.claimExtractor.execute(options.rawAnswer);
    if (extractedClaims.length === 0) {
      throw new Error('No checkable claims could be extracted from the provided text.');
    }

    // Initialize Verification Run record
    const run = await prisma.verificationRun.create({
      data: {
        title: options.title || 'Verification Run',
        rawAnswer: options.rawAnswer,
        mode,
        status: 'PROCESSING',
        totalClaims: extractedClaims.length,
      },
    });

    const allClaimTexts = extractedClaims.map((c) => c.normalizedText);

    let supportedCount = 0;
    let contradictedCount = 0;
    let partiallySupportedCount = 0;
    let insufficientCount = 0;
    let needsReviewCount = 0;
    let fabricatedCitationCount = 0;
    const confidenceScores: number[] = [];

    // STEP 3-8: PROCESS EACH CLAIM SEQUENTIALLY
    for (const extracted of extractedClaims) {
      // 1. Save Claim
      const claim = await prisma.claim.create({
        data: {
          verificationRunId: run.id,
          claimIndex: extracted.claimIndex,
          originalText: extracted.originalText,
          normalizedText: extracted.normalizedText,
          claimType: extracted.claimType as ClaimType,
          importance: extracted.importance as ClaimImportance,
          requiredEvidence: extracted.requiredEvidence,
          status: ClaimStatus.PENDING,
        },
      });

      // 2. Citation Validation (if citation present)
      let citationResult;
      if (extracted.extractedCitation) {
        citationResult = await this.citationValidator.validateCitation(
          extracted.extractedCitation,
          extracted.normalizedText,
          extracted.citedDocument,
          extracted.citedPage
        );

        if (citationResult.isFabricated) {
          fabricatedCitationCount++;
        }

        await prisma.citation.create({
          data: {
            verificationRunId: run.id,
            claimId: claim.id,
            citationText: extracted.extractedCitation,
            citedDocumentId: citationResult.citedDocumentId || null,
            citedPage: citationResult.citedPage || null,
            isValid: citationResult.isValid,
            isFabricated: citationResult.isFabricated,
            failureReason: citationResult.failureReason || null,
            exactSourceQuote: citationResult.exactSourceQuote || null,
          },
        });
      }

      // 3. Evidence Retrieval
      const candidates = await this.evidenceRetriever.retrieveCandidates(
        extracted.normalizedText,
        targetDocumentIds.length > 0 ? targetDocumentIds : undefined
      );

      // 4. Evidence Analysis (NLI)
      const analysis = await this.evidenceAnalyzer.analyzeClaimEvidence(extracted.normalizedText, candidates);

      // Save retrieved evidence items and links
      for (const item of analysis.allEvidence) {
        const evidenceRecord = await prisma.evidenceItem.create({
          data: {
            chunkId: item.chunkId,
            exactQuote: item.exactQuote,
            relevanceScore: item.relevanceScore,
            nliLabel: item.nliLabel,
            nliConfidence: item.nliConfidence,
            reasoning: item.reasoning,
          },
        });

        await prisma.claimEvidence.create({
          data: {
            claimId: claim.id,
            evidenceItemId: evidenceRecord.id,
            weight: item.relevanceScore,
          },
        });
      }

      // 5. Contradiction Detection
      const contradiction = await this.contradictionDetector.detect(
        extracted.normalizedText,
        analysis.allEvidence,
        allClaimTexts
      );

      // 6. Verification Decision Engine
      const decision = this.decisionEngine.decide({
        claimText: extracted.normalizedText,
        claimType: extracted.claimType as ClaimType,
        importance: extracted.importance as ClaimImportance,
        mode,
        analysis,
        citation: citationResult,
        contradiction,
      });

      confidenceScores.push(decision.calibratedScore);

      // Update counters
      switch (decision.finalStatus) {
        case ClaimStatus.SUPPORTED:
          supportedCount++;
          break;
        case ClaimStatus.CONTRADICTED:
          contradictedCount++;
          break;
        case ClaimStatus.PARTIALLY_SUPPORTED:
          partiallySupportedCount++;
          break;
        case ClaimStatus.INSUFFICIENT_EVIDENCE:
          insufficientCount++;
          break;
        case ClaimStatus.NEEDS_REVIEW:
          needsReviewCount++;
          break;
      }

      // Update Claim record
      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          status: decision.finalStatus,
          calibratedScore: decision.calibratedScore,
          reasoning: decision.explanation,
        },
      });

      // Save VerificationDecision record
      await prisma.verificationDecision.create({
        data: {
          verificationRunId: run.id,
          claimId: claim.id,
          finalStatus: decision.finalStatus,
          calibratedScore: decision.calibratedScore,
          uncertaintyFactors: decision.uncertaintyFactors,
          abstentionReason: decision.abstentionReason || null,
          explanation: decision.explanation,
          contradictionInfo: decision.contradictionInfo || null,
        },
      });

      // 7. Human Review Queue (if flagged)
      if (decision.shouldCreateReviewTask) {
        await prisma.reviewTask.create({
          data: {
            verificationRunId: run.id,
            claimId: claim.id,
            status: ReviewTaskStatus.PENDING,
            priority: decision.reviewPriority,
            reason: decision.abstentionReason || decision.explanation || 'Flagged for human confirmation',
          },
        });
      }
    }

    // Calibrated run confidence (mean of claim scores)
    const averageConfidence = confidenceScores.length > 0
      ? Number((confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length).toFixed(2))
      : 0.0;

    const durationMs = Date.now() - startTime;

    // STEP 9: UPDATE RUN SUMMARY IN DATABASE
    const updatedRun = await prisma.verificationRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        supportedCount,
        contradictedCount,
        partiallySupportedCount,
        insufficientCount,
        needsReviewCount,
        fabricatedCitationCount,
        calibratedConfidence: averageConfidence,
        durationMs,
      },
      include: {
        claims: {
          include: {
            citations: { include: { document: true } },
            evidenceLinks: {
              include: {
                evidenceItem: {
                  include: {
                    chunk: { include: { document: true } },
                  },
                },
              },
            },
            verificationDecision: true,
            reviewTask: true,
          },
        },
      },
    });

    // Audit Log entry
    await prisma.auditLog.create({
      data: {
        entityType: 'VERIFICATION_RUN',
        entityId: updatedRun.id,
        action: 'COMPLETED',
        performedBy: 'PIPELINE_ENGINE',
        details: {
          totalClaims: extractedClaims.length,
          supported: supportedCount,
          contradicted: contradictedCount,
          fabricatedCitations: fabricatedCitationCount,
          confidence: averageConfidence,
          durationMs,
        },
      },
    });

    // STEP 10: REPORT GENERATION
    const report = await this.reportGenerator.generate(updatedRun);

    return {
      run: updatedRun,
      report,
    };
  }
}
