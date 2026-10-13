import * as pdfjsLib from 'pdfjs-dist';
import { Transaction } from '../../utils/csvParser';
import {
  SectionType,
  Boundary,
  PDFTextItem,
  RawTextItem,
  extractLinesFromPage,
  detectSection,
  detectTableBoundaries,
  parseTransactionRow,
} from '../../utils/pdfParser';

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

export const parsePDFWithDebug = async (
  file: File | Uint8Array | ArrayBuffer,
  onProgress?: (p: number) => void,
): Promise<PdfDebugResult> => {
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

    const lines = extractLinesFromPage(textContent);

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
        const debugWords: DebugWord[] = line.map((it) => ({
          ...it,
          height: it.height ?? 10,
          rowY: lineY,
        }));
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
        const debugWords: DebugWord[] = line.map((it) => ({
          ...it,
          height: it.height ?? 10,
          rowY: lineY,
        }));
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
              height: it.height ?? 10,
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
        const debugWords: DebugWord[] = line.map((it) => ({
          ...it,
          height: it.height ?? 10,
          rowY: lineY,
        }));
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
            height: it.height ?? 10,
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
        const debugWords: DebugWord[] = line.map((it) => ({
          ...it,
          height: it.height ?? 10,
          rowY: lineY,
        }));
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
