import React, { useState, useMemo, useCallback } from 'react';
import { addWeeks, addMonths, addYears, startOfToday } from 'date-fns';
import { TimeframeType } from '../types/domain';
import { useExpenseData } from './DataContext';
import { DashboardUIContext } from './UIContext';

export const DashboardUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { latestTransactionDate, files } = useExpenseData();
  const [internalFileIndex, setInternalFileIndex] = useState(0);
  const [timeframeViewType, setTimeframeViewType] = useState<TimeframeType>('month');
  const [internalReferenceDate, setInternalReferenceDate] = useState<Date | null>(null);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string | null>(null);

  const currentFileIndex = Math.min(internalFileIndex, files.length);
  const referenceDate = internalReferenceDate ?? latestTransactionDate ?? startOfToday();

  const navigateTimeframe = useCallback(
    (direction: number) => {
      setSelectedTrendPeriod(null);
      setInternalReferenceDate((prev) => {
        const current = prev ?? latestTransactionDate ?? startOfToday();
        if (timeframeViewType === 'week') return addWeeks(current, direction);
        if (timeframeViewType === 'month') return addMonths(current, direction);
        return addYears(current, direction);
      });
      setSelectedTrendPeriod(null);
    },
    [timeframeViewType, latestTransactionDate],
  );

  const setReferenceDate = useCallback((date: Date) => {
    setInternalReferenceDate(date);
    setSelectedTrendPeriod(null);
  }, []);

  const toggleIndustry = useCallback((industry: string) => {
    setSelectedIndustries((prev) =>
      prev.includes(industry) ? prev.filter((i) => i !== industry) : [...prev, industry],
    );
  }, []);

  const resetView = useCallback(() => {
    setInternalReferenceDate(null);
    setTimeframeViewType('month');
    setSelectedIndustries([]);
    setInternalFileIndex(0);
    setSelectedTrendPeriod(null);
  }, []);

  const value = useMemo(
    () => ({
      currentFileIndex,
      setCurrentFileIndex: (index: number) => {
        setInternalFileIndex(index);
        setSelectedTrendPeriod(null);
      },
      timeframeViewType,
      setTimeframeViewType: (type: TimeframeType) => {
        setTimeframeViewType(type);
        setSelectedTrendPeriod(null);
      },
      referenceDate,
      setReferenceDate,
      navigateTimeframe,
      resetView,
      selectedIndustries,
      setSelectedIndustries,
      toggleIndustry,
      selectedTrendPeriod,
      setSelectedTrendPeriod,
    }),
    [
      currentFileIndex,
      timeframeViewType,
      referenceDate,
      setReferenceDate,
      navigateTimeframe,
      resetView,
      selectedIndustries,
      toggleIndustry,
      selectedTrendPeriod,
    ],
  );

  return <DashboardUIContext.Provider value={value}>{children}</DashboardUIContext.Provider>;
};
