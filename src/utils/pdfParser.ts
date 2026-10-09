import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Transaction } from './csvParser';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';

// Set up the worker. In a browser/Vite environment, we use the URL.
// In other environments (like Node.js tests), we skip this or handle it differently.
const setupWorker = async () => {
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker.default;
    } catch (e) {
      console.warn('Failed to load pdf.worker.min.mjs?url', e);
    }
  }
};

interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface Column {
  goal: string;
  anchorX: number;
}

interface Boundary {
  goal: string;
  minX: number;
  maxX: number;
}

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
    .replace(/\bא\b\s+\*/g, '')
    .replace(/\*\s+\bא\b/g, '')
    .replace(/לא הוצג/g, '');

  return normalizeText(cleaned);
};

export const parsePDF = async (
  file: File,
  onProgress: (p: number) => void,
): Promise<Transaction[]> => {
  await setupWorker();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
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

      // Header Detection (pooling 3 lines)
      const detectedAnchors: Column[] = [];
      for (let k = 0; k < 3 && j + k < lines.length; k++) {
        const clusters = clusterItems(lines[j + k], 5);
        for (const c of clusters) {
          const text = normalizeText(processHebrewText(c.str));
          for (const [goal, headerNames] of Object.entries(COLUMN_HEADERS)) {
            if (headerNames.includes(text)) {
              detectedAnchors.push({ goal, anchorX: (c.x + c.maxX) / 2 });
              break;
            }
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

        boundaries = sortedAnchors.map((anchor, idx) => {
          const prev = sortedAnchors[idx - 1];
          const next = sortedAnchors[idx + 1];
          return {
            goal: anchor.goal,
            minX: prev ? (anchor.anchorX + prev.anchorX) / 2 : 0,
            maxX: next ? (anchor.anchorX + next.anchorX) / 2 : 2000,
          };
        });
        continue;
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
    onProgress((pageNum / pdf.numPages) * 100);
  }

  return allTransactions;
};
