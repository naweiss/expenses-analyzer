import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, FileWarning } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useFileParsing } from '../../hooks/useFileParsing';
import styles from './DragDropUpload.module.css';

const DragDropUpload: React.FC = () => {
  const { translation } = useLanguage();
  const { files: uploadedFiles, removeFile } = useExpenseData();
  const { handleFilesDrop, processingFiles, removeProcessingFile } = useFileParsing();
  const [activeTooltipId, setActiveTooltipId] = useState<string | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFilesDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf'],
    },
  });

  return (
    <div className={styles.container}>
      <div
        {...getRootProps()}
        className={`${styles.dropZone} ${isDragActive ? styles.dragActive : ''}`}
      >
        <input {...getInputProps()} />
        <Upload size={40} className={styles.icon} />
        <p>{isDragActive ? translation.dropActive : translation.dragDrop}</p>
        <span>{translation.formatHint}</span>
      </div>

      {(uploadedFiles.length > 0 || processingFiles.length > 0) && (
        <div className={styles.fileList}>
          <h3>
            {translation.uploadedFiles} ({uploadedFiles.length + processingFiles.length})
          </h3>
          <div className={styles.filesGrid}>
            {/* Processing / Error Files */}
            {processingFiles.map((file) => (
              <div
                key={file.id}
                className={`${styles.fileCard} ${file.error ? styles.error : styles.processing}`}
                data-tooltip={file.error ?? undefined}
                data-tooltip-visible={activeTooltipId === file.id ? 'true' : undefined}
                onClick={() => {
                  if (file.error) {
                    setActiveTooltipId((prev) => (prev === file.id ? null : file.id));
                  }
                }}
                onBlur={() => setActiveTooltipId(null)}
                role={file.error ? 'button' : undefined}
                tabIndex={file.error ? 0 : undefined}
                onKeyDown={(e) => {
                  if (file.error && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setActiveTooltipId((prev) => (prev === file.id ? null : file.id));
                  }
                }}
              >
                {file.error ? (
                  <>
                    <FileWarning size={20} />
                    <span>{file.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeProcessingFile(file.id);
                      }}
                      className={styles.removeBtn}
                      aria-label={translation.removeFailedFile}
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <>
                    <FileText size={20} />
                    <div className={styles.fileInfo}>
                      <div className={styles.fileNameRow}>
                        <span>{file.name}</span>
                      </div>
                      <div className={styles.progressContainer}>
                        <div
                          className={styles.progressBar}
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Completed Files */}
            {uploadedFiles.map((fileObject) => (
              <div key={fileObject.id} className={styles.fileCard}>
                <FileText size={20} />
                <span title={fileObject.name}>{fileObject.name}</span>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    removeFile(fileObject.id);
                  }}
                  className={styles.removeBtn}
                  aria-label="Remove file"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DragDropUpload;
