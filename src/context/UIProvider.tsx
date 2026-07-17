import React, { useState, useMemo, useCallback } from 'react';
import { addWeeks, addMonths, addYears, startOfToday } from 'date-fns';
import { TimeframeType } from '../utils/dataAggregator';
import { useExpenseData } from './DataContext';
import { DashboardUIContext } from './UIContext';
import { ConfirmModal } from '../components/UI/ConfirmModal';

export const DashboardUIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { latestTransactionDate, files } = useExpenseData();
  const [internalFileIndex, setInternalFileIndex] = useState(0);
  const [timeframeViewType, setTimeframeViewType] = useState<TimeframeType>('month');
  const [internalReferenceDate, setInternalReferenceDate] = useState<Date | null>(null);
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>([]);
  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string | null>(null);

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    message: string;
    resolver: ((value: boolean) => void) | null;
  }>({
    isOpen: false,
    message: '',
    resolver: null,
  });

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

  const requestConfirmation = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        resolver: resolve,
      });
    });
  }, []);

  const handleConfirmAction = useCallback((value: boolean) => {
    setConfirmState((prev) => {
      if (prev.resolver) {
        prev.resolver(value);
      }
      return { ...prev, isOpen: false, message: '', resolver: null };
    });
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
      requestConfirmation,
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
      requestConfirmation,
    ],
  );

  return (
    <DashboardUIContext.Provider value={value}>
      {children}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        message={confirmState.message}
        onConfirm={() => handleConfirmAction(true)}
        onCancel={() => handleConfirmAction(false)}
      />
    </DashboardUIContext.Provider>
  );
};
