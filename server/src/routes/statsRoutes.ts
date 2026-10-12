import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';

const router = Router();

// GET /api/stats
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [
      totalRuns,
      totalDocuments,
      totalClaims,
      claimsByStatus,
      pendingReviews,
      fabricatedCitations,
    ] = await Promise.all([
      prisma.verificationRun.count(),
      prisma.document.count(),
      prisma.claim.count(),
      prisma.claim.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.reviewTask.count({
        where: { status: 'PENDING' },
      }),
      prisma.citation.count({
        where: { isFabricated: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {
      SUPPORTED: 0,
      CONTRADICTED: 0,
      PARTIALLY_SUPPORTED: 0,
      INSUFFICIENT_EVIDENCE: 0,
      NEEDS_REVIEW: 0,
    };

    claimsByStatus.forEach((item) => {
      statusCounts[item.status] = item._count.status;
    });

    const supported = statusCounts['SUPPORTED'] || 0;
    const accuracyRate = totalClaims > 0 ? Number(((supported / totalClaims) * 100).toFixed(1)) : 0;

    res.json({
      success: true,
      data: {
        totalRuns,
        totalDocuments,
        totalClaims,
        statusCounts,
        pendingReviews,
        fabricatedCitations,
        accuracyRate,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
