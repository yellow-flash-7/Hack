import { VerificationPipelineService } from '../services/verificationPipeline.js';
import { prisma, connectDB } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { ClaimStatus } from '@prisma/client';

export interface BenchmarkCase {
  id: string;
  name: string;
  description: string;
  rawAnswer: string;
  expectedStatus: ClaimStatus;
  expectedCitationFabricated?: boolean;
  expectedCitationValid?: boolean;
}

export const BENCHMARK_DATASET: BenchmarkCase[] = [
  {
    id: 'CASE_1_SUPPORTED',
    name: 'Correctly Supported Claim',
    description: 'Claim matches report metrics and has valid inline citation',
    rawAnswer: 'Global installed solar photovoltaic capacity increased by 32% year-over-year in 2023 [Clean_Energy_Transition_Report_2024.pdf, p. 1].',
    expectedStatus: ClaimStatus.SUPPORTED,
    expectedCitationFabricated: false,
    expectedCitationValid: true,
  },
  {
    id: 'CASE_2_CONTRADICTED',
    name: 'Directly Contradicted Claim',
    description: 'Claim asserts solar dropped 20% when document proves 32% increase',
    rawAnswer: 'Global solar capacity dropped by 20% in 2023 due to severe supply chain shortages.',
    expectedStatus: ClaimStatus.CONTRADICTED,
  },
  {
    id: 'CASE_3_UNSUPPORTED',
    name: 'Unsupported Claim (Missing Evidence)',
    description: 'Claim makes assertions about fusion power not mentioned anywhere in library',
    rawAnswer: 'The commercial fusion reactor in Provence generated net electricity export into the European grid in 2022.',
    expectedStatus: ClaimStatus.INSUFFICIENT_EVIDENCE,
  },
  {
    id: 'CASE_4_FABRICATED_CITATION',
    name: 'Fabricated Citation (Exceeds Page Count)',
    description: 'Cites page 95 in a 14-page document',
    rawAnswer: 'Offshore wind targets require 95 gigawatts of installed capacity [Clean_Energy_Transition_Report_2024.pdf, p. 95].',
    expectedStatus: ClaimStatus.CONTRADICTED,
    expectedCitationFabricated: true,
    expectedCitationValid: false,
  },
  {
    id: 'CASE_5_IRRELEVANT_CITATION',
    name: 'Real Citation with Irrelevant Evidence',
    description: 'Cites real medical document for unrelated clean energy / quantum computing claim',
    rawAnswer: 'Quantum computing models revolutionized battery life predictions [Cardiovascular_Clinical_Guidelines_v4.pdf, p. 1].',
    expectedStatus: ClaimStatus.INSUFFICIENT_EVIDENCE,
    expectedCitationFabricated: false,
    expectedCitationValid: false,
  },
  {
    id: 'CASE_6_CLINICAL_ABSTENTION',
    name: 'Contradicted Clinical Recommendation (Abstention)',
    description: 'Recommends contraindicated drug combination; triggers human clinical review / abstention',
    rawAnswer: 'Combining ACE inhibitors with Angiotensin Receptor Blockers is widely recommended by modern clinicians.',
    expectedStatus: ClaimStatus.NEEDS_REVIEW,
  },
  {
    id: 'CASE_7_PARTIAL_SUPPORT',
    name: 'Partially Supported Claim',
    description: 'Topic aligns but exact assertion is not fully confirmed',
    rawAnswer: 'Utility module manufacturing expansion in East Asia influenced broader solar PV deployment trends.',
    expectedStatus: ClaimStatus.PARTIALLY_SUPPORTED,
  },
];

export async function runBenchmark() {
  console.log('================================================================');
  console.log('🔬 RUNNING ELOV BENCHMARK EVALUATION SUITE');
  console.log(`   Evaluation cases: ${BENCHMARK_DATASET.length}`);
  console.log('================================================================\n');

  await connectDB();
  const pipeline = new VerificationPipelineService();

  let supportedTruePositive = 0;
  let supportedFalsePositive = 0;
  let supportedFalseNegative = 0;

  let contradictionTruePositive = 0;
  let contradictionFalsePositive = 0;
  let contradictionFalseNegative = 0;

  let correctCitationValidations = 0;
  let totalCitationTests = 0;

  let totalLatencyMs = 0;
  let falseRejections = 0; // True claim incorrectly marked contradicted or insufficient
  let abstentions = 0;

  const caseResults = [];

  for (const testCase of BENCHMARK_DATASET) {
    const t0 = Date.now();
    const result = await pipeline.executePipeline({
      title: `Benchmark: ${testCase.name}`,
      rawAnswer: testCase.rawAnswer,
    });
    const latency = Date.now() - t0;
    totalLatencyMs += latency;

    const firstClaim = result.run.claims[0];
    const actualStatus = firstClaim?.status || ClaimStatus.INSUFFICIENT_EVIDENCE;
    const firstCitation = firstClaim?.citations?.[0];

    // Status evaluation
    const statusMatches =
      actualStatus === testCase.expectedStatus ||
      (testCase.expectedStatus === ClaimStatus.NEEDS_REVIEW && actualStatus === ClaimStatus.CONTRADICTED) ||
      (testCase.expectedStatus === ClaimStatus.INSUFFICIENT_EVIDENCE && actualStatus === ClaimStatus.PARTIALLY_SUPPORTED);

    // Citation evaluation
    let citationSuccess = true;
    if (testCase.expectedCitationFabricated !== undefined && firstCitation) {
      totalCitationTests++;
      if (firstCitation.isFabricated === testCase.expectedCitationFabricated) {
        correctCitationValidations++;
      } else {
        citationSuccess = false;
      }
    }

    if (actualStatus === ClaimStatus.NEEDS_REVIEW) {
      abstentions++;
    }

    // Supported metric counts
    if (testCase.expectedStatus === ClaimStatus.SUPPORTED) {
      if (actualStatus === ClaimStatus.SUPPORTED) supportedTruePositive++;
      else {
        supportedFalseNegative++;
        falseRejections++;
      }
    } else {
      if (actualStatus === ClaimStatus.SUPPORTED) supportedFalsePositive++;
    }

    // Contradiction metric counts
    if (testCase.expectedStatus === ClaimStatus.CONTRADICTED) {
      if (actualStatus === ClaimStatus.CONTRADICTED) contradictionTruePositive++;
      else contradictionFalseNegative++;
    } else {
      if (actualStatus === ClaimStatus.CONTRADICTED && testCase.expectedStatus !== ClaimStatus.NEEDS_REVIEW) {
        contradictionFalsePositive++;
      }
    }

    caseResults.push({
      id: testCase.id,
      name: testCase.name,
      expected: testCase.expectedStatus,
      actual: actualStatus,
      passed: statusMatches && citationSuccess,
      latencyMs: latency,
      calibratedScore: firstClaim?.calibratedScore,
    });

    console.log(
      `[${statusMatches && citationSuccess ? ' PASS ' : ' FAIL '}] ${testCase.name.padEnd(45)} | Expected: ${testCase.expectedStatus.padEnd(20)} | Actual: ${actualStatus.padEnd(20)} | Latency: ${latency}ms`
    );
  }

  // Calculate Metrics
  const supportedPrecision =
    supportedTruePositive + supportedFalsePositive > 0
      ? supportedTruePositive / (supportedTruePositive + supportedFalsePositive)
      : 1.0;
  const supportedRecall =
    supportedTruePositive + supportedFalseNegative > 0
      ? supportedTruePositive / (supportedTruePositive + supportedFalseNegative)
      : 1.0;

  const contradictionPrecision =
    contradictionTruePositive + contradictionFalsePositive > 0
      ? contradictionTruePositive / (contradictionTruePositive + contradictionFalsePositive)
      : 1.0;
  const contradictionRecall =
    contradictionTruePositive + contradictionFalseNegative > 0
      ? contradictionTruePositive / (contradictionTruePositive + contradictionFalseNegative)
      : 1.0;

  const citationAccuracy =
    totalCitationTests > 0 ? (correctCitationValidations / totalCitationTests) * 100 : 100;

  const avgLatency = Math.round(totalLatencyMs / BENCHMARK_DATASET.length);
  const falseRejectionRate = (falseRejections / BENCHMARK_DATASET.length) * 100;

  console.log('\n================================================================');
  console.log('📊 EVALUATION SUMMARY & CALIBRATED METRICS');
  console.log('================================================================');
  console.log(`• Supported-Claim Precision:      ${(supportedPrecision * 100).toFixed(1)}%`);
  console.log(`• Supported-Claim Recall:         ${(supportedRecall * 100).toFixed(1)}%`);
  console.log(`• Contradiction Detection Prec:   ${(contradictionPrecision * 100).toFixed(1)}%`);
  console.log(`• Contradiction Detection Recall: ${(contradictionRecall * 100).toFixed(1)}%`);
  console.log(`• Citation Validation Accuracy:   ${citationAccuracy.toFixed(1)}%`);
  console.log(`• False Rejection Rate:           ${falseRejectionRate.toFixed(1)}%`);
  console.log(`• Abstention / Review Rate:       ${((abstentions / BENCHMARK_DATASET.length) * 100).toFixed(1)}%`);
  console.log(`• Average Verification Latency:   ${avgLatency} ms`);
  console.log(`• Verification Cost:              $0.0000 (Deterministic Offline Engine)`);
  console.log('================================================================\n');

  await prisma.$disconnect();
  return {
    caseResults,
    metrics: {
      supportedPrecision,
      supportedRecall,
      contradictionPrecision,
      contradictionRecall,
      citationAccuracy,
      falseRejectionRate,
      avgLatency,
    },
  };
}

if (process.argv[1]?.includes('runBenchmark')) {
  runBenchmark()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Benchmark execution error:', err);
      process.exit(1);
    });
}
