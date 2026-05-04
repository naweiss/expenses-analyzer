import React, { useState, useMemo, useCallback } from 'react';
import { addWeeks, addMonths, addYears, startOfToday } from 'date-fns';
import { TimeframeType } from '../utils/dataAggregator';
import { useExpenseData } from './DataContext';
import { DashboardUIContext } from './UIContext';

export const DashboardUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { latestTransactionDate, files } = useExpenseData();
  const [internalFileIndex, setInternalFileIndex] = useState(0);
  const [timeframeViewType, setTimeframeViewType] = useState<TimeframeType>('month');
  const [internalReferenceDate, setInternalReferenceDate] = useState<Date | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);

  const currentFileIndex = Math.min(internalFileIndex, files.length);
  const referenceDate = internalReferenceDate ?? latestTransactionDate ?? startOfToday();

  const navigateTimeframe = useCallback(
    (direction: number) => {
      setInternalReferenceDate((prev) => {
        const current = prev ?? latestTransactionDate ?? startOfToday();
        if (timeframeViewType === 'week') return addWeeks(current, direction);
        if (timeframeViewType === 'month') return addMonths(current, direction);
        return addYears(current, direction);
      });
    },
    [timeframeViewType, latestTransactionDate],
  );

  const resetView = useCallback(() => {
    setInternalReferenceDate(null);
    setTimeframeViewType('month');
    setSelectedIndustry(null);
    setInternalFileIndex(0);
  }, []);

  const value = useMemo(
    () => ({
      currentFileIndex,
      setCurrentFileIndex: setInternalFileIndex,
      timeframeViewType,
      setTimeframeViewType,
      referenceDate,
      navigateTimeframe,
      resetView,
      selectedIndustry,
      setSelectedIndustry,
    }),
    [
      currentFileIndex,
      timeframeViewType,
      referenceDate,
      navigateTimeframe,
      resetView,
      selectedIndustry,
    ],
  );

  return <DashboardUIContext.Provider value={value}>{children}</DashboardUIContext.Provider>;
};
