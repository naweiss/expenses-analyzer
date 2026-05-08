import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  eachDayOfInterval,
  eachMonthOfInterval,
  eachWeekOfInterval,
  endOfDay,
  Locale,
} from 'date-fns';
import {
  Transaction,
  IndustryTotal,
  TimeTrendPoint,
  TimeframeType,
  Language,
} from '../types/domain';
import { getDateLocale } from './dateUtils';
import { TREND_DATE_FORMATS } from './constants';

export const aggregateByIndustry = (transactions: Transaction[]): IndustryTotal[] => {
  const industryMap = new Map<string, number>();

  transactions.forEach((t) => {
    const current = industryMap.get(t.industry) ?? 0;
    industryMap.set(t.industry, current + t.debitAmount);
  });

  return Array.from(industryMap.entries())
    .map(([industry, totalAmount]) => ({ industry, totalAmount }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
};

export const getTimeframeBounds = (timeframeType: TimeframeType, referenceDate: Date) => {
  switch (timeframeType) {
    case 'week':
      return { start: startOfWeek(referenceDate), end: endOfWeek(referenceDate) };
    case 'month':
      return { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) };
    case 'year':
      return { start: startOfYear(referenceDate), end: endOfYear(referenceDate) };
  }
};

export const filterByTimeframe = (transactions: Transaction[], startDate: Date, endDate: Date) => {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return transactions.filter((transaction) => {
    const time = transaction.date.getTime();
    return time >= start && time <= end;
  });
};

const getIntervals = (
  startDate: Date,
  endDate: Date,
  timeframeType: TimeframeType,
  locale: Locale,
) => {
  if (timeframeType === 'year') return eachMonthOfInterval({ start: startDate, end: endDate });
  if (timeframeType === 'month')
    return eachWeekOfInterval({ start: startDate, end: endDate }, { locale });
  return eachDayOfInterval({ start: startDate, end: endDate });
};

interface IntervalBound {
  intervalStart: number;
  intervalEnd: number;
  dateLabel: string;
}

const calculateIntervalBounds = (
  startDate: Date,
  endDate: Date,
  timeframeType: TimeframeType,
  locale: Locale,
): IntervalBound[] => {
  const intervals = getIntervals(startDate, endDate, timeframeType, locale);
  const labelFormatString = TREND_DATE_FORMATS[timeframeType];
  const startLimit = startDate.getTime();
  const endLimit = endDate.getTime();

  return intervals.map((currentInterval) => {
    let intervalStart: number;
    let intervalEnd: number;
    let dateLabel: string;

    if (timeframeType === 'year') {
      intervalStart = startOfMonth(currentInterval).getTime();
      intervalEnd = endOfMonth(currentInterval).getTime();
      dateLabel = format(currentInterval, labelFormatString, { locale });
    } else if (timeframeType === 'month') {
      const weekStart = startOfWeek(currentInterval, { locale }).getTime();
      const weekEnd = endOfWeek(currentInterval, { locale }).getTime();
      intervalStart = Math.max(weekStart, startLimit);
      intervalEnd = Math.min(weekEnd, endLimit);
      dateLabel = format(new Date(intervalStart), labelFormatString, { locale });
    } else {
      intervalStart = currentInterval.getTime();
      intervalEnd = endOfDay(currentInterval).getTime();
      dateLabel = format(currentInterval, labelFormatString, { locale });
    }

    return { intervalStart, intervalEnd, dateLabel };
  });
};

export const getTrendData = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  timeframeType: TimeframeType = 'month',
  language: Language = 'en',
): TimeTrendPoint[] => {
  const dateLocale = getDateLocale(language);
  const allIndustries = Array.from(new Set(transactions.map((t) => t.industry)));
  const intervalBounds = calculateIntervalBounds(startDate, endDate, timeframeType, dateLocale);

  const sortedTransactions = [...transactions].sort((a, b) => a.date.getTime() - b.date.getTime());
  let transactionIdx = 0;

  return intervalBounds.map(({ intervalStart, intervalEnd, dateLabel }) => {
    let totalAmount = 0;
    const categoryBreakdown: Record<string, number> = {};

    allIndustries.forEach((industry) => {
      categoryBreakdown[industry] = 0;
    });

    while (
      transactionIdx < sortedTransactions.length &&
      sortedTransactions[transactionIdx].date.getTime() < intervalStart
    ) {
      transactionIdx++;
    }

    let tempIdx = transactionIdx;
    while (
      tempIdx < sortedTransactions.length &&
      sortedTransactions[tempIdx].date.getTime() <= intervalEnd
    ) {
      const t = sortedTransactions[tempIdx];
      totalAmount += t.debitAmount;
      categoryBreakdown[t.industry] += t.debitAmount;
      tempIdx++;
    }

    transactionIdx = tempIdx;

    return {
      dateLabel,
      totalAmount,
      ...categoryBreakdown,
    };
  });
};
