import Papa from 'papaparse';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';

export interface Transaction {
  id: string;
  date: Date;
  businessName: string;
  industry: string;
  transactionAmount: number;
  debitAmount: number;
  details: string;
  userNotes?: string;
}

export interface CSVFile {
  id: string;
  name: string;
  transactions: Transaction[];
}

export interface ParsedCSVResult {
  files: CSVFile[];
  categoryRules: Record<string, string>;
  notesRules: Record<string, string>;
}

export const rowToTransaction = (row: Record<string, string>): Transaction => {
  return {
    id: crypto.randomUUID(),
    date: parseDateString(row.Date ?? ''),
    businessName: normalizeText(row['Business Name'] ?? '') || 'unknown',
    industry: normalizeText(row.Category ?? '') || 'other',
    transactionAmount: sanitizeAmount(row['Transaction Amount'] ?? ''),
    debitAmount: sanitizeAmount(row['Debit Amount'] ?? ''),
    details: normalizeText(row.Details ?? '') || '',
    userNotes: normalizeText(row.Notes ?? '') || undefined,
  };
};

export const validateCSVHeaders = (fields?: string[]): string | null => {
  const missing: string[] = [];

  if (!fields?.includes('Date')) {
    missing.push('Date');
  }
  if (!fields?.includes('Business Name')) {
    missing.push('Business Name');
  }
  if (!fields?.includes('Debit Amount') && !fields?.includes('Transaction Amount')) {
    missing.push('Debit Amount');
  }

  if (missing.length > 0) {
    return `Missing required columns: ${missing.join(', ')}`;
  }

  return null;
};

export const parseRuleComments = (
  content: string,
): { categoryRules: Record<string, string>; notesRules: Record<string, string> } => {
  const categoryRules: Record<string, string> = {};
  const notesRules: Record<string, string> = {};

  const lines = content.split(/\r?\n/);
  const categoryPrefix = '# RULE:category:';
  const notesPrefix = '# RULE:notes:';

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith(categoryPrefix)) {
      const rulePayload = trimmedLine.substring(categoryPrefix.length);
      const ruleParts = rulePayload.split(':');
      if (ruleParts.length >= 2) {
        const merchant = ruleParts[0];
        const categoryValue = ruleParts.slice(1).join(':');
        categoryRules[merchant] = categoryValue;
      }
    } else if (trimmedLine.startsWith(notesPrefix)) {
      const rulePayload = trimmedLine.substring(notesPrefix.length);
      const ruleParts = rulePayload.split(':');
      if (ruleParts.length >= 2) {
        const merchant = ruleParts[0];
        const notesValue = ruleParts.slice(1).join(':');
        notesRules[merchant] = notesValue;
      }
    } else if (trimmedLine && !trimmedLine.startsWith('#')) {
      break;
    }
  }

  return { categoryRules, notesRules };
};

export const extractRulesFromFile = (
  file: File,
): Promise<{ categoryRules: Record<string, string>; notesRules: Record<string, string> }> => {
  return new Promise((resolve) => {
    const slice = file.slice(0, 512 * 1024);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || '';
      resolve(parseRuleComments(content));
    };
    reader.onerror = () => resolve({ categoryRules: {}, notesRules: {} });
    reader.readAsText(slice, 'UTF-8');
  });
};

export const CHUNK_SIZE = 1024 * 1024; // 1 MB

export const parseCSV = (
  file: File,
  onProgress?: (progress: number) => void,
): Promise<ParsedCSVResult> => {
  return new Promise((resolve, reject) => {
    if (file.size === 0) {
      reject(new Error('File is empty'));
      return;
    }

    extractRulesFromFile(file)
      .then(({ categoryRules, notesRules }) => {
        const transactionsByFile = new Map<string, Transaction[]>();
        let hasCheckedHeaders = false;
        let isAborted = false;

        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          encoding: 'UTF-8',
          comments: '#',
          chunkSize: CHUNK_SIZE,
          chunk: (results, parser) => {
            try {
              if (!hasCheckedHeaders) {
                const headerError = validateCSVHeaders(results.meta.fields);
                if (headerError) {
                  isAborted = true;
                  parser.abort();
                  reject(new Error(headerError));
                  return;
                }
                hasCheckedHeaders = true;
              }

              for (const row of results.data) {
                const transaction = rowToTransaction(row);
                if (!isNaN(transaction.date.getTime())) {
                  const fileName = row['File Name'] || file.name;
                  const list = transactionsByFile.get(fileName) ?? [];
                  list.push(transaction);
                  transactionsByFile.set(fileName, list);
                }
              }

              if (results.meta.cursor !== undefined && onProgress) {
                const pct = Math.min(100, Math.round((results.meta.cursor / file.size) * 100));
                onProgress(pct);
              }
            } catch (error) {
              isAborted = true;
              parser.abort();
              reject(error instanceof Error ? error : new Error('Failed to process CSV data'));
            }
          },
          complete: () => {
            if (isAborted) return;
            onProgress?.(100);

            if (transactionsByFile.size === 0) {
              reject(new Error('No valid transactions found in file'));
              return;
            }

            const parsedFiles: CSVFile[] = Array.from(transactionsByFile.entries()).map(
              ([name, transactions]) => ({
                id: crypto.randomUUID(),
                name,
                transactions,
              }),
            );

            resolve({ files: parsedFiles, categoryRules, notesRules });
          },
          error: (error: Error) => reject(error),
        });
      })
      .catch((err) => {
        reject(err instanceof Error ? err : new Error('Failed to read file'));
      });
  });
};
