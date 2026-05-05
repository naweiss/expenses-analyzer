import * as pdfjsLib from 'pdfjs-dist';
import { Transaction } from './csvParser';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';

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
  goal: string;
  minX: number;
  actualMaxX: number;
}

const COLUMN_GOALS: Record<string, string[]> = {
  DATE: ['תאריך'],
  BUSINESS_NAME: ['עסק', 'בית עסק', 'שם בית העסק', 'שם בית עסק', 'שם העסק', 'שם'],
  INDUSTRY: ['ענף'],
  ORIGINAL_AMOUNT: ['סכום מקורי', 'סכום עסקה'],
  CHARGE_AMOUNT: ['סכום החיוב', 'החיוב'],
  DETAILS: ['פירוט', 'נוסף'],
};

const isTextItem = (item: unknown): item is { str: string; transform: number[]; width: number } => {
  return (
    item !== null &&
    typeof item === 'object' &&
    'str' in item &&
    'transform' in item &&
    Array.isArray((item as { transform: unknown }).transform) &&
    'width' in item
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

export const parsePDF = async (
  file: File,
  onProgress: (p: number) => void,
): Promise<Transaction[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allTransactions: Transaction[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items: PDFTextItem[] = (textContent.items as unknown[])
      .filter(isTextItem)
      .map((item) => ({
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

    let currentSection = 'unknown';
    let columnMap: ColumnMap[] | null = null;

    for (let j = 0; j < lines.length; j++) {
      const line = lines[j];
      const lineStr = line.map((it) => it.str).join(' ');

      // Flexible section detection
      const isForeignHeader = lineStr.includes('רכישות') && lineStr.includes('בחו"ל');
      const isDomesticHeader =
        lineStr.includes('עסקות') && (lineStr.includes('בארץ') || lineStr.includes('זוכו'));

      if (isForeignHeader) {
        currentSection = 'foreign';
        columnMap = null;
        continue;
      }
      if (isDomesticHeader) {
        currentSection = 'domestic';
        columnMap = null;
        continue;
      }

      // Header detection
      const hasDate = lineStr.includes('תאריך');
      const hasAmount = lineStr.includes('סכום');
      const hasIndustry = lineStr.includes('ענף');
      const hasDetails = lineStr.includes('פירוט');

      if (hasDate || hasAmount || hasIndustry || hasDetails) {
        const headerItems = [...line];
        if (lines[j + 1]) headerItems.push(...lines[j + 1]);
        if (lines[j + 2]) headerItems.push(...lines[j + 2]);

        const clusters = clusterItems(headerItems, 15);
        const tempMap: { goal: string; x: number; maxX: number }[] = [];
        for (const cluster of clusters) {
          let matchedGoal: string | null = null;
          if (
            (cluster.str.includes('סכום') &&
              (cluster.str.includes('חיוב') || cluster.str.includes('לתשלום'))) ||
            cluster.str.includes('בש"ח')
          ) {
            matchedGoal = 'CHARGE_AMOUNT';
          } else if (
            cluster.str.includes('סכום') &&
            (cluster.str.includes('עסקה') || cluster.str.includes('מקורי'))
          ) {
            matchedGoal = 'ORIGINAL_AMOUNT';
          } else {
            for (const [goal, keywords] of Object.entries(COLUMN_GOALS)) {
              if (goal === 'CHARGE_AMOUNT' || goal === 'ORIGINAL_AMOUNT') continue;
              if (keywords.some((k) => cluster.str.includes(k))) {
                matchedGoal = goal;
                break;
              }
            }
          }

          if (matchedGoal) {
            tempMap.push({ goal: matchedGoal, x: cluster.x, maxX: cluster.maxX });
          }
        }

        if (tempMap.length >= 3) {
          const sortedMap = tempMap.sort((a, b) => a.x - b.x);
          const newMap = sortedMap.map((current, k) => {
            const prev = sortedMap[k - 1];
            const next = sortedMap[k + 1];
            let minX = prev ? (current.x + prev.maxX) / 2 : 0;
            let actualMaxX = next ? (current.maxX + next.x) / 2 : 2000;

            // Weighted boundary: Industry column is usually narrow and content is centered.
            // Business name is wide and often overflows to the left (smaller X in RTL).
            if (current.goal === 'INDUSTRY' && next?.goal === 'BUSINESS_NAME') {
              actualMaxX = current.maxX + (next.x - current.maxX) * 0.1;
            }
            if (current.goal === 'BUSINESS_NAME' && prev?.goal === 'INDUSTRY') {
              minX = prev.maxX + (current.x - prev.maxX) * 0.1;
            }

            return {
              goal: current.goal,
              minX,
              actualMaxX,
            };
          });

          if (!columnMap || newMap.length > columnMap.length) {
            columnMap = newMap;
            j += 1;
            continue;
          }
        }
      }

      if (!columnMap) continue;

      const dateMatch = /\b\d{2}\/\d{2}\/\d{2}\b/.exec(lineStr);
      if (dateMatch && !lineStr.includes('סה"כ')) {
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

        if (rowData.DATE && rowData.CHARGE_AMOUNT) {
          const charge = sanitizeAmount(rowData.CHARGE_AMOUNT);
          const original = rowData.ORIGINAL_AMOUNT
            ? sanitizeAmount(rowData.ORIGINAL_AMOUNT)
            : charge;
          const business = sanitizeBusinessName(rowData.BUSINESS_NAME);

          if (
            charge !== 0 &&
            business &&
            !business.includes('מסגרת') &&
            !business.includes('קרדיט')
          ) {
            const industry = currentSection === 'foreign' ? 'חו"ל' : rowData.INDUSTRY || 'other';

            allTransactions.push({
              id: crypto.randomUUID(),
              date: parseDateString(rowData.DATE),
              businessName: business,
              industry: normalizeText(industry) || 'other',
              transactionAmount: original,
              debitAmount: charge,
              details: normalizeText(rowData.DETAILS) || '',
            });
          }
        }
      }
    }

    onProgress((pageNum / pdf.numPages) * 100);
  }

  return allTransactions;
};
