import React from 'react';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { Info } from 'lucide-react';
import { Transaction } from '../../utils/csvParser';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import styles from './TransactionTable.module.css';

interface TransactionTableProps {
  transactions: Transaction[];
}

const TransactionTable: React.FC<TransactionTableProps> = ({ transactions }) => {
  const { currentLanguage, translation } = useLanguage();
  const { industryColorMap } = useExpenseData();
  const dateLocale = currentLanguage === 'he' ? he : enUS;

  if (transactions.length === 0) {
    return null;
  }

  const translateValue = (value: string) => {
    if (value === 'unknown') return translation.unknown;
    if (value === 'other') return translation.other;
    return value;
  };

  // Sort transactions by date descending
  const sortedTransactions = [...transactions].sort((a, b) => b.date.getTime() - a.date.getTime());

  const getTagStyle = (industry: string) => {
    const color = industryColorMap[industry] || UI_COLORS.border;

    return {
      backgroundColor: `${color}20`,
      color: color,
      borderColor: `${color}40`,
    };
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{translation.date}</th>
            <th>{translation.description}</th>
            <th>{translation.category}</th>
            <th className={styles.amountCol}>{translation.amount}</th>
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
                  {transaction.details && (
                    <div className={styles.tooltipWrapper}>
                      <Info size={14} className={styles.infoIcon} />
                      <div className={styles.tooltipContent}>{transaction.details}</div>
                    </div>
                  )}
                </div>
              </td>
              <td className={styles.categoryCell}>
                <span className={styles.categoryTag} style={getTagStyle(transaction.industry)}>
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
    </div>
  );
};

export default TransactionTable;
