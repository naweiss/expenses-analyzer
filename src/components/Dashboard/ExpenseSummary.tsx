import React from 'react';
import { ArrowUpRight, Activity, HandCoins } from 'lucide-react';
import { differenceInDays, differenceInWeeks, differenceInMonths } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboardUI } from '../../context/UIContext';
import { useTranslate } from '../../hooks/useTranslate';
import {
  FORMAT_CURRENCY,
  PRIMARY_COLOR,
  SUCCESS_COLOR,
  WARNING_COLOR,
} from '../../utils/constants';
import { Transaction } from '../../types/domain';
import StatusCard from '../UI/StatusCard/StatusCard';
import styles from './Dashboard.module.css';

interface ExpenseSummaryProps {
  transactions: Transaction[];
  startDate: Date;
  endDate: Date;
}

const ExpenseSummary: React.FC<ExpenseSummaryProps> = ({ transactions, startDate, endDate }) => {
  const { currentLanguage } = useLanguage();
  const { translation } = useTranslate();
  const { timeframeViewType } = useDashboardUI();

  const totalExpensesAmount = transactions.reduce(
    (accumulator, transaction) => accumulator + transaction.debitAmount,
    0,
  );

  const calculatePeriodicAverage = () => {
    if (transactions.length === 0) return 0;

    switch (timeframeViewType) {
      case 'week': {
        const days = Math.max(1, differenceInDays(endDate, startDate) + 1);
        return totalExpensesAmount / days;
      }
      case 'month': {
        const weeks = Math.max(1, differenceInWeeks(endDate, startDate) + 1);
        return totalExpensesAmount / weeks;
      }
      case 'year': {
        const months = Math.max(1, differenceInMonths(endDate, startDate) + 1);
        return totalExpensesAmount / months;
      }
      default:
        return 0;
    }
  };

  const periodicAverage = calculatePeriodicAverage();
  const timeframeLabel = translation.avgPeriodic[timeframeViewType];

  const summaryCards = [
    {
      title: translation.totalExpenses,
      value: FORMAT_CURRENCY(totalExpensesAmount, currentLanguage),
      icon: <HandCoins size={20} />,
      color: PRIMARY_COLOR,
    },
    {
      title: timeframeLabel,
      value: FORMAT_CURRENCY(periodicAverage, currentLanguage),
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
