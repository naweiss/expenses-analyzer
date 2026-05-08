import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format } from 'date-fns';
import { Info, ArrowUpDown, ArrowUp, ArrowDown, Pencil } from 'lucide-react';
import { Transaction } from '../../types/domain';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useTranslate } from '../../hooks/useTranslate';
import { getDateLocale } from '../../utils/dateUtils';
import { FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import { useSort } from '../../hooks/useSort';
import TransactionEditModal, { EditState } from './TransactionEditModal';
import styles from './TransactionTable.module.css';

interface TransactionTableProps {
  transactions: Transaction[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const { currentLanguage } = useLanguage();
  const { translateIndustry, translation } = useTranslate();
  const { industryColorMap, updateTransaction } = useExpenseData();

  const dateLocale = getDateLocale(currentLanguage);

  const {
    sortedItems: sortedTransactions,
    sortConfig,
    requestSort,
  } = useSort<Transaction>(transactions, { key: 'date', direction: 'desc' });

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

  if (transactions.length === 0) return null;

  const getSortIcon = (key: keyof Transaction) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown size={14} className={styles.sortIcon} />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp size={14} className={styles.sortIconActive} />
    ) : (
      <ArrowDown size={14} className={styles.sortIconActive} />
    );
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
            <th onClick={() => requestSort('date')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.date}
                {getSortIcon('date')}
              </div>
            </th>
            <th onClick={() => requestSort('businessName')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.description}
                {getSortIcon('businessName')}
              </div>
            </th>
            <th onClick={() => requestSort('industry')} className={styles.sortableHeader}>
              <div className={styles.headerContent}>
                {translation.category}
                {getSortIcon('industry')}
              </div>
            </th>
            <th
              onClick={() => requestSort('debitAmount')}
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
                  <span>{translateIndustry(transaction.businessName)}</span>
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
                  <span title={translation.editNotes} className={styles.editIconWrapper}>
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
                  </span>
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
                  {translateIndustry(transaction.industry)}
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
        <TransactionEditModal
          editState={editState}
          setEditState={setEditState}
          industries={industries}
          onSave={handleSaveEdit}
          getTagStyle={getTagStyle}
        />
      )}
    </div>
  );
};

export default TransactionTable;
