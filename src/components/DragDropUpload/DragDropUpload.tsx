import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useFileParsing } from '../../hooks/useFileParsing';
import styles from './DragDropUpload.module.css';

const DragDropUpload: React.FC = () => {
  const { translation } = useLanguage();
  const { files: uploadedFiles, removeFile } = useExpenseData();
  const { handleFilesDrop, processingFiles } = useFileParsing();

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
            {/* Processing Files */}
            {processingFiles.map((file) => (
              <div key={file.id} className={`${styles.fileCard} ${styles.processing}`}>
                <Loader2 size={20} className={styles.spinner} />
                <div className={styles.fileInfo}>
                  <span title={file.name}>{file.name}</span>
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar} style={{ width: `${file.progress}%` }} />
                  </div>
                </div>
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
