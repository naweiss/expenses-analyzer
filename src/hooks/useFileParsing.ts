import { useCallback } from 'react';
import { useExpenseData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useDashboardUI, ProcessingFile } from '../context/UIContext';
import { parseCSV, CSVFile } from '../utils/csvParser';

export type { ProcessingFile };

export const useFileParsing = () => {
  const { addFiles, categoryRules, notesRules } = useExpenseData();
  const { translation } = useLanguage();
  const { requestConfirmation, processingFiles, setProcessingFiles, removeProcessingFile } =
    useDashboardUI();

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newProcessingFiles: ProcessingFile[] = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
      }));

      setProcessingFiles((prev) => [...prev, ...newProcessingFiles]);

      void (async () => {
        const updateProgress = (processingId: string, progress: number) => {
          setProcessingFiles((prev) =>
            prev.map((f) => (f.id === processingId ? { ...f, progress } : f)),
          );
        };

        const allParsedFiles: CSVFile[] = [];
        let incomingCategoryRules: Record<string, string> = {};
        let incomingNotesRules: Record<string, string> = {};
        const successfulIds: string[] = [];

        await Promise.all(
          acceptedFiles.map(async (file, index) => {
            const processingId = newProcessingFiles[index].id;
            try {
              const res = await parseCSV(file, (pct) => updateProgress(processingId, pct));
              allParsedFiles.push(...res.files);
              incomingCategoryRules = { ...incomingCategoryRules, ...res.categoryRules };
              incomingNotesRules = { ...incomingNotesRules, ...res.notesRules };
              successfulIds.push(processingId);
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Failed to parse file';
              setProcessingFiles((prev) =>
                prev.map((f) => (f.id === processingId ? { ...f, error: message } : f)),
              );
            }
          }),
        );

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

        if (allParsedFiles.length > 0 && shouldPromptRuleConfirmation) {
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

        if (processedFiles.length > 0) {
          addFiles(processedFiles, mergedCategoryRules, mergedNotesRules);
        }

        if (successfulIds.length > 0) {
          const successSet = new Set(successfulIds);
          setProcessingFiles((prev) => prev.filter((f) => !successSet.has(f.id)));
        }
      })();
    },
    [
      addFiles,
      categoryRules,
      notesRules,
      translation.applyActiveRules,
      requestConfirmation,
      setProcessingFiles,
    ],
  );

  return {
    processingFiles,
    handleFilesDrop,
    removeProcessingFile,
  };
};
