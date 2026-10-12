import crypto from 'crypto';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { prisma } from '../config/db.js';
import { getAIProvider } from '../ai/provider.js';
import { chunkPlainText, chunkDocumentPages, ParsedPage, ChunkResult } from '../utils/textChunker.js';
import { safeFetchUrl } from '../utils/ssrfGuard.js';
import { logger } from '../utils/logger.js';
import { DocumentStatus, Prisma } from '@prisma/client';

export interface IngestDocumentInput {
  title?: string;
  originalName: string;
  buffer?: Buffer;
  sourceUrl?: string;
  mimeType?: string;
}

export class DocumentProcessingAgent {
  private provider = getAIProvider();

  async processFile(input: IngestDocumentInput) {
    logger.info(`Processing document: ${input.originalName}`);

    let fullText = '';
    let pageCount = 1;
    let parsedPages: ParsedPage[] = [];
    const extension = path.extname(input.originalName).toLowerCase();

    if (input.sourceUrl) {
      const fetched = await safeFetchUrl(input.sourceUrl);
      fullText = fetched.content;
      parsedPages = [{ pageNumber: 1, text: fullText }];
    } else if (input.buffer) {
      if (input.buffer.length === 0) {
        throw Object.assign(new Error(`The file "${input.originalName}" is empty.`), { status: 400 });
      }

      if (extension === '.pdf' || (input.mimeType || '').toLowerCase().includes('pdf')) {
        try {
          const pdfData = await pdfParse(input.buffer);
          fullText = pdfData.text || '';
          pageCount = Math.max(1, pdfData.numpages || 1);
          const pageSplits = fullText.split('\f');
          parsedPages = pageSplits.length > 1
            ? pageSplits.map((text, index) => ({ pageNumber: index + 1, text: text.trim() }))
            : [{ pageNumber: 1, text: fullText }];
        } catch (error) {
          logger.warn(`PDF parsing failed for ${input.originalName}`, {
            message: error instanceof Error ? error.message : String(error),
          });
          throw Object.assign(new Error(`Could not read "${input.originalName}" as a PDF. Please check that the PDF is valid and contains selectable text.`), { status: 400 });
        }
      } else if (extension === '.docx' || (input.mimeType || '').toLowerCase().includes('wordprocessingml')) {
        try {
          const result = await mammoth.extractRawText({ buffer: input.buffer });
          fullText = result.value || '';
          parsedPages = [{ pageNumber: 1, text: fullText }];
        } catch (error) {
          logger.warn(`DOCX parsing failed for ${input.originalName}`, {
            message: error instanceof Error ? error.message : String(error),
          });
          throw Object.assign(new Error(`Could not read "${input.originalName}" as a DOCX file. Please check that the file is valid.`), { status: 400 });
        }
      } else if (['.txt', '.md'].includes(extension) || (input.mimeType || '').startsWith('text/')) {
        fullText = input.buffer.toString('utf8').replace(/^\uFEFF/, '');
        parsedPages = [{ pageNumber: 1, text: fullText }];
      } else {
        throw Object.assign(new Error(`Unsupported file type "${extension || 'unknown'}". Upload PDF, TXT, DOCX, or MD files.`), { status: 400 });
      }
    } else {
      throw Object.assign(new Error('No file content or source URL was provided.'), { status: 400 });
    }

    if (!fullText.trim()) {
      throw Object.assign(new Error(`"${input.originalName}" contains no readable text. Scanned PDFs may need OCR before upload.`), { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(fullText).digest('hex');
    const existing = await prisma.document.findUnique({
      where: { hash },
      include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
    });

    // A fully ingested duplicate is safe to return. An old/incomplete record is repaired below.
    if (existing && existing.chunks.length > 0) {
      logger.info(`Document already exists in library: ${existing.title} (${existing.id})`);
      return existing;
    }

    const chunks: ChunkResult[] = parsedPages.length > 1
      ? chunkDocumentPages(parsedPages, 250, 40)
      : chunkPlainText(fullText, 250, 40);

    if (chunks.length === 0) {
      throw Object.assign(new Error(`No readable text chunks could be created from "${input.originalName}".`), { status: 400 });
    }

    // Do potentially slow embedding work before opening a database transaction.
    const preparedChunks = await Promise.all(chunks.map(async (chunk) => {
      const embedding = await this.provider.generateEmbedding(chunk.content);
      if (!Array.isArray(embedding) || embedding.some((value) => !Number.isFinite(value))) {
        throw new Error(`Embedding generation returned invalid data for "${input.originalName}".`);
      }
      return { ...chunk, embedding };
    }));

    const title = input.title?.trim() || input.originalName.replace(/\.[^/.]+$/, '');
    const mimeType = input.mimeType || this.mimeTypeFor(extension);
    const fileSize = input.buffer ? input.buffer.length : Buffer.byteLength(fullText, 'utf8');

    try {
      const documentId = await prisma.$transaction(async (tx) => {
        let docId: string;
        if (existing) {
          docId = existing.id;
          await tx.documentChunk.deleteMany({ where: { documentId: docId } });
          await tx.document.update({
            where: { id: docId },
            data: {
              title,
              filename: input.originalName,
              originalName: input.originalName,
              mimeType,
              fileSize,
              pageCount,
              sourceUrl: input.sourceUrl || null,
              status: DocumentStatus.READY,
              errorMessage: null,
            },
          });
        } else {
          const document = await tx.document.create({
            data: {
              title,
              filename: input.originalName,
              originalName: input.originalName,
              mimeType,
              fileSize,
              pageCount,
              sourceUrl: input.sourceUrl || null,
              hash,
              status: DocumentStatus.PROCESSING,
            },
          });
          docId = document.id;
        }

        await tx.documentChunk.createMany({
          data: preparedChunks.map((chunk) => ({
            documentId: docId,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.pageNumber,
            sectionHeading: chunk.sectionHeading || null,
            content: chunk.content,
            charCount: chunk.charCount,
            tokenCount: chunk.tokenCount,
            embedding: chunk.embedding,
          })),
        });

        await tx.document.update({
          where: { id: docId },
          data: { status: DocumentStatus.READY, errorMessage: null },
        });
        return docId;
      });

      const saved = await prisma.document.findUnique({
        where: { id: documentId },
        include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
      });
      if (!saved) throw new Error('Document was saved but could not be reloaded.');
      logger.info(`Successfully ingested ${saved.title} with ${preparedChunks.length} chunks across ${pageCount} page(s).`);
      return saved;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = await prisma.document.findUnique({
          where: { hash },
          include: { chunks: { orderBy: { chunkIndex: 'asc' } } },
        });
        if (duplicate?.chunks.length) return duplicate;
        throw Object.assign(new Error('A document with the same content is being uploaded concurrently. Please retry the upload.'), { status: 409 });
      }
      throw error;
    }
  }

  private mimeTypeFor(extension: string): string {
    switch (extension) {
      case '.pdf': return 'application/pdf';
      case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case '.md': return 'text/markdown';
      case '.txt': return 'text/plain';
      default: return 'application/octet-stream';
    }
  }
}
