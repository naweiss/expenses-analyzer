import { createContext, useContext } from 'react';
import { CSVFile, Transaction } from '../utils/csvParser';

export interface ExpenseDataContextType {
  files: CSVFile[];
  addFiles: (
    newFiles: CSVFile[],
    importedCategoryRules?: Record<string, string>,
    importedNotesRules?: Record<string, string>,
  ) => void;
  removeFile: (fileId: string) => void;
  updateTransaction: (
    transactionId: string,
    updates: Partial<Transaction>,
    applyToAllWithSameName?: boolean,
  ) => void;
  allTransactions: Transaction[];
  industryColorMap: Record<string, string>;
  latestTransactionDate: Date | null;
  categoryRules: Record<string, string>;
  notesRules: Record<string, string>;
}

export const ExpenseDataContext = createContext<ExpenseDataContextType | undefined>(undefined);

export const useExpenseData = () => {
  const context = useContext(ExpenseDataContext);
  if (!context) throw new Error('useExpenseData must be used within ExpenseDataProvider');
  return context;
};
