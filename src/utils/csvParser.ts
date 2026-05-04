import Papa, { ParseResult } from 'papaparse';

export interface Transaction {
  id: string;
  date: Date;
  businessName: string;
  industry: string;
  transactionAmount: number;
  debitAmount: number;
  details: string;
}

export interface CSVFile {
  id: string;
  name: string;
  transactions: Transaction[];
}

const sanitizeAmount = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove currency symbols, commas, and other non-numeric chars except . and -
  const cleanedValue = value.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleanedValue);
  return isNaN(parsed) ? 0 : parsed;
};

const parseDateString = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(NaN);

  const trimmed = dateString.trim();

  // Handle DD/MM/YYYY or DD/MM/YY
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/');
    if (segments.length === 3) {
      const [day, month, yearPart] = segments;
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10) - 1; // 0-indexed
      const y = parseInt(year, 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback to native Date parser for ISO and other common formats
  return new Date(trimmed);
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
            .map((row) => {
              const columns = Object.values(row);
              return {
                id: crypto.randomUUID(),
                date: parseDateString(columns[0]),
                businessName: columns[1]?.trim() || 'unknown',
                industry: columns[2]?.trim() || 'other',
                transactionAmount: sanitizeAmount(columns[3]),
                debitAmount: sanitizeAmount(columns[4]),
                details: columns[5]?.trim() || '',
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
