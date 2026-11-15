// Pure client-side resilient PDF text extractor
// Preserves visual line breaks & bullet structure using PDF.js text item Y-coordinates

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

// Ensure PDF.js is loaded from fast CDN if not bundled
async function ensurePdfJsLoaded(): Promise<any> {
  if (typeof window !== 'undefined' && window.pdfjsLib) {
    return window.pdfjsLib;
  }

  // Load PDF.js from reliable CDN
  return new Promise((resolve, reject) => {
    const existing = document.getElementById('pdfjs-cdn-script');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.pdfjsLib));
      return;
    }

    const script = document.createElement('script');
    script.id = 'pdfjs-cdn-script';
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF parser from CDN'));
    document.head.appendChild(script);
  });
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

interface PositionedToken {
  str: string;
  x: number;
  y: number;
  hasEOL: boolean;
}

/**
 * Reconstruct clean visual lines from PDF.js text items so bullets,
 * headings, contact lines, and achievements do not collapse into one giant line.
 */
function reconstructPageLines(items: any[]): string {
  const tokens: PositionedToken[] = [];

  for (const item of items || []) {
    const rawStr = typeof item?.str === 'string' ? item.str : '';
    const trimmed = rawStr.replace(/\s+/g, ' ').trim();
    const x = Array.isArray(item?.transform) && typeof item.transform[4] === 'number' ? item.transform[4] : 0;
    const y = Array.isArray(item?.transform) && typeof item.transform[5] === 'number' ? item.transform[5] : 0;
    const hasEOL = Boolean(item?.hasEOL);

    if (trimmed.length > 0 || hasEOL) {
      tokens.push({ str: trimmed, x, y, hasEOL });
    }
  }

  if (tokens.length === 0) return '';

  // Cluster tokens into visual rows by Y coordinate (PDF Y increases upward; tolerance 3.5 units)
  const rows: { y: number; items: PositionedToken[] }[] = [];
  for (const token of tokens) {
    let targetRow = rows.find((r) => Math.abs(r.y - token.y) <= 3.5);
    if (!targetRow) {
      targetRow = { y: token.y, items: [] };
      rows.push(targetRow);
    }
    if (token.str) {
      targetRow.items.push(token);
    }
  }

  // Sort rows top-to-bottom (descending Y in PDF coordinate space)
  rows.sort((a, b) => b.y - a.y);

  const lines: string[] = [];
  for (const row of rows) {
    if (row.items.length === 0) continue;
    // Sort tokens within each line left-to-right
    row.items.sort((a, b) => a.x - b.x);
    const lineText = row.items
      .map((t) => t.str)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (lineText) {
      lines.push(lineText);
    }
  }

  return lines.join('\n');
}

/**
 * Bulletproof PDF text extraction:
 * 1. Reads the File as ArrayBuffer directly in browser
 * 2. Uses PDF.js to extract positioned text items page by page
 * 3. Preserves real visual lines and bullet structure cleanly
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const pdfjs = await ensurePdfJsLoaded();
    const arrayBuffer = await file.arrayBuffer();

    const loadingTask = pdfjs.getDocument({
      data: arrayBuffer,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdfDoc = await loadingTask.promise;
    const pagesText: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      let page: any = null;
      try {
        page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const reconstructed = reconstructPageLines(textContent?.items || []);
        if (reconstructed) {
          pagesText.push(reconstructed);
        }
      } finally {
        if (page && typeof page.cleanup === 'function') {
          page.cleanup();
        }
      }
    }

    const fullText = pagesText.join('\n\n').trim();
    if (fullText.length >= 10) {
      return fullText;
    }
    throw new Error('PDF appears to be empty or contains scanned images without selectable text.');
  } catch (err: any) {
    console.error('Client PDF extraction error:', err);
    throw new Error("Couldn't read this PDF — try copying the text manually instead");
  }
}
