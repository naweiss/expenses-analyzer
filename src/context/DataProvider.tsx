import React, { useState, useMemo, useCallback } from 'react';
import { CSVFile, Transaction } from '../types/domain';
import { CHART_COLORS } from '../utils/constants';
import { ExpenseDataContext } from './DataContext';

export const ExpenseDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<CSVFile[]>([]);

  const allTransactions = useMemo(() => files.flatMap((file) => file.transactions), [files]);

  const latestTransactionDate = useMemo(() => {
    if (allTransactions.length === 0) return null;
    const maxTime = Math.max(...allTransactions.map((t) => t.date.getTime()));
    return isFinite(maxTime) ? new Date(maxTime) : null;
  }, [allTransactions]);

  const industryColorMap = useMemo(() => {
    const industries = Array.from(new Set(allTransactions.map((t) => t.industry))).sort();
    return industries.reduce<Record<string, string>>((acc, industry, index) => {
      acc[industry] = CHART_COLORS[index % CHART_COLORS.length];
      return acc;
    }, {});
  }, [allTransactions]);

  const addFiles = useCallback((newFiles: CSVFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  const updateTransaction = useCallback(
    (transactionId: string, updates: Partial<Transaction>, applyToAllWithSameName = false) => {
      setFiles((prev) => {
        let businessName: string | undefined;

        if (applyToAllWithSameName) {
          for (const file of prev) {
            const found = file.transactions.find((t) => t.id === transactionId);
            if (found) {
              businessName = found.businessName;
              break;
            }
          }
        }

        return prev.map((file) => ({
          ...file,
          transactions: file.transactions.map((t): Transaction => {
            const isMatch =
              t.id === transactionId || (applyToAllWithSameName && t.businessName === businessName);
            return isMatch ? { ...t, ...updates } : t;
          }),
        }));
      });
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      files,
      addFiles,
      removeFile,
      updateTransaction,
      allTransactions,
      industryColorMap,
      latestTransactionDate,
    }),
    [
      files,
      addFiles,
      removeFile,
      updateTransaction,
      allTransactions,
      industryColorMap,
      latestTransactionDate,
    ],
  );

  return <ExpenseDataContext.Provider value={contextValue}>{children}</ExpenseDataContext.Provider>;
};
