import React, { useState, useMemo, useCallback } from 'react';
import { CSVFile } from '../utils/csvParser';
import { CHART_COLORS } from '../utils/constants';
import { ExpenseDataContext } from './DataContext';

export const ExpenseDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<CSVFile[]>([]);

  const allTransactions = useMemo(() => {
    return files.flatMap((file) => file.transactions);
  }, [files]);

  const latestTransactionDate = useMemo(() => {
    if (allTransactions.length === 0) return null;
    return new Date(Math.max(...allTransactions.map((t) => t.date.getTime())));
  }, [allTransactions]);

  const addFiles = useCallback((newFiles: CSVFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((file) => file.id !== fileId));
  }, []);

  const industryColorMap = useMemo(() => {
    const uniqueIndustries = Array.from(new Set(allTransactions.map((t) => t.industry))).sort();
    const mapping: Record<string, string> = {};
    uniqueIndustries.forEach((industry, index) => {
      mapping[industry] = CHART_COLORS[index % CHART_COLORS.length];
    });
    return mapping;
  }, [allTransactions]);

  const value = useMemo(
    () => ({
      files,
      addFiles,
      removeFile,
      allTransactions,
      industryColorMap,
      latestTransactionDate,
    }),
    [files, addFiles, removeFile, allTransactions, industryColorMap, latestTransactionDate],
  );

  return <ExpenseDataContext.Provider value={value}>{children}</ExpenseDataContext.Provider>;
};
