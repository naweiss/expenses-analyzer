import * as pdfjsLib from 'pdfjs-dist';
import { Transaction, SectionType } from '../types/domain';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';
import { mapHeaderToGoal, ColumnGoal } from './parserSchema';

// Set up the worker using Vite's URL feature for bundled deployment
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PDFTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

interface ColumnMap {
  goal: ColumnGoal;
  minX: number;
  actualMaxX: number;
}

interface RawTextItem {
  str?: string;
  transform?: number[];
  width?: number;
}

const isTextItem = (item: RawTextItem): item is { str: string; transform: number[]; width: number } => {
  return (
    typeof item.str === 'string' &&
    Array.isArray(item.transform) &&
    item.transform.length >= 6 &&
    typeof item.width === 'number'
  );
};

const clusterItems = (items: PDFTextItem[], gap = 15) => {
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => a.x - b.x);
  const clusters: { str: string; x: number; maxX: number }[] = [];
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
      clusters.push(cur);
      cur = {
        str: it.str,
        x: it.x,
        maxX: it.x + it.width,
      };
    }
  }
  clusters.push(cur);
  return clusters;
};

const sanitizeBusinessName = (text: string): string => {
  if (!text) return '';
  const sanitized = text
    .replace(/תש\s*\.\s*נייד/g, '')
    .replace(/ה\s*\.\s*קבע/g, '')
    .replace(/\bא\b/g, '')
    .replace(/לא הוצג/g, '');

  return normalizeText(sanitized);
};

const extractLinesFromPage = (textContent: { items: RawTextItem[] }): PDFTextItem[][] => {
  const items: PDFTextItem[] = textContent.items.filter(isTextItem).map((item) => ({
    str: item.str,
    x: item.transform[4],
    y: item.transform[5],
    width: item.width,
  }));

  const lines: PDFTextItem[][] = [];
  items.sort((a, b) => b.y - a.y || a.x - b.x);
  let currentLine: PDFTextItem[] = [];
  let lastY = -1;
  for (const item of items) {
    if (lastY === -1 || Math.abs(item.y - lastY) < 5) {
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

const detectSection = (lineStr: string, currentSection: SectionType): SectionType => {
  const isForeignHeader = lineStr.includes('רכישות') && lineStr.includes('בחו"ל');
  const isDomesticHeader =
    lineStr.includes('עסקות') && (lineStr.includes('בארץ') || lineStr.includes('זוכו'));

  if (isForeignHeader) return SectionType.Foreign;
  if (isDomesticHeader) return SectionType.Domestic;
  return currentSection;
};

const createColumnMap = (headerItems: PDFTextItem[]): ColumnMap[] | null => {
  const clusters = clusterItems(headerItems, 15);
  const tempMap: { goal: ColumnGoal; x: number; maxX: number }[] = [];

  for (const cluster of clusters) {
    const matchedGoal = mapHeaderToGoal(cluster.str);
    if (matchedGoal) {
      tempMap.push({ goal: matchedGoal, x: cluster.x, maxX: cluster.maxX });
    }
  }

  if (tempMap.length < 3) return null;

  const sortedMap = tempMap.sort((a, b) => a.x - b.x);
  return sortedMap.map((current, k) => {
    const prev = sortedMap[k - 1];
    const next = sortedMap[k + 1];
    let minX = prev ? (current.x + prev.maxX) / 2 : 0;
    let actualMaxX = next ? (current.maxX + next.x) / 2 : 2000;

    if (current.goal === 'INDUSTRY' && next?.goal === 'BUSINESS_NAME') {
      actualMaxX = current.maxX + (next.x - current.maxX) * 0.1;
    }
    if (current.goal === 'BUSINESS_NAME' && prev?.goal === 'INDUSTRY') {
      minX = prev.maxX + (current.x - prev.maxX) * 0.1;
    }

    return { goal: current.goal, minX, actualMaxX };
  });
};

const parseTransactionRow = (
  line: PDFTextItem[],
  columnMap: ColumnMap[],
  currentSection: SectionType,
): Transaction | null => {
  const rowData: Record<string, string> = {};
  for (const col of columnMap) {
    const colItems = line.filter((it) => {
      const midX = it.x + it.width / 2;
      return midX >= col.minX && midX < col.actualMaxX;
    });

    let text = colItems
      .map((it) => it.str)
      .join(' ')
      .trim();
    if (/[\u0590-\u05FF]/.test(text)) {
      text = text.split(' ').reverse().join(' ');
    }
    rowData[col.goal] = normalizeText(text);
  }

  if (!rowData.DATE || !rowData.CHARGE_AMOUNT) return null;

  const charge = sanitizeAmount(rowData.CHARGE_AMOUNT);
  const original = rowData.ORIGINAL_AMOUNT ? sanitizeAmount(rowData.ORIGINAL_AMOUNT) : charge;
  const business = sanitizeBusinessName(rowData.BUSINESS_NAME);

  if (charge === 0 || !business || business.includes('מסגרת') || business.includes('קרדיט')) {
    return null;
  }

  const industry = currentSection === SectionType.Foreign ? 'חו"ל' : rowData.INDUSTRY || 'other';

  return {
    id: crypto.randomUUID(),
    date: parseDateString(rowData.DATE),
    businessName: business,
    industry: normalizeText(industry) || 'other',
    transactionAmount: original,
    debitAmount: charge,
    details: normalizeText(rowData.DETAILS) || '',
  };
};

export const parsePDF = async (
  file: File,
  onProgress: (p: number) => void,
): Promise<Transaction[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allTransactions: Transaction[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    // Cast text content items to RawTextItem[] to avoid 'unknown' error
    const textContent = (await page.getTextContent()) as { items: RawTextItem[] };
    const lines = extractLinesFromPage(textContent);

    let currentSection = SectionType.Unknown;
    let columnMap: ColumnMap[] | null = null;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineStr = line.map((it) => it.str).join(' ');

      const newSection = detectSection(lineStr, currentSection);
      if (newSection !== currentSection) {
        currentSection = newSection;
        columnMap = null;
        continue;
      }

      const isHeaderLine =
        lineStr.includes('תאריך') ||
        lineStr.includes('סכום') ||
        lineStr.includes('ענף') ||
        lineStr.includes('פירוט');

      if (isHeaderLine) {
        const headerItems = [...line];
        if (lines[j + 1]) headerItems.push(...lines[j + 1]);
        if (lines[j + 2]) headerItems.push(...lines[j + 2]);

        const newMap = createColumnMap(headerItems);
        if (newMap && (!columnMap || newMap.length > columnMap.length)) {
          columnMap = newMap;
          j += 1;
          continue;
        }
      }

      if (!columnMap) continue;

      if (/\b\d{2}\/\d{2}\/\d{2}\b/.test(lineStr) && !lineStr.includes('סה"כ')) {
        const transaction = parseTransactionRow(line, columnMap, currentSection);
        if (transaction) {
          allTransactions.push(transaction);
        }
      }
    }
    onProgress((pageNum / pdf.numPages) * 100);
  }

  return allTransactions;
};
