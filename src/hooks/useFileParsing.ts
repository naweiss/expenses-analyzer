import { useCallback } from 'react';
import { useExpenseData } from '../context/DataContext';
import { parseCSV, CSVFile } from '../utils/csvParser';

export const useFileParsing = () => {
  const { addFiles } = useExpenseData();

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      void (async () => {
        const newlyParsedFiles: CSVFile[] = await Promise.all(
          acceptedFiles.map(async (file) => {
            const transactions = await parseCSV(file);

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

  return { handleFilesDrop };
};
