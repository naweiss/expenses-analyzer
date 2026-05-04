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
  Locale,
} from 'date-fns';
import { he, enUS } from 'date-fns/locale';
import { Transaction } from './csvParser';
import { Language } from './translations';

export interface IndustryTotal {
  industry: string;
  totalAmount: number;
}

export interface TimeTrendPoint {
  dateLabel: string;
  totalAmount: number;
  [category: string]: number | string;
}

export type TimeframeType = 'week' | 'month' | 'year';

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

const getLabelFormat = (timeframeType: TimeframeType) => {
  if (timeframeType === 'year') return 'MMM';
  return 'dd MMM';
};

export const getTrendData = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  timeframeType: TimeframeType = 'month',
  language: Language = 'en',
): TimeTrendPoint[] => {
  const dateLocale = language === 'he' ? he : enUS;
  const allIndustries = Array.from(new Set(transactions.map((t) => t.industry)));
  const intervals = getIntervals(startDate, endDate, timeframeType, dateLocale);
  const labelFormatString = getLabelFormat(timeframeType);

  const startLimit = startDate.getTime();
  const endLimit = endDate.getTime();

  return intervals.map((currentInterval) => {
    let intervalTransactions: Transaction[];
    let dateLabel: string;

    if (timeframeType === 'year') {
      const intervalStart = startOfMonth(currentInterval).getTime();
      const intervalEnd = endOfMonth(currentInterval).getTime();
      intervalTransactions = transactions.filter((t) => {
        const time = t.date.getTime();
        return time >= intervalStart && time <= intervalEnd;
      });
      dateLabel = format(currentInterval, labelFormatString, { locale: dateLocale });
    } else if (timeframeType === 'month') {
      const weekStart = startOfWeek(currentInterval, { locale: dateLocale }).getTime();
      const weekEnd = endOfWeek(currentInterval, { locale: dateLocale }).getTime();
      const clippedStart = Math.max(weekStart, startLimit);
      const clippedEnd = Math.min(weekEnd, endLimit);

      intervalTransactions = transactions.filter((t) => {
        const time = t.date.getTime();
        return time >= clippedStart && time <= clippedEnd;
      });
      dateLabel = format(new Date(clippedStart), labelFormatString, { locale: dateLocale });
    } else {
      const dayLabel = format(currentInterval, 'yyyy-MM-dd');
      intervalTransactions = transactions.filter((t) => format(t.date, 'yyyy-MM-dd') === dayLabel);
      dateLabel = format(currentInterval, labelFormatString, { locale: dateLocale });
    }

    const totalAmount = intervalTransactions.reduce((sum, t) => sum + t.debitAmount, 0);
    const categoryBreakdown: Record<string, number> = {};

    allIndustries.forEach((industry) => {
      categoryBreakdown[industry] = 0;
    });

    intervalTransactions.forEach((t) => {
      categoryBreakdown[t.industry] += t.debitAmount;
    });

    return {
      dateLabel,
      totalAmount,
      ...categoryBreakdown,
    };
  });
};
