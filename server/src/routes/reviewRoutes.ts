import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { reviewDecisionSchema } from '../schemas/verification.schemas.js';
import { ReviewTaskStatus, ClaimStatus } from '@prisma/client';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/reviews
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;

    const where: any = {};
    if (status) {
      where.status = status as ReviewTaskStatus;
    }

    const tasks = await prisma.reviewTask.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        verificationRun: {
          select: { id: true, title: true, mode: true, createdAt: true },
        },
        claim: {
          include: {
            citations: true,
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
          },
        },
        actions: {
          orderBy: { createdAt: 'desc' },
          include: { reviewer: true },
        },
      },
    });

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/reviews/:id/decision
router.post('/:id/decision', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const validated = reviewDecisionSchema.parse(req.body);

    const task = await prisma.reviewTask.findUnique({
      where: { id },
      include: { claim: true },
    });

    if (!task) {
      return res.status(404).json({ success: false, error: 'Review task not found' });
    }

    const previousStatus = task.claim.status;
    const newStatus = validated.newStatus as ClaimStatus;

    // 1. Create permanent ReviewAction (ensuring original decision is preserved in audit trail)
    const reviewAction = await prisma.reviewAction.create({
      data: {
        reviewTaskId: task.id,
        actionType: validated.actionType,
        previousStatus,
        newStatus,
        explanation: validated.explanation,
        correctionText: validated.correctionText || null,
      },
    });

    // 2. Update Claim status
    await prisma.claim.update({
      where: { id: task.claimId },
      data: {
        status: newStatus,
        reasoning: `Human Review [${validated.actionType}]: ${validated.explanation}`,
      },
    });

    // 3. Mark ReviewTask resolved
    let taskStatus: ReviewTaskStatus = ReviewTaskStatus.APPROVED;
    if (validated.actionType === 'REJECT') taskStatus = ReviewTaskStatus.REJECTED;
    if (validated.actionType === 'MODIFY') taskStatus = ReviewTaskStatus.MODIFIED;
    // Requesting more evidence is not a final resolution: keep it in the queue.
    if (validated.actionType === 'REQUEST_EVIDENCE') taskStatus = ReviewTaskStatus.PENDING;

    const updatedTask = await prisma.reviewTask.update({
      where: { id: task.id },
      data: {
        status: taskStatus,
        resolvedAt: validated.actionType === 'REQUEST_EVIDENCE' ? null : new Date(),
      },
    });

    // 4. Record in Audit Log
    await prisma.auditLog.create({
      data: {
        entityType: 'REVIEW_TASK',
        entityId: task.id,
        action: `DECISION_${validated.actionType}`,
        performedBy: validated.reviewerName,
        details: {
          claimId: task.claimId,
          previousStatus,
          newStatus,
          explanation: validated.explanation,
          correctionText: validated.correctionText,
        },
      },
    });

    logger.info(`Recorded human review action on claim ${task.claimId}: ${previousStatus} -> ${newStatus}`);

    res.json({
      success: true,
      data: {
        task: updatedTask,
        action: reviewAction,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
