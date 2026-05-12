import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Info, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { Transaction } from '../../utils/csvParser';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { getDateLocale } from '../../utils/dateUtils';
import { FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import styles from './TransactionTable.module.css';

interface TransactionTableProps {
  transactions: Transaction[];
}

type SortConfig = {
  key: 'date' | 'debitAmount' | 'businessName' | 'industry';
  direction: 'asc' | 'desc';
} | null;

interface EditState {
  transaction: Transaction;
  field: 'category' | 'notes';
  value: string;
  applyToAll: boolean;
  showCustomInput?: boolean;
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const { translation, currentLanguage } = useLanguage();
  const { industryColorMap, updateTransaction } = useExpenseData();

  const dateLocale = getDateLocale(currentLanguage);

  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'desc' });
  const [editState, setEditState] = useState<EditState | null>(null);
  const [hoveredTooltip, setHoveredTooltip] = useState<{
    content: React.ReactNode;
    rect: DOMRect;
  } | null>(null);

  // Close tooltip on scroll to prevent it from floating away from the icon
  useEffect(() => {
    const handleScroll = () => setHoveredTooltip(null);
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const industries = useMemo(() => Object.keys(industryColorMap), [industryColorMap]);

  const sortedTransactions = useMemo(() => {
    const items = [...transactions];
    if (sortConfig !== null) {
      items.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return items;
  }, [transactions, sortConfig]);

  if (transactions.length === 0) {
    return null;
  }

  const handleSort = (key: 'date' | 'debitAmount' | 'businessName' | 'industry') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig?.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: 'date' | 'debitAmount' | 'businessName' | 'industry') => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown size={14} className={styles.sortIcon} />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={14} className={styles.sortIconActive} />
    ) : (
      <ArrowDown size={14} className={styles.sortIconActive} />
    );
  };

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
    if (!editState) return;

    const updates: Partial<Transaction> =
      editState.field === 'category'
        ? { industry: editState.value }
        : { userNotes: editState.value };

    updateTransaction(editState.transaction.id, updates, editState.applyToAll);
    setEditState(null);
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th onClick={() => handleSort('date')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.date}
                {getSortIcon('date')}
              </div>
            </th>
            <th onClick={() => handleSort('businessName')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.description}
                {getSortIcon('businessName')}
              </div>
            </th>
            <th onClick={() => handleSort('industry')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.category}
                {getSortIcon('industry')}
              </div>
            </th>
            <th
              onClick={() => handleSort('debitAmount')}
              className={`${styles.amountCol} ${styles.sortableHeader}`}
            >
              <div className={`${styles.headerContent} ${styles.justifyEnd}`}>
                {translation.amount}
                {getSortIcon('debitAmount')}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedTransactions.map((transaction) => (
            <tr key={transaction.id}>
              <td className={styles.dateCell}>
                {format(transaction.date, 'dd/MM/yyyy', { locale: dateLocale })}
              </td>
              <td className={styles.descCell}>
                <div className={styles.descContent}>
                  <span>{translateValue(transaction.businessName)}</span>
                  {(transaction.details || transaction.userNotes) && (
                    <div
                      className={styles.tooltipWrapper}
                      onClick={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (hoveredTooltip?.rect.top === rect.top) {
                          setHoveredTooltip(null);
                        } else {
                          setHoveredTooltip({
                            rect,
                            content: (
                              <>
                                {transaction.userNotes && (
                                  <div className={styles.userNote}>
                                    <strong>{translation.notes}:</strong> {transaction.userNotes}
                                  </div>
                                )}
                                {transaction.details && <div>{transaction.details}</div>}
                              </>
                            ),
                          });
                        }
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredTooltip({
                          rect,
                          content: (
                            <>
                              {transaction.userNotes && (
                                <div className={styles.userNote}>
                                  <strong>{translation.notes}:</strong> {transaction.userNotes}
                                </div>
                              )}
                              {transaction.details && <div>{transaction.details}</div>}
                            </>
                          ),
                        });
                      }}
                      onMouseLeave={() => setHoveredTooltip(null)}
                    >
                      <Info size={14} className={styles.infoIcon} />
                    </div>
                  )}
                  <Pencil
                    size={18}
                    className={styles.editIcon}
                    onClick={() =>
                      setEditState({
                        transaction,
                        field: 'notes',
                        value: transaction.userNotes ?? '',
                        applyToAll: false,
                      })
                    }
                    aria-label={translation.editNotes}
                  />
                </div>
              </td>
              <td className={styles.categoryCell}>
                <span
                  className={styles.categoryTag}
                  style={getTagStyle(transaction.industry)}
                  onClick={() =>
                    setEditState({
                      transaction,
                      field: 'category',
                      value: transaction.industry,
                      applyToAll: false,
                    })
                  }
                >
                  {translateValue(transaction.industry)}
                </span>
              </td>
              <td className={styles.amountCell}>
                {FORMAT_CURRENCY(transaction.debitAmount, currentLanguage)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {hoveredTooltip &&
        createPortal(
          <div
            className={styles.portalTooltip}
            style={{
              top:
                hoveredTooltip.rect.top < 150
                  ? hoveredTooltip.rect.bottom + 10
                  : hoveredTooltip.rect.top - 10,
              left: hoveredTooltip.rect.left + hoveredTooltip.rect.width / 2,
              transform:
                hoveredTooltip.rect.top < 150
                  ? 'translateX(-50%)'
                  : 'translateX(-50%) translateY(-100%)',
            }}
          >
            <div
              className={`${styles.tooltipContent} ${styles.portalVisible} ${hoveredTooltip.rect.top < 150 ? styles.showBelow : ''}`}
            >
              {hoveredTooltip.content}
            </div>
          </div>,
          document.body,
        )}

      {editState && (
        <div className={styles.editOverlay} onClick={() => setEditState(null)}>
          <div className={styles.editCard} onClick={(e) => e.stopPropagation()}>
            <h4>
              {editState.field === 'category' ? translation.editCategory : translation.editNotes}
            </h4>

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
                    value={
                      editState.value === editState.transaction.industry ? '' : editState.value
                    }
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
                    {translation.applyToAllHint}{' '}
                    <strong>{editState.transaction.businessName}</strong>
                  </div>
                )}
              </label>
            </div>

            <div className={styles.editActions}>
              <button
                className={`${styles.btn} ${styles.cancelBtn}`}
                onClick={() => setEditState(null)}
              >
                {translation.cancel}
              </button>
              <button className={`${styles.btn} ${styles.saveBtn}`} onClick={handleSaveEdit}>
                {translation.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionTable;
