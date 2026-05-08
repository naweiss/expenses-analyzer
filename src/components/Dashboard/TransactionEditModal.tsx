import React from 'react';
import { Transaction } from '../../types/domain';
import { useTranslate } from '../../hooks/useTranslate';
import styles from './TransactionEditModal.module.css';

export interface EditState {
  transaction: Transaction;
  field: 'category' | 'notes';
  value: string;
  applyToAll: boolean;
  showCustomInput?: boolean;
}

interface TransactionEditModalProps {
  editState: EditState;
  setEditState: (state: EditState | null) => void;
  industries: string[];
  onSave: () => void;
  getTagStyle: (industry: string) => React.CSSProperties;
}

const TransactionEditModal: React.FC<TransactionEditModalProps> = ({
  editState,
  setEditState,
  industries,
  onSave,
  getTagStyle,
}) => {
  const { translateIndustry, translation } = useTranslate();

  return (
    <div className={styles.editOverlay} onClick={() => setEditState(null)}>
      <div className={styles.editCard} onClick={(e) => e.stopPropagation()}>
        <h4>{editState.field === 'category' ? translation.editCategory : translation.editNotes}</h4>

        {editState.field === 'category' ? (
          <>
            <div className={styles.categoryList}>
              {industries.map((industry) => (
                <span
                  key={industry}
                  className={`${styles.categoryOption} ${editState.value === industry && !editState.showCustomInput ? styles.selected : ''}`}
                  style={getTagStyle(industry)}
                  onClick={() =>
                    setEditState({ ...editState, value: industry, showCustomInput: false })
                  }
                >
                  {translateIndustry(industry)}
                </span>
              ))}
              <span
                className={`${styles.categoryOption} ${editState.showCustomInput ? styles.selected : ''}`}
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
            <input
              type="checkbox"
              checked={editState.applyToAll}
              onChange={(e) => setEditState({ ...editState, applyToAll: e.target.checked })}
            />
            <span>{translation.applyToAll}</span>
          </label>
          {editState.applyToAll && (
            <div className={styles.applyHint}>
              {translation.applyToAllHint} <strong>{editState.transaction.businessName}</strong>
            </div>
          )}
        </div>

        <div className={styles.editActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.cancelBtn}`}
            onClick={() => setEditState(null)}
          >
            {translation.cancel}
          </button>
          <button type="button" className={`${styles.btn} ${styles.saveBtn}`} onClick={onSave}>
            {translation.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransactionEditModal;
