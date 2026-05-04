import { createContext, useContext } from 'react';
import { CSVFile, Transaction } from '../utils/csvParser';

export interface ExpenseDataContextType {
  files: CSVFile[];
  addFiles: (newFiles: CSVFile[]) => void;
  removeFile: (fileId: string) => void;
  allTransactions: Transaction[];
  industryColorMap: Record<string, string>;
  latestTransactionDate: Date | null;
}

export const ExpenseDataContext = createContext<ExpenseDataContextType | undefined>(undefined);

export const useExpenseData = () => {
  const context = useContext(ExpenseDataContext);
  if (!context) throw new Error('useExpenseData must be used within ExpenseDataProvider');
  return context;
};
