import * as pdfjsLib from 'pdfjs-dist';
import { Transaction } from '../../utils/csvParser';
import { parseDateString, sanitizeAmount, normalizeText } from '../../utils/parserUtils';
import { SectionType, ColumnGoal, Boundary, PDFTextItem } from '../../utils/pdfParser';

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

export interface DebugWord extends PDFTextItem {
  height: number;
  assignedColumn?: string;
  isHeader?: boolean;
  rowY?: number;
}

export interface DebugRow {
  y: number;
  lineStr: string;
  type: 'section_header' | 'table_header' | 'transaction' | 'other';
  items: DebugWord[];
  transactionData?: {
    date: string;
    businessName: string;
    industry: string;
    transactionAmount: number;
    debitAmount: number;
    details: string;
  };
}

export interface TableDebugInfo {
  id: string;
  section: SectionType;
  headerY: number;
  topY: number;
  bottomY: number;
  boundaries: Boundary[];
}

export interface PageDebugData {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  section: SectionType;
  tables: TableDebugInfo[];
  words: DebugWord[];
  rows: DebugRow[];
  boundaries: Boundary[];
  transactions: Transaction[];
}

export interface PdfDebugResult {
  doc: pdfjsLib.PDFDocumentProxy;
  totalPages: number;
  pages: PageDebugData[];
  transactions: Transaction[];
}

interface RawTextItem {
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

const FOREIGN_HEADER_MAP: Record<string, ColumnGoal> = {
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

const DOMESTIC_HEADER_MAP: Record<string, ColumnGoal> = {
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

const isTextItem = (
  item: RawTextItem,
): item is { str: string; transform: number[]; width: number; height?: number } => {
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

const detectSection = (lineStr: string, currentSection: SectionType): SectionType => {
  if (lineStr.includes('רכישות') && lineStr.includes('בחו"ל')) {
    return SectionType.Foreign;
  }
  if (lineStr.includes('עסקות') && (lineStr.includes('בארץ') || lineStr.includes('זוכו'))) {
    return SectionType.Domestic;
  }
  return currentSection;
};

const matchHeaderGoal = (text: string, section: SectionType): ColumnGoal | null => {
  if (section === SectionType.Foreign) {
    return FOREIGN_HEADER_MAP[text] ?? null;
  }
  if (section === SectionType.Domestic) {
    return DOMESTIC_HEADER_MAP[text] ?? null;
  }
  return FOREIGN_HEADER_MAP[text] ?? DOMESTIC_HEADER_MAP[text] ?? null;
};

const detectTableBoundaries = (
  lines: PDFTextItem[][],
  startLineIdx: number,
  section: SectionType,
): { boundaries: Boundary[]; linesConsumed: number } | null => {
  const lineY = lines[startLineIdx][0]?.y ?? 0;
  const topClusters = clusterItems(lines[startLineIdx], 5);

  const nextLine = lines[startLineIdx + 1];
  const bottomClusters =
    nextLine && Math.abs(lineY - nextLine[0].y) <= 15 ? clusterItems(nextLine, 5) : [];

  const detectedAnchors: ColumnAnchor[] = [];

  for (const tc of topClusters) {
    const tcText = normalizeText(processHebrewText(tc.str));

    let goal = matchHeaderGoal(tcText, section);
    let minX = tc.x;
    let maxX = tc.maxX;

    if (!goal && bottomClusters.length > 0) {
      const matchingBottom = bottomClusters.filter((bc) => {
        const tcMid = (tc.x + tc.maxX) / 2;
        const bcMid = (bc.x + bc.maxX) / 2;
        return Math.abs(tcMid - bcMid) < 15 || (bc.x < tc.maxX && bc.maxX > tc.x);
      });

      if (matchingBottom.length > 0) {
        const bcText = matchingBottom
          .map((bc) => normalizeText(processHebrewText(bc.str)))
          .join(' ');
        const mergedText = `${tcText} ${bcText}`;
        goal = matchHeaderGoal(mergedText, section);
        if (goal) {
          minX = Math.min(tc.x, ...matchingBottom.map((b) => b.x));
          maxX = Math.max(tc.maxX, ...matchingBottom.map((b) => b.maxX));
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
    }
  }

  const uniqueGoals = new Set(detectedAnchors.map((a) => a.goal));
  if (uniqueGoals.size < 3) return null;

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

  return { boundaries, linesConsumed: bottomClusters.length > 0 ? 2 : 1 };
};

const parseTransactionRow = (
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

export const parsePDFWithDebug = async (
  file: File | Uint8Array | ArrayBuffer,
  onProgress?: (p: number) => void,
): Promise<PdfDebugResult> => {
  await setupWorker();

  let uint8Array: Uint8Array;
  if (file instanceof Uint8Array) {
    uint8Array = file;
  } else if (file instanceof ArrayBuffer) {
    uint8Array = new Uint8Array(file);
  } else if (file && typeof file.arrayBuffer === 'function') {
    uint8Array = new Uint8Array(await file.arrayBuffer());
  } else {
    throw new Error('Unsupported input type for PDF parsing');
  }

  const pdf = await pdfjsLib.getDocument({
    data: uint8Array,
  }).promise;

  const allTransactions: Transaction[] = [];
  const pagesData: PageDebugData[] = [];

  let currentSection = SectionType.Unknown;
  let activeBoundaries: Boundary[] | null = null;
  let tableCounter = 1;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = (await page.getTextContent()) as { items: RawTextItem[] };

    const rawItems: DebugWord[] = textContent.items.filter(isTextItem).map((item) => {
      const height = typeof item.height === 'number' && item.height > 0 ? item.height : 10;
      return {
        str: item.str,
        x: item.transform[4],
        y: item.transform[5],
        width: item.width,
        height,
      };
    });

    const lines: DebugWord[][] = [];
    rawItems.sort((a, b) => b.y - a.y || a.x - b.x);
    let currentLine: DebugWord[] = [];
    let lastY = -1;
    for (const item of rawItems) {
      if (lastY === -1 || Math.abs(item.y - lastY) < 2) {
        currentLine.push(item);
      } else {
        lines.push(currentLine.sort((a, b) => a.x - b.x));
        currentLine = [item];
      }
      lastY = item.y;
    }
    if (currentLine.length > 0) lines.push(currentLine.sort((a, b) => a.x - b.x));

    const pageWords: DebugWord[] = [];
    const pageRows: DebugRow[] = [];
    const pageTransactions: Transaction[] = [];
    const pageTables: TableDebugInfo[] = [];

    let currentTable: TableDebugInfo | null = null;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineY = line[0]?.y ?? 0;
      const lineStr = line.map((it) => it.str).join(' ');

      // Section Transitions
      const newSection = detectSection(lineStr, currentSection);
      if (newSection !== currentSection) {
        currentSection = newSection;
        activeBoundaries = null;
        currentTable = null;
        const debugWords: DebugWord[] = line.map((it) => ({ ...it, rowY: lineY }));
        pageWords.push(...debugWords);
        pageRows.push({
          y: lineY,
          lineStr,
          type: 'section_header',
          items: debugWords,
        });
        continue;
      }

      // Conclude table on summary row
      if (lineStr.includes('סה"כ')) {
        if (currentTable) {
          const finalBottomY = lineY - 5;
          currentTable.bottomY = finalBottomY;
          for (const b of currentTable.boundaries) {
            b.bottomY = finalBottomY;
          }
        }
        activeBoundaries = null;
        currentTable = null;
        const debugWords: DebugWord[] = line.map((it) => ({ ...it, rowY: lineY }));
        pageWords.push(...debugWords);
        pageRows.push({
          y: lineY,
          lineStr,
          type: 'other',
          items: debugWords,
        });
        continue;
      }

      // Header Detection
      const headerResult = detectTableBoundaries(lines, j, currentSection);
      if (headerResult) {
        activeBoundaries = headerResult.boundaries;
        const tableBoundaries: Boundary[] = activeBoundaries.map((b) => ({
          ...b,
          topY: lineY + 15,
          bottomY: 0,
        }));
        const newTable: TableDebugInfo = {
          id: `table-${tableCounter++}`,
          section: currentSection,
          headerY: lineY,
          topY: lineY + 15,
          bottomY: 0,
          boundaries: tableBoundaries,
        };
        pageTables.push(newTable);
        currentTable = newTable;

        const consumed = headerResult.linesConsumed ?? 1;
        for (let cIdx = 0; cIdx < consumed; cIdx++) {
          const hLine = lines[j + cIdx];
          const hLineY = hLine[0]?.y ?? 0;
          const hWords: DebugWord[] = hLine.map((it) => {
            const midX = it.x + it.width / 2;
            const bound = activeBoundaries?.find((b) => midX >= b.minX && midX < b.maxX);
            return {
              ...it,
              rowY: hLineY,
              isHeader: true,
              assignedColumn: bound?.goal,
            };
          });
          pageWords.push(...hWords);
          pageRows.push({
            y: hLineY,
            lineStr: hLine.map((it) => it.str).join(' '),
            type: 'table_header',
            items: hWords,
          });
        }
        j += consumed - 1;
        continue;
      }

      if (!activeBoundaries) {
        const debugWords: DebugWord[] = line.map((it) => ({ ...it, rowY: lineY }));
        pageWords.push(...debugWords);
        pageRows.push({
          y: lineY,
          lineStr,
          type: 'other',
          items: debugWords,
        });
        continue;
      }

      // Transaction Row Extraction
      if (/\b\d{2}\/\d{2}\/\d{2}\b/.test(lineStr)) {
        const tx = parseTransactionRow(line, activeBoundaries, currentSection);
        const debugWords: DebugWord[] = line.map((it) => {
          const midX = it.x + it.width / 2;
          const bound = activeBoundaries?.find((b) => midX >= b.minX && midX < b.maxX);
          return {
            ...it,
            rowY: lineY,
            assignedColumn: bound?.goal,
          };
        });
        pageWords.push(...debugWords);

        if (tx) {
          allTransactions.push(tx);
          pageTransactions.push(tx);
          if (!currentTable && activeBoundaries) {
            const tableBoundaries: Boundary[] = activeBoundaries.map((b) => ({
              ...b,
              topY: viewport.height,
              bottomY: 0,
            }));
            currentTable = {
              id: `table-${tableCounter++}`,
              section: currentSection,
              headerY: viewport.height,
              topY: viewport.height,
              bottomY: 0,
              boundaries: tableBoundaries,
            };
            pageTables.push(currentTable);
          }
          if (currentTable) {
            const rowBottom = lineY - 10;
            currentTable.bottomY =
              currentTable.bottomY === 0 ? rowBottom : Math.min(currentTable.bottomY, rowBottom);
            for (const b of currentTable.boundaries) {
              b.bottomY = currentTable.bottomY;
            }
          }
          pageRows.push({
            y: lineY,
            lineStr,
            type: 'transaction',
            items: debugWords,
            transactionData: {
              date: tx.date ? tx.date.toLocaleDateString('en-GB') : '',
              businessName: tx.businessName,
              industry: tx.industry,
              transactionAmount: tx.transactionAmount,
              debitAmount: tx.debitAmount,
              details: tx.details,
            },
          });
        } else {
          pageRows.push({
            y: lineY,
            lineStr,
            type: 'other',
            items: debugWords,
          });
        }
      } else {
        const debugWords: DebugWord[] = line.map((it) => ({ ...it, rowY: lineY }));
        pageWords.push(...debugWords);
        pageRows.push({
          y: lineY,
          lineStr,
          type: 'other',
          items: debugWords,
        });
      }
    }

    pagesData.push({
      pageNumber: pageNum,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      section: currentSection,
      tables: pageTables,
      words: pageWords,
      rows: pageRows,
      boundaries: activeBoundaries ?? [],
      transactions: pageTransactions,
    });

    if (onProgress) {
      onProgress((pageNum / pdf.numPages) * 100);
    }
  }

  return {
    doc: pdf,
    totalPages: pdf.numPages,
    pages: pagesData,
    transactions: allTransactions,
  };
};
