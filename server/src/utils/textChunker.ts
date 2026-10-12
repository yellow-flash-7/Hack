export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ChunkResult {
  chunkIndex: number;
  pageNumber: number;
  sectionHeading?: string;
  content: string;
  charCount: number;
  tokenCount: number;
}

export function detectHeading(text: string): string | undefined {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return undefined;

  for (const line of lines.slice(0, 3)) {
    // Markdown style
    if (line.startsWith('#')) {
      return line.replace(/^#+\s*/, '').slice(0, 80);
    }
    // Section / Chapter / Header style
    if (/^(Section|Chapter|Part|Article|\d+\.|\d+\.\d+)\s+/i.test(line)) {
      return line.slice(0, 80);
    }
    // Short title-cased line
    if (line.length < 60 && !line.endsWith('.') && /^[A-Z]/.test(line)) {
      return line;
    }
  }

  return undefined;
}

export function chunkDocumentPages(
  pages: ParsedPage[],
  targetWords = 250,
  overlapWords = 50
): ChunkResult[] {
  const chunks: ChunkResult[] = [];
  let chunkIndex = 0;

  for (const page of pages) {
    const rawText = page.text.trim();
    if (!rawText) continue;

    // Detect section heading for page
    const pageHeading = detectHeading(rawText);

    // Split into sentences / paragraphs
    const paragraphs = rawText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

    let currentWords: string[] = [];
    let currentParagraphHeadings: string[] = [];

    for (const p of paragraphs) {
      const pHeading = detectHeading(p);
      if (pHeading && !currentParagraphHeadings.includes(pHeading)) {
        currentParagraphHeadings.push(pHeading);
      }

      const words = p.split(/\s+/).filter(Boolean);

      if (currentWords.length + words.length > targetWords && currentWords.length > 0) {
        // Create chunk
        const content = currentWords.join(' ');
        chunks.push({
          chunkIndex: chunkIndex++,
          pageNumber: page.pageNumber,
          sectionHeading: currentParagraphHeadings[0] || pageHeading,
          content,
          charCount: content.length,
          tokenCount: Math.ceil(content.length / 4),
        });

        // Retain overlap
        currentWords = currentWords.slice(-overlapWords);
      }

      currentWords.push(...words);
    }

    if (currentWords.length > 0) {
      const content = currentWords.join(' ');
      chunks.push({
        chunkIndex: chunkIndex++,
        pageNumber: page.pageNumber,
        sectionHeading: currentParagraphHeadings[0] || pageHeading,
        content,
        charCount: content.length,
        tokenCount: Math.ceil(content.length / 4),
      });
    }
  }

  return chunks;
}

export function chunkPlainText(
  text: string,
  targetWords = 250,
  overlapWords = 50
): ChunkResult[] {
  // Check if text already has page markers like [--- Page 2 ---]
  const pageRegex = /(?:---|\bPage\b|\bPAGE\b)\s*(\d+)\s*(?:---|:|\n)/g;
  const matches = [...text.matchAll(pageRegex)];

  if (matches.length > 1) {
    const pages: ParsedPage[] = [];
    let lastIdx = 0;
    let lastPageNum = 1;

    for (const m of matches) {
      if (m.index !== undefined && m.index > lastIdx) {
        pages.push({
          pageNumber: lastPageNum,
          text: text.slice(lastIdx, m.index),
        });
      }
      lastPageNum = parseInt(m[1], 10);
      lastIdx = (m.index || 0) + m[0].length;
    }

    pages.push({
      pageNumber: lastPageNum,
      text: text.slice(lastIdx),
    });

    return chunkDocumentPages(pages, targetWords, overlapWords);
  }

  // Single page fallback
  return chunkDocumentPages([{ pageNumber: 1, text }], targetWords, overlapWords);
}
