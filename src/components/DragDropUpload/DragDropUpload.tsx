import React, { useCallback } from 'react';
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { Upload, FileText, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { parseCSV, CSVFile } from '../../utils/csvParser';
import styles from './DragDropUpload.module.css';

const DragDropUpload: React.FC = () => {
  const { translation } = useLanguage();
  const { addFiles, files: uploadedFiles, removeFile } = useExpenseData();

  const handleFilesDrop = useCallback(
    (acceptedFiles: File[], _fileRejections: FileRejection[], _event: DropEvent) => {
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

      {uploadedFiles.length > 0 && (
        <div className={styles.fileList}>
          <h3>
            {translation.uploadedFiles} ({uploadedFiles.length})
          </h3>
          <div className={styles.filesGrid}>
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
