import React, { useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { FileText, Plus, X, Layers, Download, FileWarning } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { useFileParsing } from '../../hooks/useFileParsing';
import { exportToCSV } from '../../utils/csvExporter';
import styles from './FileNavigator.module.css';

const FileNavigator: React.FC = () => {
  const { translation } = useLanguage();
  const { files, removeFile, categoryRules, notesRules } = useExpenseData();
  const { currentFileIndex, setCurrentFileIndex } = useDashboardUI();
  const { handleFilesDrop, processingFiles, removeProcessingFile } = useFileParsing();
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesDrop,
    accept: {
      'text/csv': ['.csv'],
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
              data-tooltip={file.error ?? undefined}
              data-tooltip-visible={activeTooltipId === file.id ? 'true' : undefined}
              tabIndex={file.error ? 0 : undefined}
              role={file.error ? 'button' : undefined}
              onClick={() => {
                if (file.error) {
                  setActiveTooltipId((prev) => (prev === file.id ? null : file.id));
                }
              }}
              onBlur={() => setActiveTooltipId(null)}
              onKeyDown={(e) => {
                if (file.error && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  setActiveTooltipId((prev) => (prev === file.id ? null : file.id));
                }
              }}
            >
              <div className={styles.navBox}>
                {file.error ? <FileWarning size={18} /> : <FileText size={18} />}
                <span className={styles.fileName}>{file.name}</span>
                {!file.error && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar} style={{ width: `${file.progress}%` }} />
                  </div>
                )}
              </div>
              <button
                className={styles.removeBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  removeProcessingFile(file.id);
                }}
                aria-label={translation.removeFailedFile}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>

        <button
          className={`${styles.navBox} ${styles.addBox} ${styles.staticBtn}`}
          onClick={openFileDialog}
        >
          <Plus size={20} />
        </button>

        {files.length > 0 && (
          <button
            className={`${styles.navBox} ${styles.exportBox} ${styles.staticBtn}`}
            onClick={() => exportToCSV(files, categoryRules, notesRules)}
            data-tooltip={translation.exportCSV}
            aria-label={translation.exportCSV}
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
