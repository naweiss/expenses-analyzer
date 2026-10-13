import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Transaction } from './csvParser';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';

// Configure the worker using Vite's URL feature for bundled deployment
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export enum SectionType {
  Domestic = 'domestic',
  Foreign = 'foreign',
  Unknown = 'unknown',
}

export type ColumnGoal =
  | 'DATE'
  | 'BUSINESS_NAME'
  | 'INDUSTRY'
  | 'ORIGINAL_AMOUNT'
  | 'CHARGE_AMOUNT'
  | 'DETAILS'
  | 'IGNORE';

export interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height?: number;
}

export interface Boundary {
  goal: ColumnGoal;
  minX: number;
  maxX: number;
  anchorX?: number;
  topY?: number;
  bottomY?: number;
}

export interface RawTextItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
}

interface ColumnAnchor {
  goal: ColumnGoal;
  anchorX: number;
  minX: number;
  maxX: number;
}

/**
 * Canonical header mappings for foreign transactions table.
 * Standard logical Hebrew reading order only.
 */
export const FOREIGN_HEADER_MAP: Record<string, ColumnGoal> = {
  תאריך: 'DATE',
  'תאריך עסקה': 'DATE',
  סוג: 'IGNORE',
  'שם בית העסק': 'BUSINESS_NAME',
  'שם העסק': 'BUSINESS_NAME',
  'בית עסק': 'BUSINESS_NAME',
  'סכום מקורי': 'ORIGINAL_AMOUNT',
  'סכום ב-$': 'IGNORE',
  'תאריך המרה שער': 'IGNORE',
  'תאריך המרה ל- ₪': 'IGNORE',
  'שער המרה ב- נטו ₪': 'IGNORE',
  'תאריך המרה': 'IGNORE',
  'שער המרה': 'IGNORE',
  'סכום עמלה': 'IGNORE',
  'סכום החיוב': 'CHARGE_AMOUNT',
  'פירוט נוסף': 'DETAILS',
  פירוט: 'DETAILS',
};

/**
 * Canonical header mappings for domestic transactions table.
 * Standard logical Hebrew reading order only.
 */
export const DOMESTIC_HEADER_MAP: Record<string, ColumnGoal> = {
  'תאריך עסקה': 'DATE',
  תאריך: 'DATE',
  'כרטיס בעסקה': 'IGNORE',
  כרטיס: 'IGNORE',
  'שם בית עסק': 'BUSINESS_NAME',
  'שם בית העסק': 'BUSINESS_NAME',
  'שם העסק': 'BUSINESS_NAME',
  'בית עסק': 'BUSINESS_NAME',
  ענף: 'INDUSTRY',
  'סכום עסקה': 'ORIGINAL_AMOUNT',
  'סכום מקורי': 'ORIGINAL_AMOUNT',
  'סכום החיוב': 'CHARGE_AMOUNT',
  'סכום החיוב בש"ח': 'CHARGE_AMOUNT',
  'פירוט נוסף': 'DETAILS',
  פירוט: 'DETAILS',
};

export const isTextItem = (
  item: RawTextItem,
): item is { str: string; transform: number[]; width: number; height?: number } => {
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.width === 'number'
  );
};

export const processHebrewText = (text: string): string => {
  if (/[\u0590-\u05FF]/.test(text)) {
    return text.split(/\s+/).reverse().join(' ');
  }
  return text;
};

/**
 * Clusters text items horizontally within a line.
 */
export const clusterItems = (items: PDFTextItem[], gap = 12) => {
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

/**
 * Sanitizes business name by removing payment scheme indicators and order artifacts.
 */
export const sanitizeBusinessName = (text: string): string => {
  if (!text) return '';
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

/**
 * Extracts raw PDF text items and groups them into lines with a 2px vertical tolerance.
 */
export const extractLinesFromPage = (textContent: { items: RawTextItem[] }): PDFTextItem[][] => {
  const items: PDFTextItem[] = textContent.items.filter(isTextItem).map((item) => {
    const height = typeof item.height === 'number' && item.height > 0 ? item.height : 10;
    return {
      str: item.str,
      x: item.transform[4],
      y: item.transform[5],
      width: item.width,
      height,
    };
  });

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
  return lines;
};

/**
 * Detects section transitions (foreign purchases vs domestic transactions).
 */
export const detectSection = (lineStr: string, currentSection: SectionType): SectionType => {
  if (lineStr.includes('רכישות') && lineStr.includes('בחו"ל')) {
    return SectionType.Foreign;
  }
  if (lineStr.includes('עסקות') && (lineStr.includes('בארץ') || lineStr.includes('זוכו'))) {
    return SectionType.Domestic;
  }
  return currentSection;
};

/**
 * Detects summary / subtotal rows (such as intermediate debit-date subtotals or grand totals)
 * that should not be parsed into individual transactions.
 */
export const isSummaryRow = (lineStr: string): boolean => {
  return lineStr.includes('סה"כ');
};

/**
 * Matches a normalized cluster text string against exact canonical headers.
 */
export const matchHeaderGoal = (text: string, section: SectionType): ColumnGoal | null => {
  if (section === SectionType.Foreign) {
    return FOREIGN_HEADER_MAP[text] ?? null;
  }
  if (section === SectionType.Domestic) {
    return DOMESTIC_HEADER_MAP[text] ?? null;
  }
  return FOREIGN_HEADER_MAP[text] ?? DOMESTIC_HEADER_MAP[text] ?? null;
};

export interface TableBoundaryResult {
  boundaries: Boundary[];
  linesConsumed: number;
}

/**
 * Detects table headers and constructs column boundary spans.
 * Automatically merges vertically stacked multi-line headers (e.g. 'סכום' + 'החיוב' + 'בש"ח' -> 'סכום החיוב בש"ח').
 */
export const detectTableBoundaries = (
  lines: PDFTextItem[][],
  startLineIdx: number,
  section: SectionType,
): TableBoundaryResult | null => {
  const lineY = lines[startLineIdx][0]?.y ?? 0;
  const topClusters = clusterItems(lines[startLineIdx], 5);

  // Scan downward for candidate sub-lines belonging to this header block
  const candidateSubLines: { lineOffset: number; clusters: ReturnType<typeof clusterItems> }[] = [];
  let lastY = lineY;
  for (let offset = 1; offset <= 4 && startLineIdx + offset < lines.length; offset++) {
    const nextLine = lines[startLineIdx + offset];
    const nextLineY = nextLine[0]?.y ?? 0;
    const subLineStr = nextLine.map((it) => it.str).join(' ');

    if (Math.abs(lastY - nextLineY) > 15) break;
    if (/\b\d{2}\/\d{2}\/\d{2}\b/.test(subLineStr)) break;
    if (subLineStr.includes('סה"כ')) break;

    candidateSubLines.push({
      lineOffset: offset,
      clusters: clusterItems(nextLine, 5),
    });
    lastY = nextLineY;
  }

  let maxLineOffsetUsed = 0;
  const detectedAnchors: ColumnAnchor[] = [];

  for (const tc of topClusters) {
    let tcText = normalizeText(processHebrewText(tc.str));
    let goal = matchHeaderGoal(tcText, section);
    let minX = tc.x;
    let maxX = tc.maxX;
    let clusterOffsetUsed = 0;

    for (const sub of candidateSubLines) {
      const matchingBottom = sub.clusters.filter((sc) => {
        const tcMid = (minX + maxX) / 2;
        const scMid = (sc.x + sc.maxX) / 2;
        return Math.abs(tcMid - scMid) < 15 || (sc.x < maxX && sc.maxX > minX);
      });

      if (matchingBottom.length > 0) {
        const scText = matchingBottom
          .map((sc) => normalizeText(processHebrewText(sc.str)))
          .join(' ');
        const combinedText = `${tcText} ${scText}`;
        const combinedGoal = matchHeaderGoal(combinedText, section);

        if (combinedGoal) {
          goal = combinedGoal;
          tcText = combinedText;
          minX = Math.min(minX, ...matchingBottom.map((b) => b.x));
          maxX = Math.max(maxX, ...matchingBottom.map((b) => b.maxX));
          clusterOffsetUsed = sub.lineOffset;
        } else if (goal) {
          // Pure spatial projection: sub-cluster sits physically inside this confirmed column's X corridor
          minX = Math.min(minX, ...matchingBottom.map((b) => b.x));
          maxX = Math.max(maxX, ...matchingBottom.map((b) => b.maxX));
          clusterOffsetUsed = sub.lineOffset;
        }
      }
    }

    if (goal) {
      detectedAnchors.push({
        goal,
        anchorX: (minX + maxX) / 2,
        minX,
        maxX,
      });
      maxLineOffsetUsed = Math.max(maxLineOffsetUsed, clusterOffsetUsed);
    }
  }

  const uniqueGoals = new Set(detectedAnchors.map((a) => a.goal));
  if (uniqueGoals.size < 3) return null;

  // Deduplicate by goal and sort by anchorX
  const sortedAnchors = detectedAnchors
    .filter((a, idx, self) => self.findIndex((t) => t.goal === a.goal) === idx)
    .sort((a, b) => a.anchorX - b.anchorX);

  const dividers: number[] = [];
  for (let i = 0; i < sortedAnchors.length - 1; i++) {
    const a = sortedAnchors[i];
    const b = sortedAnchors[i + 1];
    const aMax = a.maxX;
    const bMin = b.minX;

    let div: number;
    if (b.goal === 'BUSINESS_NAME' || (b.goal === 'INDUSTRY' && a.goal === 'ORIGINAL_AMOUNT')) {
      // Text columns expand leftward into the gap up to column a's right edge
      div = aMax + Math.min(2, Math.max(0.5, (bMin - aMax) * 0.05));
    } else {
      div = (aMax + bMin) / 2;
    }
    dividers.push(div);
  }

  const boundaries = sortedAnchors.map((anchor, idx) => ({
    goal: anchor.goal,
    anchorX: anchor.anchorX,
    minX: idx === 0 ? 0 : dividers[idx - 1],
    maxX: idx === sortedAnchors.length - 1 ? 2000 : dividers[idx],
  }));

  return { boundaries, linesConsumed: maxLineOffsetUsed + 1 };
};

/**
 * Parses a single transaction row using the active table boundaries.
 */
export const parseTransactionRow = (
  line: PDFTextItem[],
  boundaries: Boundary[],
  section: SectionType,
): Transaction | null => {
  const rowData: Record<string, string[]> = {};
  for (const b of boundaries) rowData[b.goal] = [];

  for (const item of line) {
    const itemMidX = item.x + item.width / 2;
    const bound = boundaries.find((b) => itemMidX >= b.minX && itemMidX < b.maxX);
    if (bound) rowData[bound.goal].push(item.str);
  }

  const getColText = (goal: ColumnGoal): string => {
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
    return {
      id: crypto.randomUUID(),
      date: parseDateString(getColText('DATE')),
      businessName: sanitizeBusinessName(business),
      industry:
        normalizeText(section === SectionType.Foreign ? 'חו"ל' : getColText('INDUSTRY')) || 'other',
      transactionAmount: sanitizeAmount(getColText('ORIGINAL_AMOUNT')) || charge,
      debitAmount: charge,
      details: getColText('DETAILS'),
    };
  }
  return null;
};

/**
 * Main PDF parser function. Parses an Israeli credit card PDF statement into Transactions.
 */
export const parsePDF = async (
  file: File | Uint8Array,
  onProgress?: (p: number) => void,
): Promise<Transaction[]> => {
  let uint8Array: Uint8Array;
  if (file instanceof Uint8Array) {
    uint8Array = file;
  } else if (file && typeof file.arrayBuffer === 'function') {
    uint8Array = new Uint8Array(await file.arrayBuffer());
  } else {
    throw new Error('Unsupported input type for PDF parsing');
  }

  const pdf = await pdfjsLib.getDocument({
    data: uint8Array,
  }).promise;

  const allTransactions: Transaction[] = [];
  let currentSection = SectionType.Unknown;
  let boundaries: Boundary[] | null = null;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = (await page.getTextContent()) as { items: RawTextItem[] };
    const lines = extractLinesFromPage(textContent);

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineStr = line.map((it) => it.str).join(' ');

      // Section Transitions
      const newSection = detectSection(lineStr, currentSection);
      if (newSection !== currentSection) {
        currentSection = newSection;
        boundaries = null;
        continue;
      }

      // Header Detection
      const headerResult = detectTableBoundaries(lines, j, currentSection);
      if (headerResult) {
        boundaries = headerResult.boundaries;
        if (headerResult.linesConsumed > 1) {
          j += headerResult.linesConsumed - 1;
        }
        continue;
      }

      // Skip summary / subtotal rows from being parsed as transactions
      if (isSummaryRow(lineStr)) {
        continue;
      }

      if (!boundaries) continue;

      // Transaction Row Extraction
      if (/\b\d{2}\/\d{2}\/\d{2}\b/.test(lineStr)) {
        const tx = parseTransactionRow(line, boundaries, currentSection);
        if (tx) {
          allTransactions.push(tx);
        }
      }
    }

    if (onProgress) {
      onProgress((pageNum / pdf.numPages) * 100);
    }
  }

  return allTransactions;
};
