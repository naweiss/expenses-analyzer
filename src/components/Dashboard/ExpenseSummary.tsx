import React from 'react';
import { ArrowUpRight, Activity, HandCoins } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import {
  FORMAT_CURRENCY,
  PRIMARY_COLOR,
  SUCCESS_COLOR,
  WARNING_COLOR,
} from '../../utils/constants';
import { Transaction } from '../../utils/csvParser';
import StatusCard from '../UI/StatusCard/StatusCard';
import styles from './Dashboard.module.css';

interface ExpenseSummaryProps {
  transactions: Transaction[];
}

const ExpenseSummary: React.FC<ExpenseSummaryProps> = ({ transactions }) => {
  const { translation, currentLanguage } = useLanguage();

  const totalExpensesAmount = transactions.reduce(
    (accumulator, transaction) => accumulator + transaction.debitAmount,
    0,
  );
  const averageTransactionAmount =
    transactions.length > 0 ? totalExpensesAmount / transactions.length : 0;

  const summaryCards = [
    {
      title: translation.totalExpenses,
      value: FORMAT_CURRENCY(totalExpensesAmount, currentLanguage),
      icon: <HandCoins size={20} />,
      color: PRIMARY_COLOR,
    },
    {
      title: translation.avgTransaction,
      value: FORMAT_CURRENCY(averageTransactionAmount, currentLanguage),
      icon: <Activity size={20} />,
      color: SUCCESS_COLOR,
    },
    {
      title: translation.transactions,
      value: transactions.length.toString(),
      icon: <ArrowUpRight size={20} />,
      color: WARNING_COLOR,
    },
  ];

  return (
    <div className={styles.summaryGrid}>
      {summaryCards.map((cardData, index) => (
        <StatusCard
          key={index}
          title={cardData.title}
          value={cardData.value}
          icon={cardData.icon}
          iconColor={cardData.color}
        />
      ))}
    </div>
  );
};

export default ExpenseSummary;
