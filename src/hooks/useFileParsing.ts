import { useCallback } from 'react';
import { useExpenseData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useDashboardUI } from '../context/UIContext';
import { parseCSV, CSVFile } from '../utils/csvParser';

export const useFileParsing = () => {
  const { addFiles, categoryRules, notesRules } = useExpenseData();
  const { translation } = useLanguage();
  const { requestConfirmation } = useDashboardUI();

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      void (async () => {
        let allParsedFiles: CSVFile[] = [];
        let incomingCategoryRules: Record<string, string> = {};
        let incomingNotesRules: Record<string, string> = {};

        for (const file of acceptedFiles) {
          try {
            const parsed = await parseCSV(file);
            allParsedFiles = [...allParsedFiles, ...parsed.files];
            incomingCategoryRules = { ...incomingCategoryRules, ...parsed.categoryRules };
            incomingNotesRules = { ...incomingNotesRules, ...parsed.notesRules };
          } catch (err) {
            console.error('Failed to parse file:', err);
          }
        }

        const hasPriorRules =
          Object.keys(categoryRules).length > 0 || Object.keys(notesRules).length > 0;
        const hasIncomingRules =
          Object.keys(incomingCategoryRules).length > 0 ||
          Object.keys(incomingNotesRules).length > 0;

        const mergedCategoryRules = { ...categoryRules, ...incomingCategoryRules };
        const mergedNotesRules = { ...notesRules, ...incomingNotesRules };

        let processedFiles = allParsedFiles;
        const shouldPromptRuleConfirmation =
          hasPriorRules || (hasIncomingRules && acceptedFiles.length > 1);

        if (shouldPromptRuleConfirmation) {
          const shouldApplyRules = await requestConfirmation(translation.applyActiveRules);
          if (shouldApplyRules) {
            processedFiles = allParsedFiles.map((file) => ({
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

        addFiles(processedFiles, mergedCategoryRules, mergedNotesRules);
      })();
    },
    [addFiles, categoryRules, notesRules, translation.applyActiveRules, requestConfirmation],
  );

  return { handleFilesDrop };
};
