import React, { useState, useMemo, useCallback } from 'react';
import { CSVFile, Transaction } from '../utils/csvParser';
import { CHART_COLORS } from '../utils/constants';
import { ExpenseDataContext } from './DataContext';

export const ExpenseDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<CSVFile[]>([]);
  const [categoryRules, setCategoryRules] = useState<Record<string, string>>({});
  const [notesRules, setNotesRules] = useState<Record<string, string>>({});

  const allTransactions = useMemo(() => {
    return files.flatMap((file) => file.transactions);
  }, [files]);

  const latestTransactionDate = useMemo(() => {
    if (allTransactions.length === 0) return null;

    const maxTime = allTransactions.reduce((max, t) => {
      const time = t.date.getTime();
      return time > max ? time : max;
    }, -Infinity);

    return isFinite(maxTime) ? new Date(maxTime) : null;
  }, [allTransactions]);

  const addFiles = useCallback((newFiles: CSVFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => {
      const remainingFiles = prev.filter((file) => file.id !== fileId);
      if (remainingFiles.length === 0) {
        setCategoryRules({});
        setNotesRules({});
      }
      return remainingFiles;
    });
  }, []);

  const updateTransaction = useCallback(
    (transactionId: string, updates: Partial<Transaction>, applyToAllWithSameName = false) => {
      let businessName: string | undefined;
      outer: for (const file of files) {
        for (const t of file.transactions) {
          if (t.id === transactionId) {
            businessName = t.businessName;
            break outer;
          }
        }
      }

      if (applyToAllWithSameName && businessName) {
        const newIndustry = updates.industry;
        if (newIndustry !== undefined) {
          setCategoryRules((prevRules) => ({ ...prevRules, [businessName]: newIndustry }));
        }
        const newNotes = updates.userNotes;
        if (newNotes !== undefined) {
          setNotesRules((prevRules) => ({ ...prevRules, [businessName]: newNotes }));
        }
      }

      setFiles((prev) => {
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
    [files],
  );

  const importBackup = useCallback(
    (
      backupFiles: CSVFile[],
      importedCategoryRules: Record<string, string>,
      importedNotesRules: Record<string, string>,
    ) => {
      setFiles(backupFiles);
      setCategoryRules(importedCategoryRules);
      setNotesRules(importedNotesRules);
    },
    [],
  );

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
      updateTransaction,
      allTransactions,
      industryColorMap,
      latestTransactionDate,
      categoryRules,
      notesRules,
      importBackup,
    }),
    [
      files,
      addFiles,
      removeFile,
      updateTransaction,
      allTransactions,
      industryColorMap,
      latestTransactionDate,
      categoryRules,
      notesRules,
      importBackup,
    ],
  );

  return <ExpenseDataContext.Provider value={value}>{children}</ExpenseDataContext.Provider>;
};
