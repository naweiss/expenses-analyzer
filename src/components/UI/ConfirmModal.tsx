import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Modal } from './Modal';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
}) => {
  const { translation } = useLanguage();

  return (
    <Modal isOpen={isOpen} onClose={onCancel}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={onCancel}>
          {translation.no}
        </button>
        <button className={`${styles.btn} ${styles.confirmBtn}`} onClick={onConfirm}>
          {translation.yes}
        </button>
      </div>
    </Modal>
  );
};
