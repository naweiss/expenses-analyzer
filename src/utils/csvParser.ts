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

export const parseCSV = (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results: ParseResult<Record<string, string>>) => {
        try {
          const validTransactions = results.data
            .map((row) => {
              const columns = Object.values(row);

              // Try to find values by common header names or fall back to column index
              const dateVal = row.Date || row['תאריך'] || columns[0];
              const nameVal = row['Business Name'] || row['שם בית העסק'] || columns[1];
              const industryVal = row.Category || row.Industry || row['ענף'] || columns[2];
              const amountVal = row['Transaction Amount'] || row['סכום עסקה'] || columns[3];
              const debitVal = row['Debit Amount'] || row['סכום חיוב'] || columns[4];
              const detailsVal = row.Details || row['פירוט'] || columns[5];
              const notesVal = row.Notes || row['הערות'] || '';

              return {
                id: crypto.randomUUID(),
                date: parseDateString(dateVal),
                businessName: normalizeText(nameVal) || 'unknown',
                industry: normalizeText(industryVal) || 'other',
                transactionAmount: sanitizeAmount(amountVal),
                debitAmount: sanitizeAmount(debitVal),
                details: normalizeText(detailsVal) || '',
                userNotes: normalizeText(notesVal) || undefined,
              };
            })
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
