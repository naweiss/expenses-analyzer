import { useMemo } from 'react';
import { format } from 'date-fns';
import { he, enUS } from 'date-fns/locale';
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
  const {
    currentFileIndex,
    timeframeViewType,
    referenceDate,
    selectedIndustries,
    selectedTrendPeriod,
  } = useDashboardUI();
  const { currentLanguage } = useLanguage();
  const dateLocale = currentLanguage === 'he' ? he : enUS;

  const currentTransactions = useMemo(() => {
    if (currentFileIndex === 0) return allTransactions;
    return files[currentFileIndex - 1]?.transactions || [];
  }, [currentFileIndex, files, allTransactions]);

  const { start: timeframeStartDate, end: timeframeEndDate } = useMemo(
    () => getTimeframeBounds(timeframeViewType, referenceDate),
    [timeframeViewType, referenceDate],
  );

  const timeframeFilteredTransactions = useMemo(
    () => filterByTimeframe(currentTransactions, timeframeStartDate, timeframeEndDate),
    [currentTransactions, timeframeStartDate, timeframeEndDate],
  );

  const industryBreakdownData = useMemo(
    () => aggregateByIndustry(timeframeFilteredTransactions),
    [timeframeFilteredTransactions],
  );

  // Unified filtering for both Summary Cards and Detailed Table
  const filteredTransactions = useMemo(() => {
    let filtered = timeframeFilteredTransactions;
    if (selectedIndustries.length > 0) {
      filtered = filtered.filter((t) => selectedIndustries.includes(t.industry));
    }
    if (selectedTrendPeriod) {
      filtered = filtered.filter(
        (t) => format(t.date, 'dd MMM', { locale: dateLocale }) === selectedTrendPeriod,
      );
    }
    return filtered;
  }, [timeframeFilteredTransactions, selectedIndustries, selectedTrendPeriod, dateLocale]);

  const timeTrendData = useMemo(
    () =>
      getTrendData(
        selectedIndustries.length === 0
          ? timeframeFilteredTransactions
          : timeframeFilteredTransactions.filter((t) => selectedIndustries.includes(t.industry)),
        timeframeStartDate,
        timeframeEndDate,
        timeframeViewType,
        currentLanguage,
      ),
    [
      timeframeFilteredTransactions,
      selectedIndustries,
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
