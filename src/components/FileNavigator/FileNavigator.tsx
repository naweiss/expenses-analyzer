import React, { useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Plus, X, Layers, Download, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { useFileParser } from '../../hooks/useFileParser';
import { exportTransactionsToCSV } from '../../utils/csvExporter';
import styles from './FileNavigator.module.css';

const FileNavigator: React.FC = () => {
  const { translation } = useLanguage();
  const { files, addFiles, removeFile, allTransactions } = useExpenseData();
  const { currentFileIndex, setCurrentFileIndex } = useDashboardUI();

  const { parseFiles, processingFiles, removeProcessingFile } = useFileParser(addFiles);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[]) => {
      void parseFiles(acceptedFiles);
    },
    [parseFiles],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
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

      <div className={styles.navigatorWrapper}>
        <button
          className={`${styles.navBox} ${styles.staticBtn} ${currentFileIndex === 0 ? styles.active : ''}`}
          onClick={() => setCurrentFileIndex(0)}
        >
          <Layers size={18} />
          <span className={styles.btnText}>{translation.aggregatedView}</span>
        </button>

        <div className={styles.scrollArea}>
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

          {processingFiles.map((file) => (
            <div
              key={file.id}
              className={`${styles.navBoxWrapper} ${file.error ? styles.error : styles.processing}`}
            >
              <div className={styles.navBox}>
                {file.error ? <AlertCircle size={18} /> : <FileText size={18} />}
                <span className={styles.fileName}>{file.name}</span>
                {!file.error && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar} style={{ width: `${file.progress}%` }} />
                  </div>
                )}
                {file.error && <span className={styles.errorText}>{file.error}</span>}
              </div>
              <button
                className={styles.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeProcessingFile(file.id);
                }}
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          className={`${styles.navBox} ${styles.addBox} ${styles.staticBtn}`}
          onClick={openFileDialog}
          aria-label="Add file"
        >
          <Plus size={20} />
        </button>

        {allTransactions.length > 0 && (
          <button
            className={`${styles.navBox} ${styles.exportBox} ${styles.staticBtn}`}
            onClick={() => exportTransactionsToCSV(allTransactions)}
            title={translation.exportCSV}
          >
            <Download size={18} />
            <span className={styles.btnText}>{translation.exportCSV}</span>
          </button>
        )}
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
