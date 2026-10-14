import { useCallback } from 'react';
import { useExpenseData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useDashboardUI, ProcessingFile } from '../context/UIContext';
import { parseCSV, CSVFile } from '../utils/csvParser';
import { parsePDF } from '../utils/pdfParser';
import { FileParsingError, FileErrorCode, FileErrorInfo } from '../utils/fileErrors';

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
              if (file.name.toLowerCase().endsWith('.pdf')) {
                const transactions = await parsePDF(file, (pct) =>
                  updateProgress(processingId, pct),
                );
                if (transactions.length === 0) {
                  throw new FileParsingError(FileErrorCode.NoValidTransactions);
                }
                allParsedFiles.push({
                  id: crypto.randomUUID(),
                  name: file.name,
                  transactions,
                });
                successfulIds.push(processingId);
              } else {
                const res = await parseCSV(file, (pct) => updateProgress(processingId, pct));
                allParsedFiles.push(...res.files);
                incomingCategoryRules = { ...incomingCategoryRules, ...res.categoryRules };
                incomingNotesRules = { ...incomingNotesRules, ...res.notesRules };
                successfulIds.push(processingId);
              }
            } catch (err) {
              let errorInfo: FileErrorInfo;
              if (err instanceof FileParsingError) {
                errorInfo = { code: err.code, params: err.params };
              } else if (err instanceof Error) {
                if (err.name === 'PasswordException') {
                  errorInfo = { code: FileErrorCode.PasswordProtected };
                } else if (err.name === 'InvalidPDFException') {
                  errorInfo = { code: FileErrorCode.UnsupportedFormat };
                } else {
                  errorInfo = { code: FileErrorCode.UnknownError };
                }
              } else {
                errorInfo = { code: FileErrorCode.UnknownError };
              }
              setProcessingFiles((prev) =>
                prev.map((f) => (f.id === processingId ? { ...f, error: errorInfo } : f)),
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
