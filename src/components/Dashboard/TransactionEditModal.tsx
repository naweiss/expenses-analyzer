import React from 'react';
import { Modal } from '../UI/Modal';
import { Transaction } from '../../utils/csvParser';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { UI_COLORS } from '../../utils/constants';
import styles from './TransactionEditModal.module.css';

export interface EditState {
  transaction: Transaction;
  field: 'category' | 'notes';
  value: string;
  applyToAll: boolean;
  showCustomInput?: boolean;
}

interface TransactionEditModalProps {
  editState: EditState | null;
  setEditState: (state: EditState | null) => void;
  industries: string[];
}

export const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  editState,
  setEditState,
  industries,
}) => {
  const { translation } = useLanguage();
  const { updateTransaction, industryColorMap } = useExpenseData();

  if (!editState) return null;

  const translateValue = (value: string) => {
    if (value === 'unknown') return translation.unknown;
    if (value === 'other') return translation.other;
    return value;
  };

  const getTagStyle = (industry: string, isSelected?: boolean) => {
    const color = industryColorMap[industry] || UI_COLORS.border;
    if (isSelected) {
      return {
        backgroundColor: color,
        color: '#ffffff',
        borderColor: color,
        boxShadow: `0 0 0 2px var(--color-primary-soft)`,
      };
    }
    return {
      backgroundColor: `${color}20`,
      color: color,
      borderColor: `${color}40`,
    };
  };

  const handleSaveEdit = () => {
    const updates: Partial<Transaction> =
      editState.field === 'category'
        ? { industry: editState.value }
        : { userNotes: editState.value };

    updateTransaction(editState.transaction.id, updates, editState.applyToAll);
    setEditState(null);
  };

  return (
    <Modal
      isOpen={!!editState}
      onClose={() => setEditState(null)}
      title={editState.field === 'category' ? translation.editCategory : translation.editNotes}
    >
      {editState.field === 'category' ? (
        <>
          <div className={styles.categoryList}>
            {industries.map((industry) => {
              const isSelected = editState.value === industry && !editState.showCustomInput;
              return (
                <span
                  key={industry}
                  className={`${styles.categoryOption} ${isSelected ? styles.selected : ''}`}
                  style={getTagStyle(industry, isSelected)}
                  onClick={() =>
                    setEditState({ ...editState, value: industry, showCustomInput: false })
                  }
                >
                  {translateValue(industry)}
                </span>
              );
            })}
            <span
              className={`${styles.categoryOption} ${editState.showCustomInput ? styles.selected : ''}`}
              style={
                editState.showCustomInput
                  ? {
                      backgroundColor: 'var(--color-primary)',
                      color: 'white',
                      borderColor: 'var(--color-primary)',
                    }
                  : {}
              }
              onClick={() => setEditState({ ...editState, showCustomInput: true })}
            >
              {translation.customCategory}
            </span>
          </div>
          {editState.showCustomInput && (
            <input
              type="text"
              className={styles.editInput}
              value={editState.value === editState.transaction.industry ? '' : editState.value}
              onChange={(e) => setEditState({ ...editState, value: e.target.value })}
              placeholder={translation.newCategory}
              autoFocus
            />
          )}
        </>
      ) : (
        <textarea
          className={styles.editInput}
          value={editState.value}
          onChange={(e) => setEditState({ ...editState, value: e.target.value })}
          rows={3}
          placeholder={translation.notes}
          autoFocus
        />
      )}

      <div className={styles.checkboxGroup}>
        <label className={styles.checkboxContainer}>
          <div className={styles.checkboxLabelRow}>
            <input
              type="checkbox"
              checked={editState.applyToAll}
              onChange={(e) => setEditState({ ...editState, applyToAll: e.target.checked })}
            />
            <span>{translation.applyToAll}</span>
          </div>
          {editState.applyToAll && (
            <div className={styles.applyHint}>
              {translation.applyToAllHint} <strong>{editState.transaction.businessName}</strong>
            </div>
          )}
        </label>
      </div>

      <div className={styles.editActions}>
        <button className={`${styles.btn} ${styles.cancelBtn}`} onClick={() => setEditState(null)}>
          {translation.cancel}
        </button>
        <button className={`${styles.btn} ${styles.saveBtn}`} onClick={handleSaveEdit}>
          {translation.save}
        </button>
      </div>
    </Modal>
  );
};
