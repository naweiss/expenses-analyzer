import Papa, { ParseResult } from 'papaparse';
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

export const parseCSV = (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      comments: '#',
      complete: (results: ParseResult<Record<string, string>>) => {
        try {
          const validTransactions = results.data
            .map(rowToTransaction)
            .filter((transaction) => !isNaN(transaction.date.getTime()));
          resolve(validTransactions);
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to process CSV data'));
        }
      },
      error: (error: Error) => reject(error),
    });
  });
};

export interface BackupData {
  files: CSVFile[];
  categoryRules: Record<string, string>;
  notesRules: Record<string, string>;
}

export const isBackupFile = (file: File): Promise<boolean> => {
  return new Promise((resolve) => {
    Papa.parse(file, {
      preview: 1,
      header: true,
      comments: '#',
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        resolve(fields.includes('File Name'));
      },
      error: () => resolve(false),
    });
  });
};

export const parseBackupCSV = (file: File): Promise<BackupData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const fileContent = event.target?.result as string;
        if (!fileContent) {
          throw new Error('Empty file content');
        }

        const lines = fileContent.split(/\r?\n/);
        const categoryRules: Record<string, string> = {};
        const notesRules: Record<string, string> = {};

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

        Papa.parse<Record<string, string>>(fileContent, {
          header: true,
          skipEmptyLines: true,
          comments: '#',
          complete: (results) => {
            try {
              const transactionsByFile = new Map<string, Transaction[]>();

              for (const row of results.data) {
                const fileName = row['File Name'] ?? 'restored_backup.csv';
                const transaction = rowToTransaction(row);

                if (!isNaN(transaction.date.getTime())) {
                  const transactionsList = transactionsByFile.get(fileName) ?? [];
                  transactionsList.push(transaction);
                  transactionsByFile.set(fileName, transactionsList);
                }
              }

              const restoredFiles: CSVFile[] = Array.from(transactionsByFile.entries()).map(
                ([name, transactions]) => ({
                  id: crypto.randomUUID(),
                  name,
                  transactions,
                }),
              );

              resolve({ files: restoredFiles, categoryRules, notesRules });
            } catch (err) {
              reject(err instanceof Error ? err : new Error(String(err)));
            }
          },
          error: (error: Error) => reject(error),
        });
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Failed to parse backup CSV'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file, 'UTF-8');
  });
};
