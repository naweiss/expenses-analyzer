import React, { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Plus, X, Layers } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { parseCSV, CSVFile } from '../../utils/csvParser';
import styles from './FileNavigator.module.css';

const FileNavigator: React.FC = () => {
  const { translation } = useLanguage();
  const { files, addFiles, removeFile } = useExpenseData();
  const { currentFileIndex, setCurrentFileIndex } = useDashboardUI();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      const csvFilesToProcess = acceptedFiles.filter((file) =>
        file.name.toLowerCase().endsWith('.csv'),
      );

      void (async () => {
        const newlyParsedFiles: CSVFile[] = await Promise.all(
          csvFilesToProcess.map(async (file) => ({
            id: crypto.randomUUID(),
            name: file.name,
            transactions: await parseCSV(file),
          })),
        );
        addFiles(newlyParsedFiles);
      })();
    },
    [addFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesDrop,
    accept: { 'text/csv': ['.csv'] },
    noClick: true,
  });

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={styles.container} {...getRootProps()}>
      <input {...getInputProps()} ref={fileInputRef} />

      <div className={styles.navigatorList}>
        <button
          className={`${styles.navBox} ${currentFileIndex === 0 ? styles.active : ''}`}
          onClick={() => setCurrentFileIndex(0)}
        >
          <Layers size={18} />
          <span>{translation.aggregatedView}</span>
        </button>

        {files.map((file, index) => (
          <div
            key={file.id}
            className={`${styles.navBoxWrapper} ${currentFileIndex === index + 1 ? styles.active : ''}`}
          >
            <button className={styles.navBox} onClick={() => setCurrentFileIndex(index + 1)}>
              <FileText size={18} />
              <span className={styles.fileName}>{file.name}</span>
            </button>
            <button
              className={styles.removeBtn}
              onClick={(e) => {
                e.stopPropagation();
                removeFile(file.id);
              }}
              aria-label="Remove file"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        <button className={`${styles.navBox} ${styles.addBox}`} onClick={openFileDialog}>
          <Plus size={20} />
        </button>
      </div>

      {isDragActive && (
        <div className={styles.dragOverlay}>
          <p>{translation.dropActive}</p>
        </div>
      )}
    </div>
  );
};

export default FileNavigator;
