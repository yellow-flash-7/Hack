import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/db.js';
import { VerificationPipelineService } from '../services/verificationPipeline.js';
import { ReportGenerationAgent } from '../agents/reportGenerationAgent.js';
import { createVerificationRunSchema } from '../schemas/verification.schemas.js';
import { logger } from '../utils/logger.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

const router = Router();
const pipelineService = new VerificationPipelineService();
const reportGenerator = new ReportGenerationAgent();

// POST /api/verification-runs
router.post(
  '/',
  upload.array('documents', 5),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      logger.info('Received POST /api/verification-runs');

      const validated = createVerificationRunSchema.parse(req.body);

      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const documentFiles = files.map((f) => ({
        originalName: f.originalname,
        buffer: f.buffer,
        mimeType: f.mimetype,
      }));

      const result = await pipelineService.executePipeline({
        title: validated.title,
        rawAnswer: validated.rawAnswer,
        mode: validated.mode,
        documentFiles,
        sourceUrls: validated.sourceUrls,
        documentIds: validated.documentIds,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/verification-runs
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const [total, runs] = await Promise.all([
      prisma.verificationRun.count(),
      prisma.verificationRun.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          claims: {
            select: { id: true, status: true, importance: true },
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: runs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/verification-runs/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const run = await prisma.verificationRun.findUnique({
      where: { id },
      include: {
        claims: {
          orderBy: { claimIndex: 'asc' },
          include: {
            citations: {
              include: { document: true },
            },
            evidenceLinks: {
              include: {
                evidenceItem: {
                  include: {
                    chunk: {
                      include: { document: true },
                    },
                  },
                },
              },
            },
            verificationDecision: true,
            reviewTask: {
              include: {
                actions: {
                  include: { reviewer: true },
                  orderBy: { createdAt: 'desc' },
                },
              },
            },
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ success: false, error: 'Verification run not found' });
    }

    res.json({
      success: true,
      data: run,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/verification-runs/:id/report
router.get('/:id/report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const run = await prisma.verificationRun.findUnique({
      where: { id },
      include: {
        claims: {
          orderBy: { claimIndex: 'asc' },
          include: {
            citations: {
              include: { document: true },
            },
            evidenceLinks: {
              include: {
                evidenceItem: {
                  include: {
                    chunk: {
                      include: { document: true },
                    },
                  },
                },
              },
            },
            verificationDecision: true,
          },
        },
      },
    });

    if (!run) {
      return res.status(404).json({ success: false, error: 'Verification run not found' });
    }

    const report = await reportGenerator.generate(run);

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/verification-runs/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.verificationRun.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        entityType: 'VERIFICATION_RUN',
        entityId: id,
        action: 'DELETED',
        performedBy: 'USER',
      },
    });

    res.json({ success: true, message: 'Verification run deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
