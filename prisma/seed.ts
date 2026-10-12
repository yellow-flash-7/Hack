import { PrismaClient, Role, DocumentStatus, ClaimType, ClaimImportance, ClaimStatus, NliLabel, ReviewTaskStatus, ReviewPriority } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Simple deterministic embedding simulation (384 dimensions)
function createDeterministicEmbedding(text: string): number[] {
  const embedding = new Array(384).fill(0);
  const words = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let c = 0; c < word.length; c++) {
      hash = ((hash << 5) - hash + word.charCodeAt(c)) | 0;
    }
    const idx = Math.abs(hash) % 384;
    embedding[idx] += 1 / (i + 1);
  }
  // Normalize
  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0)) || 1;
  return embedding.map((v) => Number((v / norm).toFixed(6)));
}

async function main() {
  console.log('🌱 Starting ELOV Database Seeding...');

  // 1. Clean existing data
  await prisma.reviewAction.deleteMany({});
  await prisma.reviewTask.deleteMany({});
  await prisma.verificationDecision.deleteMany({});
  await prisma.claimEvidence.deleteMany({});
  await prisma.evidenceItem.deleteMany({});
  await prisma.citation.deleteMany({});
  await prisma.claim.deleteMany({});
  await prisma.verificationRun.deleteMany({});
  await prisma.documentChunk.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // 2. Users
  const auditorUser = await prisma.user.create({
    data: {
      email: 'auditor@elov.internal',
      name: 'Marcus Vance',
      role: Role.AUDITOR,
    },
  });

  const reviewerUser = await prisma.user.create({
    data: {
      email: 'reviewer@elov.internal',
      name: 'Dr. Sarah Chen',
      role: Role.REVIEWER,
    },
  });

  console.log('✓ Created users: Marcus Vance (Auditor), Dr. Sarah Chen (Reviewer)');

  // 3. Document 1: Clean Energy Report
  const cleanEnergyDocContent = [
    {
      page: 1,
      heading: 'Executive Summary & Global Solar Capacity',
      text: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023, reaching a total cumulative installation of 1,418 gigawatts globally. Utility-scale solar constituted 64% of new capacity additions, driven by rapid module manufacturing expansion in East Asia.',
    },
    {
      page: 2,
      heading: 'Offshore Wind Targets & Transmission',
      text: 'The international consortium established a binding target of 45 gigawatts of offshore wind capacity by 2030 across North American and European coastal grids. Interconnection bottlenecks remain the principal obstacle, with average grid interconnection queue wait times extending to 4.2 years.',
    },
    {
      page: 3,
      heading: 'Battery Storage Capital Expenditure',
      text: 'Average lithium-iron-phosphate (LFP) pack-level battery storage costs declined to $135 per kilowatt-hour ($135/kWh) in Q4 2023. Stationary four-hour duration grid battery installations grew by 82% over the previous fiscal period, providing critical frequency stabilization.',
    },
  ];

  const cleanEnergyFullText = cleanEnergyDocContent.map((c) => c.text).join('\n\n');
  const cleanEnergyDoc = await prisma.document.create({
    data: {
      title: 'Global Clean Energy Transition Report 2024',
      filename: 'Clean_Energy_Transition_Report_2024.pdf',
      originalName: 'Clean_Energy_Transition_Report_2024.pdf',
      mimeType: 'application/pdf',
      fileSize: 485200,
      pageCount: 14,
      hash: computeHash(cleanEnergyFullText),
      status: DocumentStatus.READY,
      metadata: {
        author: 'International Renewable Policy Institute',
        publishedYear: 2024,
        topics: ['Solar PV', 'Offshore Wind', 'Grid Battery Storage'],
      },
    },
  });

  for (let i = 0; i < cleanEnergyDocContent.length; i++) {
    const chunk = cleanEnergyDocContent[i];
    await prisma.documentChunk.create({
      data: {
        documentId: cleanEnergyDoc.id,
        chunkIndex: i,
        pageNumber: chunk.page,
        sectionHeading: chunk.heading,
        content: chunk.text,
        charCount: chunk.text.length,
        tokenCount: Math.round(chunk.text.length / 4),
        embedding: createDeterministicEmbedding(chunk.text),
      },
    });
  }

  // 4. Document 2: Clinical Guidelines
  const clinicalDocContent = [
    {
      page: 1,
      heading: 'First-Line Antihypertensive Therapy',
      text: 'For adult patients diagnosed with Stage 1 or Stage 2 primary hypertension, first-line pharmacological treatment consists of an ACE inhibitor, an angiotensin receptor blocker (ARB), a dihydropyridine calcium channel blocker (CCB), or a thiazide diuretic. Target systolic blood pressure is strictly < 130 mmHg.',
    },
    {
      page: 2,
      heading: 'Contraindicated Combinations & Precautions',
      text: 'Simultaneous administration of an ACE inhibitor and an ARB is strictly contraindicated due to elevated risks of hyperkalemia, acute renal impairment, and hypotension without incremental cardiovascular benefit. Serum creatinine and potassium must be evaluated within 14 days of initiation.',
    },
  ];

  const clinicalFullText = clinicalDocContent.map((c) => c.text).join('\n\n');
  const clinicalDoc = await prisma.document.create({
    data: {
      title: 'Cardiovascular Clinical Practice Guidelines v4',
      filename: 'Cardiovascular_Clinical_Guidelines_v4.pdf',
      originalName: 'Cardiovascular_Clinical_Guidelines_v4.pdf',
      mimeType: 'application/pdf',
      fileSize: 320400,
      pageCount: 8,
      hash: computeHash(clinicalFullText),
      status: DocumentStatus.READY,
      metadata: {
        author: 'Cardiovascular Standards Board',
        publishedYear: 2024,
      },
    },
  });

  for (let i = 0; i < clinicalDocContent.length; i++) {
    const chunk = clinicalDocContent[i];
    await prisma.documentChunk.create({
      data: {
        documentId: clinicalDoc.id,
        chunkIndex: i,
        pageNumber: chunk.page,
        sectionHeading: chunk.heading,
        content: chunk.text,
        charCount: chunk.text.length,
        tokenCount: Math.round(chunk.text.length / 4),
        embedding: createDeterministicEmbedding(chunk.text),
      },
    });
  }

  // 5. Verification Run 1: High Grounding Run
  const run1Answer = `According to recent research, global solar photovoltaic capacity increased by 32% year-over-year in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1]. Furthermore, lithium-iron-phosphate battery storage costs declined to $135 per kilowatt-hour by Q4 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 3].`;

  const run1 = await prisma.verificationRun.create({
    data: {
      title: 'Renewable Solar & Battery Cost Analysis',
      rawAnswer: run1Answer,
      status: 'COMPLETED',
      totalClaims: 2,
      supportedCount: 2,
      contradictedCount: 0,
      partiallySupportedCount: 0,
      insufficientCount: 0,
      needsReviewCount: 0,
      fabricatedCitationCount: 0,
      calibratedConfidence: 0.94,
      durationMs: 420,
    },
  });

  const claim1_1 = await prisma.claim.create({
    data: {
      verificationRunId: run1.id,
      claimIndex: 1,
      originalText: 'Global solar photovoltaic capacity increased by 32% year-over-year in 2023.',
      normalizedText: 'Solar PV capacity expanded by 32% YoY during 2023.',
      claimType: ClaimType.FACTUAL,
      importance: ClaimImportance.CRITICAL,
      status: ClaimStatus.SUPPORTED,
      calibratedScore: 0.96,
      reasoning: 'Verbatim numerical and factual match with Clean Energy Transition Report page 1.',
    },
  });

  const chunksDoc1 = await prisma.documentChunk.findMany({ where: { documentId: cleanEnergyDoc.id } });

  const evidence1_1 = await prisma.evidenceItem.create({
    data: {
      chunkId: chunksDoc1[0].id,
      exactQuote: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023',
      relevanceScore: 0.98,
      nliLabel: NliLabel.ENTAILMENT,
      nliConfidence: 0.97,
      reasoning: 'Exact entailment of solar capacity growth rate and reference year.',
    },
  });

  await prisma.claimEvidence.create({
    data: {
      claimId: claim1_1.id,
      evidenceItemId: evidence1_1.id,
      weight: 1.0,
    },
  });

  await prisma.citation.create({
    data: {
      verificationRunId: run1.id,
      claimId: claim1_1.id,
      citationText: '[Clean_Energy_Transition_Report_2024.pdf, p. 1]',
      citedDocumentId: cleanEnergyDoc.id,
      citedPage: 1,
      isValid: true,
      isFabricated: false,
      exactSourceQuote: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023',
    },
  });

  await prisma.verificationDecision.create({
    data: {
      verificationRunId: run1.id,
      claimId: claim1_1.id,
      finalStatus: ClaimStatus.SUPPORTED,
      calibratedScore: 0.96,
      explanation: 'High semantic and textual alignment with source document page 1. No conflicting evidence detected.',
    },
  });

  // 6. Verification Run 2: Hallucination & Fabricated Citation Run
  const run2Answer = `Global solar capacity declined by 15% due to supply chain shortages in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1]. In addition, international targets mandate 95 gigawatts of offshore wind by 2030 [Clean_Energy_Transition_Report_2024.pdf, p. 88].`;

  const run2 = await prisma.verificationRun.create({
    data: {
      title: 'Solar Supply Disruption & Offshore Wind Audit',
      rawAnswer: run2Answer,
      status: 'COMPLETED',
      totalClaims: 2,
      supportedCount: 0,
      contradictedCount: 2,
      partiallySupportedCount: 0,
      insufficientCount: 0,
      needsReviewCount: 0,
      fabricatedCitationCount: 1,
      calibratedConfidence: 0.12,
      durationMs: 510,
    },
  });

  const claim2_1 = await prisma.claim.create({
    data: {
      verificationRunId: run2.id,
      claimIndex: 1,
      originalText: 'Global solar capacity declined by 15% due to supply chain shortages in 2023.',
      normalizedText: 'Solar capacity decreased by 15% in 2023.',
      claimType: ClaimType.FACTUAL,
      importance: ClaimImportance.HIGH,
      status: ClaimStatus.CONTRADICTED,
      calibratedScore: 0.08,
      reasoning: 'Direct contradiction: source document explicitly states solar capacity increased by 32% in 2023.',
    },
  });

  const evidence2_1 = await prisma.evidenceItem.create({
    data: {
      chunkId: chunksDoc1[0].id,
      exactQuote: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023',
      relevanceScore: 0.95,
      nliLabel: NliLabel.CONTRADICTION,
      nliConfidence: 0.94,
      reasoning: 'Source states +32% increase whereas AI claimed 15% decline.',
    },
  });

  await prisma.claimEvidence.create({
    data: {
      claimId: claim2_1.id,
      evidenceItemId: evidence2_1.id,
      weight: 1.0,
    },
  });

  await prisma.verificationDecision.create({
    data: {
      verificationRunId: run2.id,
      claimId: claim2_1.id,
      finalStatus: ClaimStatus.CONTRADICTED,
      calibratedScore: 0.08,
      explanation: 'Numerical and polarity contradiction detected against page 1.',
      contradictionInfo: {
        claimedValue: '-15% decline',
        sourceValue: '+32% growth',
        sourceDocument: 'Clean_Energy_Transition_Report_2024.pdf',
        page: 1,
      },
    },
  });

  const claim2_2 = await prisma.claim.create({
    data: {
      verificationRunId: run2.id,
      claimIndex: 2,
      originalText: 'International targets mandate 95 gigawatts of offshore wind by 2030.',
      normalizedText: 'Offshore wind target is 95 GW by 2030.',
      claimType: ClaimType.FACTUAL,
      importance: ClaimImportance.HIGH,
      status: ClaimStatus.CONTRADICTED,
      calibratedScore: 0.15,
      reasoning: 'Source sets target at 45 GW, not 95 GW. Citation also references non-existent page 88 (report is 14 pages).',
    },
  });

  await prisma.citation.create({
    data: {
      verificationRunId: run2.id,
      claimId: claim2_2.id,
      citationText: '[Clean_Energy_Transition_Report_2024.pdf, p. 88]',
      citedDocumentId: cleanEnergyDoc.id,
      citedPage: 88,
      isValid: false,
      isFabricated: true,
      failureReason: 'Fabricated page reference: Clean_Energy_Transition_Report_2024.pdf has only 14 pages.',
    },
  });

  await prisma.verificationDecision.create({
    data: {
      verificationRunId: run2.id,
      claimId: claim2_2.id,
      finalStatus: ClaimStatus.CONTRADICTED,
      calibratedScore: 0.15,
      explanation: 'Target figure differs (45 GW actual vs 95 GW claimed) and citation page 88 is fabricated.',
    },
  });

  // 7. Verification Run 3: Ambiguous / Human Review Run
  const run3Answer = `Combining ACE inhibitors with Angiotensin Receptor Blockers is widely recommended by modern cardiologists for enhanced kidney protection.`;

  const run3 = await prisma.verificationRun.create({
    data: {
      title: 'ACE Inhibitor & ARB Combination Review',
      rawAnswer: run3Answer,
      status: 'NEEDS_REVIEW',
      totalClaims: 1,
      supportedCount: 0,
      contradictedCount: 0,
      partiallySupportedCount: 0,
      insufficientCount: 0,
      needsReviewCount: 1,
      fabricatedCitationCount: 0,
      calibratedConfidence: 0.45,
      durationMs: 380,
    },
  });

  const claim3_1 = await prisma.claim.create({
    data: {
      verificationRunId: run3.id,
      claimIndex: 1,
      originalText: 'Combining ACE inhibitors with Angiotensin Receptor Blockers is widely recommended by modern cardiologists for enhanced kidney protection.',
      normalizedText: 'ACE inhibitor plus ARB combination is recommended for renal protection.',
      claimType: ClaimType.RECOMMENDATION,
      importance: ClaimImportance.CRITICAL,
      status: ClaimStatus.NEEDS_REVIEW,
      calibratedScore: 0.45,
      reasoning: 'Critical clinical recommendation flagged due to severe safety discrepancy with Cardiovascular Clinical Practice Guidelines.',
    },
  });

  const chunksClinical = await prisma.documentChunk.findMany({ where: { documentId: clinicalDoc.id } });

  const evidence3_1 = await prisma.evidenceItem.create({
    data: {
      chunkId: chunksClinical[1].id,
      exactQuote: 'Simultaneous administration of an ACE inhibitor and an ARB is strictly contraindicated due to elevated risks of hyperkalemia, acute renal impairment',
      relevanceScore: 0.92,
      nliLabel: NliLabel.CONTRADICTION,
      nliConfidence: 0.91,
      reasoning: 'Guidelines explicitly contraindicate this combination citing acute renal impairment.',
    },
  });

  await prisma.claimEvidence.create({
    data: {
      claimId: claim3_1.id,
      evidenceItemId: evidence3_1.id,
      weight: 1.0,
    },
  });

  await prisma.verificationDecision.create({
    data: {
      verificationRunId: run3.id,
      claimId: claim3_1.id,
      finalStatus: ClaimStatus.NEEDS_REVIEW,
      calibratedScore: 0.45,
      abstentionReason: 'Severe clinical discrepancy identified. Algorithmic auto-rejection requires human clinical confirmation.',
      explanation: 'AI suggested combination for kidney protection whereas guidelines state it is contraindicated due to acute renal risk.',
    },
  });

  const reviewTask3 = await prisma.reviewTask.create({
    data: {
      verificationRunId: run3.id,
      claimId: claim3_1.id,
      status: ReviewTaskStatus.PENDING,
      priority: ReviewPriority.CRITICAL,
      reason: 'Critical safety recommendation contradicted by clinical guidelines page 2. Requires medical reviewer sign-off.',
      assignedToId: reviewerUser.id,
    },
  });

  // 8. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        entityType: 'VERIFICATION_RUN',
        entityId: run1.id,
        action: 'VERIFIED',
        performedBy: 'SYSTEM_PIPELINE',
        details: { totalClaims: 2, supported: 2, confidence: 0.94 },
      },
      {
        entityType: 'VERIFICATION_RUN',
        entityId: run2.id,
        action: 'FLAGGED_FABRICATION',
        performedBy: 'SYSTEM_PIPELINE',
        details: { fabricatedCitations: 1, contradictedClaims: 2 },
      },
      {
        entityType: 'REVIEW_TASK',
        entityId: reviewTask3.id,
        action: 'QUEUED_FOR_HUMAN_REVIEW',
        performedBy: 'DECISION_ENGINE',
        details: { priority: 'CRITICAL', reason: reviewTask3.reason },
      },
    ],
  });

  console.log('✓ Successfully created sample documents, chunks, verification runs, decisions, review task, and audit logs!');
}

main()
  .catch((e) => {
    console.error('Error during database seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
