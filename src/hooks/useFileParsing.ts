import { useCallback } from 'react';
import { useExpenseData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useDashboardUI } from '../context/UIContext';
import { parseCSV, parseBackupCSV, isBackupFile, CSVFile } from '../utils/csvParser';

export const useFileParsing = () => {
  const { addFiles, importBackup, categoryRules, notesRules } = useExpenseData();
  const { translation } = useLanguage();
  const { requestConfirmation } = useDashboardUI();

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      void (async () => {
        const backupFilesList: File[] = [];
        const rawFilesList: File[] = [];

        for (const file of acceptedFiles) {
          const isBackup = await isBackupFile(file);
          if (isBackup) {
            backupFilesList.push(file);
          } else {
            rawFilesList.push(file);
          }
        }

        let restoredFiles: CSVFile[] = [];
        let mergedCategoryRules: Record<string, string> = { ...categoryRules };
        let mergedNotesRules: Record<string, string> = { ...notesRules };

        for (const file of backupFilesList) {
          try {
            const parsedBackup = await parseBackupCSV(file);
            restoredFiles = [...restoredFiles, ...parsedBackup.files];
            mergedCategoryRules = { ...mergedCategoryRules, ...parsedBackup.categoryRules };
            mergedNotesRules = { ...mergedNotesRules, ...parsedBackup.notesRules };
          } catch (err) {
            console.error('Failed to parse backup:', err);
          }
        }

        const parsedRawFiles: CSVFile[] = await Promise.all(
          rawFilesList.map(async (file) => {
            const transactions = await parseCSV(file);
            return {
              id: crypto.randomUUID(),
              name: file.name,
              transactions,
            };
          }),
        );

        let processedRawFiles = parsedRawFiles;
        const hasActiveRules =
          Object.keys(mergedCategoryRules).length > 0 || Object.keys(mergedNotesRules).length > 0;

        if (rawFilesList.length > 0 && hasActiveRules) {
          const shouldApplyRules = await requestConfirmation(translation.applyActiveRules);
          if (shouldApplyRules) {
            processedRawFiles = parsedRawFiles.map((file) => ({
              ...file,
              transactions: file.transactions.map((t) => {
                const ruleCategory = mergedCategoryRules[t.businessName];
                const ruleNotes = mergedNotesRules[t.businessName];
                return {
                  ...t,
                  industry: ruleCategory ?? t.industry,
                  userNotes: ruleNotes ?? t.userNotes,
                };
              }),
            }));
          }
        }

        if (backupFilesList.length > 0) {
          importBackup(
            [...restoredFiles, ...processedRawFiles],
            mergedCategoryRules,
            mergedNotesRules,
          );
        } else if (processedRawFiles.length > 0) {
          addFiles(processedRawFiles);
        }
      })();
    },
    [
      addFiles,
      importBackup,
      categoryRules,
      notesRules,
      translation.applyActiveRules,
      requestConfirmation,
    ],
  );

  return { handleFilesDrop };
};
