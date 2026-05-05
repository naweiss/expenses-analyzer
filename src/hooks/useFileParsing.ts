import { useCallback, useState } from 'react';
import { useExpenseData } from '../context/DataContext';
import { parseCSV, CSVFile } from '../utils/csvParser';
import { parsePDF } from '../utils/pdfParser';

export interface ProcessingFile {
  id: string;
  name: string;
  progress: number;
}

export const useFileParsing = () => {
  const { addFiles } = useExpenseData();
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newProcessingFiles = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
      }));

      setProcessingFiles((prev) => [...prev, ...newProcessingFiles]);

      void (async () => {
        const newlyParsedFiles: CSVFile[] = await Promise.all(
          acceptedFiles.map(async (file, index) => {
            const processingId = newProcessingFiles[index].id;
            const updateProgress = (progress: number) => {
              setProcessingFiles((prev) =>
                prev.map((f) => (f.id === processingId ? { ...f, progress } : f)),
              );
            };

            let transactions = [];
            if (file.name.toLowerCase().endsWith('.pdf')) {
              transactions = await parsePDF(file, updateProgress);
            } else {
              transactions = await parseCSV(file);
              updateProgress(100);
            }

            // Remove from processing list once done
            setProcessingFiles((prev) => prev.filter((f) => f.id !== processingId));

            return {
              id: crypto.randomUUID(),
              name: file.name,
              transactions,
            };
          }),
        );
        addFiles(newlyParsedFiles);
      })();
    },
    [addFiles],
  );

  return { handleFilesDrop, processingFiles };
};
