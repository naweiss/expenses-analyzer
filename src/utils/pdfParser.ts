import * as pdfjsLib from 'pdfjs-dist';
import { Transaction } from './csvParser';
import { parseDateString, sanitizeAmount } from './parserUtils';

// Configure the worker to use the local bundled version
const setupWorker = async () => {
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;
    } catch {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
    }
  }
};

export interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

export interface Column {
  goal: string;
  anchorX: number;
  minX?: number;
  maxX?: number;
}

export interface Boundary {
  goal: string;
  minX: number;
  maxX: number;
  anchorX?: number;
}

const normalizeText = (text: string): string => {
  return text.replace(/[\u200E\u200F\u202A-\u202E]/g, '').trim();
};

/**
 * Supported header strings for each goal.
 * Includes logical and visual (reversed) orders.
 */
const COLUMN_HEADERS: Record<string, string[]> = {
  DATE: ['תאריך עסקה', 'עסקה תאריך', 'תאריך'],
  BUSINESS_NAME: [
    'שם בית העסק',
    'העסק בית שם',
    'שם בית עסק',
    'עסק בית שם',
    'שם העסק',
    'העסק שם',
    'בית עסק',
    'עסק בית',
    'עסק',
  ],
  INDUSTRY: ['ענף'],
  ORIGINAL_AMOUNT: ['סכום עסקה', 'עסקה סכום', 'סכום מקורי', 'מקורי סכום', 'סכום'],
  CHARGE_AMOUNT: ['סכום החיוב', 'החיוב סכום', 'בש"ח סכום החיוב', 'סכום בש"ח החיוב', 'החיוב'],
  DETAILS: ['פירוט נוסף', 'נוסף פירוט', 'פירוט'],
  IGNORE: [
    'כרטיס בעסקה',
    'בעסקה כרטיס',
    'כרטיס',
    'בעסקה',
    'סוג',
    'עיר',
    'המרה תאריך שער',
    'תאריך המרה שער',
    'תאריך המרה ל- ₪',
    'שער המרה ב- נטו ₪',
    'סכום ב-$',
    'סכום עמלה',
    'עמלה סכום',
  ],
};

interface RawTextItem {
  str?: string;
  transform?: number[];
  width?: number;
}

const isTextItem = (
  item: RawTextItem,
): item is { str: string; transform: number[]; width: number } => {
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.width === 'number'
  );
};

const processHebrewText = (text: string): string => {
  if (/[\u0590-\u05FF]/.test(text)) {
    return text.split(/\s+/).reverse().join(' ');
  }
  return text;
};

/**
 * Clusters text items horizontally.
 */
const clusterItems = (items: PDFTextItem[], gap = 12) => {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters: { str: string; x: number; maxX: number; width: number }[] = [];
  let cur = {
    str: sorted[0].str,
    x: sorted[0].x,
    maxX: sorted[0].x + sorted[0].width,
  };

  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i];
    if (it.x - cur.maxX < gap) {
      cur.str += ' ' + it.str;
      cur.maxX = Math.max(cur.maxX, it.x + it.width);
    } else {
      clusters.push({ ...cur, width: cur.maxX - cur.x });
      cur = {
        str: it.str,
        x: it.x,
        maxX: it.x + it.width,
      };
    }
  }
  clusters.push({ ...cur, width: cur.maxX - cur.x });
  return clusters;
};

const sanitizeBusinessName = (text: string): string => {
  if (!text) return '';
  // Remove known RTL artifacts and order indicators
  const cleaned = text
    .replace(/\.?\s*תש\s*\.\s*נייד/g, '')
    .replace(/\.?\s*ה\s*\.\s*קבע/g, '')
    .replace(/קבע\s*\.\s*ה/g, '')
    .replace(/נייד\s*\.\s*תש/g, '')
    .replace(/(^|\s)א\s*\*/g, '$1*')
    .replace(/\*\s*א(\s|$)/g, '*$1')
    .replace(/לא הוצג/g, '');

  return normalizeText(cleaned);
};

export const parsePDF = async (
  file: File | Uint8Array,
  onProgress?: (p: number) => void,
): Promise<Transaction[]> => {
  await setupWorker();

  let uint8Array: Uint8Array;
  if (file instanceof Uint8Array) {
    uint8Array = file;
  } else if (file && typeof file.arrayBuffer === 'function') {
    uint8Array = new Uint8Array(await file.arrayBuffer());
  } else {
    throw new Error('Unsupported input type for PDF parsing');
  }

  const cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/cmaps/`;
  const standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`;

  const pdf = await pdfjsLib.getDocument({
    data: uint8Array,
    cMapUrl,
    cMapPacked: true,
    standardFontDataUrl,
  }).promise;
  const allTransactions: Transaction[] = [];

  let currentSection: 'domestic' | 'foreign' | 'unknown' = 'unknown';
  let boundaries: Boundary[] | null = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = (await page.getTextContent()) as { items: RawTextItem[] };

    const items: PDFTextItem[] = textContent.items.filter(isTextItem).map((item) => ({
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
    }));

    // Fine-grained line detection (2px tolerance) to separate rows correctly
    const lines: PDFTextItem[][] = [];
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    let currentLine: PDFTextItem[] = [];
    let lastY = -1;
    for (const item of items) {
      if (lastY === -1 || Math.abs(item.y - lastY) < 2) {
        currentLine.push(item);
      } else {
        lines.push(currentLine.sort((a, b) => a.x - b.x));
        currentLine = [item];
      }
      lastY = item.y;
    }
    if (currentLine.length > 0) lines.push(currentLine.sort((a, b) => a.x - b.x));

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineY = line[0]?.y ?? 0;
      const lineStr = line.map((it) => it.str).join(' ');

      // Section Transitions
      if (lineStr.includes('רכישות') && lineStr.includes('בחו"ל')) {
        currentSection = 'foreign';
        boundaries = null;
        continue;
      }
      if (lineStr.includes('עסקות') && (lineStr.includes('בארץ') || lineStr.includes('זוכו'))) {
        currentSection = 'domestic';
        boundaries = null;
        continue;
      }

      // Header Detection (skip if line is summary row)
      const detectedAnchors: Column[] = [];
      if (!lineStr.includes('סה"כ')) {
        for (let k = 0; k < 3 && j + k < lines.length; k++) {
          const targetLine = lines[j + k];
          if (Math.abs(lineY - targetLine[0].y) > 25) break;
          const clusters = clusterItems(targetLine, 5);
          for (const c of clusters) {
            const text = normalizeText(processHebrewText(c.str));
            for (const [goal, headerNames] of Object.entries(COLUMN_HEADERS)) {
              if (headerNames.includes(text)) {
                detectedAnchors.push({
                  goal,
                  anchorX: (c.x + c.maxX) / 2,
                  minX: c.x,
                  maxX: c.maxX,
                });
                break;
              }
            }
          }
          if (k === 0 && detectedAnchors.length === 0) {
            break;
          }
        }
      }

      const uniqueGoals = new Set(detectedAnchors.map((a) => a.goal));
      if (uniqueGoals.size >= 3) {
        // Resolve ambiguous 'סכום' headers for domestic section
        const originalAmounts = detectedAnchors.filter((a) => a.goal === 'ORIGINAL_AMOUNT');
        if (originalAmounts.length >= 2) {
          const sorted = originalAmounts.sort((a, b) => a.anchorX - b.anchorX);
          sorted[0].goal = 'CHARGE_AMOUNT';
          sorted[1].goal = 'ORIGINAL_AMOUNT';
        }

        const sortedAnchors = detectedAnchors
          .filter((a, idx, self) => self.findIndex((t) => t.goal === a.goal) === idx) // Unique goals
          .sort((a, b) => a.anchorX - b.anchorX);

        const dividers: number[] = [];
        for (let i = 0; i < sortedAnchors.length - 1; i++) {
          const a = sortedAnchors[i];
          const b = sortedAnchors[i + 1];
          const aMax = a.maxX ?? a.anchorX;
          const bMin = b.minX ?? b.anchorX;

          let div: number;
          if (
            b.goal === 'BUSINESS_NAME' ||
            (b.goal === 'INDUSTRY' && a.goal === 'ORIGINAL_AMOUNT')
          ) {
            // Text columns expand leftward into the gap up to column a's right edge
            div = aMax + Math.min(2, Math.max(0.5, (bMin - aMax) * 0.05));
          } else {
            div = (aMax + bMin) / 2;
          }
          dividers.push(div);
        }

        boundaries = sortedAnchors.map((anchor, idx) => ({
          goal: anchor.goal,
          anchorX: anchor.anchorX,
          minX: idx === 0 ? 0 : dividers[idx - 1],
          maxX: idx === sortedAnchors.length - 1 ? 2000 : dividers[idx],
        }));
        continue;
      }

      // Conclude table on summary row
      if (lineStr.includes('סה"כ')) {
        boundaries = null;
      }

      if (!boundaries) continue;

      // Transaction Row Extraction
      const dateMatch = /\b\d{2}\/\d{2}\/\d{2}\b/.exec(lineStr);
      if (dateMatch && !lineStr.includes('סה"כ')) {
        const rowData: Record<string, string[]> = {};
        for (const b of boundaries) rowData[b.goal] = [];

        for (const item of line) {
          const itemMidX = item.x + item.width / 2;
          const bound = boundaries.find((b) => itemMidX >= b.minX && itemMidX < b.maxX);
          if (bound) rowData[bound.goal].push(item.str);
        }

        const getColText = (goal: string) => {
          const items = rowData[goal] || [];
          if (goal === 'DATE') {
            const joined = items.join('').trim();
            const m = /\b\d{2}\/\d{2}\/\d{2}\b/.exec(joined);
            return m ? m[0] : '';
          }
          let text = items.join(' ').trim();
          if (/[\u0590-\u05FF]/.test(text)) {
            text = text.split(/\s+/).reverse().join(' ');
          }
          return normalizeText(text);
        };

        const charge = sanitizeAmount(getColText('CHARGE_AMOUNT'));
        const business = getColText('BUSINESS_NAME');

        if (
          charge !== 0 &&
          business &&
          !business.includes('סה"כ') &&
          !business.includes('מסגרת') &&
          !business.includes('קרדיט')
        ) {
          allTransactions.push({
            id: crypto.randomUUID(),
            date: parseDateString(getColText('DATE')),
            businessName: sanitizeBusinessName(business),
            industry:
              normalizeText(currentSection === 'foreign' ? 'חו"ל' : getColText('INDUSTRY')) ||
              'other',
            transactionAmount: sanitizeAmount(getColText('ORIGINAL_AMOUNT')) || charge,
            debitAmount: charge,
            details: getColText('DETAILS'),
          });
        }
      }
    }
    if (onProgress) {
      onProgress((pageNum / pdf.numPages) * 100);
    }
  }

  return allTransactions;
};
