import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { logger } from '../utils/logger.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  logger.error('Unhandled server error', {
    message: err?.message || String(err),
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err?.stack : undefined,
    code: err?.code,
  });

  if (res.headersSent) return;

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }

  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. The maximum upload size is 25 MB per file.'
      : err.code === 'LIMIT_FILE_COUNT'
        ? 'Too many files. Upload at most 10 files at a time.'
        : `File upload error: ${err.message}`;
    return res.status(status).json({ success: false, error: message });
  }

  // express body parsers use these errors for oversized or malformed request bodies.
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request is too large. Reduce the upload size and try again.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, error: 'Malformed request body.' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'A document with this content already exists in the library.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'The requested database record was not found.' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({ success: false, error: 'This record cannot be changed because related records still depend on it.' });
    }
  }

  const statusCode = Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599
    ? err.status
    : Number.isInteger(err?.statusCode) && err.statusCode >= 400 && err.statusCode <= 599
      ? err.statusCode
      : 500;

  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error. Check the server log for the underlying cause.'
    : (err?.message || 'Internal server error');

  return res.status(statusCode).json({ success: false, error: message });
}
