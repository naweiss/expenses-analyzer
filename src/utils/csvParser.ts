import Papa, { ParseResult } from 'papaparse';
import { Transaction } from '../types/domain';
import { parseDateString, sanitizeAmount, normalizeText } from './parserUtils';
import { getRowValue } from './parserSchema';

const mapRowToTransaction = (row: Record<string, string>): Transaction => {
  const dateVal = getRowValue(row, 'DATE');
  const nameVal = getRowValue(row, 'BUSINESS_NAME');
  const industryVal = getRowValue(row, 'INDUSTRY');
  const amountVal = getRowValue(row, 'ORIGINAL_AMOUNT');
  const debitVal = getRowValue(row, 'CHARGE_AMOUNT');
  const detailsVal = getRowValue(row, 'DETAILS');
  const notesVal = getRowValue(row, 'NOTES');

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
};

export const parseCSV = (file: File): Promise<Transaction[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: 'UTF-8',
      complete: (results: ParseResult<Record<string, string>>) => {
        try {
          const validTransactions = results.data
            .map(mapRowToTransaction)
            .filter((t) => !isNaN(t.date.getTime()));

          resolve(validTransactions);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Failed to process CSV data';
          reject(new Error(message));
        }
      },
      error: (error: Error) => reject(error),
    });
  });
};
