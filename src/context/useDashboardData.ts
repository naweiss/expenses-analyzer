import { useMemo } from 'react';
import { useExpenseData } from './DataContext';
import { useDashboardUI } from './UIContext';
import { useLanguage } from './LanguageContext';
import {
  getTimeframeBounds,
  filterByTimeframe,
  aggregateByIndustry,
  getTrendData,
} from '../utils/dataAggregator';

export const useDashboardData = () => {
  const { allTransactions, files } = useExpenseData();
  const { currentFileIndex, timeframeViewType, referenceDate, selectedIndustries } =
    useDashboardUI();
  const { currentLanguage } = useLanguage();

  const currentTransactions = useMemo(() => {
    if (currentFileIndex === 0) return allTransactions;
    return files[currentFileIndex - 1]?.transactions || [];
  }, [currentFileIndex, files, allTransactions]);

  const { start: timeframeStartDate, end: timeframeEndDate } = useMemo(
    () => getTimeframeBounds(timeframeViewType, referenceDate),
    [timeframeViewType, referenceDate],
  );

  const filteredTransactions = useMemo(
    () => filterByTimeframe(currentTransactions, timeframeStartDate, timeframeEndDate),
    [currentTransactions, timeframeStartDate, timeframeEndDate],
  );

  const industryBreakdownData = useMemo(
    () => aggregateByIndustry(filteredTransactions),
    [filteredTransactions],
  );

  const transactionsForTrendVisualization = useMemo(() => {
    if (selectedIndustries.length === 0) return filteredTransactions;
    return filteredTransactions.filter((t) => selectedIndustries.includes(t.industry));
  }, [filteredTransactions, selectedIndustries]);

  const timeTrendData = useMemo(
    () =>
      getTrendData(
        transactionsForTrendVisualization,
        timeframeStartDate,
        timeframeEndDate,
        timeframeViewType,
        currentLanguage,
      ),
    [
      transactionsForTrendVisualization,
      timeframeStartDate,
      timeframeEndDate,
      timeframeViewType,
      currentLanguage,
    ],
  );

  return {
    timeframeStartDate,
    timeframeEndDate,
    filteredTransactions,
    industryBreakdownData,
    timeTrendData,
    currentTransactions,
    allTransactions,
  };
};
