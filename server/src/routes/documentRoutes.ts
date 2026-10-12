import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { prisma } from '../config/db.js';
import { DocumentProcessingAgent } from '../agents/documentProcessingAgent.js';
import { logger } from '../utils/logger.js';

const allowedExtensions = new Set(['.pdf', '.txt', '.docx', '.md']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const extension = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || '';
    if (!allowedExtensions.has(extension)) {
      callback(Object.assign(new Error(`Unsupported file type "${extension || 'unknown'}". Upload PDF, TXT, DOCX, or MD files.`), { status: 400 }));
      return;
    }
    callback(null, true);
  },
});

const router = Router();
const docProcessor = new DocumentProcessingAgent();

// POST /api/documents
router.post(
  '/',
  upload.array('files', 10),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      const { sourceUrl, title } = req.body;

      const createdDocs = [];

      // Process uploaded files
      for (const file of files) {
        const doc = await docProcessor.processFile({
          title,
          originalName: file.originalname,
          buffer: file.buffer,
          mimeType: file.mimetype,
        });
        if (doc) createdDocs.push(doc);
      }

      // Process URL if provided
      if (sourceUrl) {
        const doc = await docProcessor.processFile({
          title: title || sourceUrl,
          originalName: sourceUrl,
          sourceUrl,
        });
        if (doc) createdDocs.push(doc);
      }

      if (createdDocs.length === 0) {
        return res.status(400).json({ success: false, error: 'No files or valid source URL provided' });
      }

      res.status(201).json({
        success: true,
        data: createdDocs,
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/documents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const search = (req.query.search as string) || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { filename: { contains: search, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { chunks: true },
        },
      },
    });

    res.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/documents/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        chunks: {
          orderBy: { chunkIndex: 'asc' },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    res.json({
      success: true,
      data: document,
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/documents/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.document.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        entityType: 'DOCUMENT',
        entityId: id,
        action: 'DELETED',
        performedBy: 'USER',
      },
    });

    res.json({ success: true, message: 'Document deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
