import React, { useCallback } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useFileParser } from '../../hooks/useFileParser';
import styles from './DragDropUpload.module.css';

const DragDropUpload: React.FC = () => {
  const { translation } = useLanguage();
  const { addFiles, files: uploadedFiles, removeFile } = useExpenseData();

  const { parseFiles, processingFiles, removeProcessingFile } = useFileParser(addFiles);

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[], _fileRejections: FileRejection[], _event: DropEvent) => {
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
              >
                {file.error ? <AlertCircle size={20} /> : <FileText size={20} />}
                <div className={styles.fileInfo}>
                  <div className={styles.fileNameRow}>
                    <span title={file.name}>{file.name}</span>
                    {file.error && (
                      <button
                        onClick={() => removeProcessingFile(file.id)}
                        className={styles.removeBtn}
                        aria-label="Remove failed file"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {file.error ? (
                    <span className={styles.errorMessage}>{file.error}</span>
                  ) : (
                    <div className={styles.progressContainer}>
                      <div className={styles.progressBar} style={{ width: `${file.progress}%` }} />
                    </div>
                  )}
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
