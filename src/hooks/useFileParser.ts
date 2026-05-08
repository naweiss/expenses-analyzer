import { useState, useCallback } from 'react';
import { CSVFile } from '../types/domain';
import { parseCSV } from '../utils/csvParser';
import { parsePDF } from '../utils/pdfParser';

export interface ProcessingFile {
  id: string;
  name: string;
  progress: number;
  error?: string;
}

export const useFileParser = (onComplete: (files: CSVFile[]) => void) => {
  const [processingFiles, setProcessingFiles] = useState<ProcessingFile[]>([]);

  const parseFiles = useCallback(
    async (acceptedFiles: File[]) => {
      const newProcessingFiles = acceptedFiles.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        progress: 0,
      }));

      setProcessingFiles((prev) => [...prev, ...newProcessingFiles]);

      const newlyParsedFiles: CSVFile[] = [];

      for (let i = 0; i < acceptedFiles.length; i++) {
        const file = acceptedFiles[i];
        const processingId = newProcessingFiles[i].id;

        const updateProgress = (progress: number) => {
          setProcessingFiles((prev) =>
            prev.map((f) => (f.id === processingId ? { ...f, progress } : f)),
          );
        };

        try {
          let transactions = [];
          if (file.name.toLowerCase().endsWith('.pdf')) {
            transactions = await parsePDF(file, updateProgress);
          } else {
            transactions = await parseCSV(file);
            updateProgress(100);
          }

          newlyParsedFiles.push({
            id: crypto.randomUUID(),
            name: file.name,
            transactions,
          });

          // Remove from processing list once successfully done
          setProcessingFiles((prev) => prev.filter((f) => f.id !== processingId));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          setProcessingFiles((prev) =>
            prev.map((f) => (f.id === processingId ? { ...f, error: message } : f)),
          );
        }
      }

      if (newlyParsedFiles.length > 0) {
        onComplete(newlyParsedFiles);
      }
    },
    [onComplete],
  );

  const removeProcessingFile = useCallback((id: string) => {
    setProcessingFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
    parseFiles,
    processingFiles,
    removeProcessingFile,
  };
};
