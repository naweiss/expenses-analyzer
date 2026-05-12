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
import { Transaction } from './csvParser';
import { Language } from './translations';
import { getDateLocale } from './dateUtils';
import { TREND_DATE_FORMATS } from './constants';

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

export const getTrendData = (
  transactions: Transaction[],
  startDate: Date,
  endDate: Date,
  timeframeType: TimeframeType = 'month',
  language: Language = 'en',
): TimeTrendPoint[] => {
  const dateLocale = getDateLocale(language);
  const allIndustries = Array.from(new Set(transactions.map((t) => t.industry)));
  const intervals = getIntervals(startDate, endDate, timeframeType, dateLocale);
  const labelFormatString = TREND_DATE_FORMATS[timeframeType];

  const startLimit = startDate.getTime();
  const endLimit = endDate.getTime();

  // Pre-calculate interval boundaries and labels
  const intervalBounds = intervals.map((currentInterval) => {
    let intervalStart: number;
    let intervalEnd: number;
    let dateLabel: string;

    if (timeframeType === 'year') {
      intervalStart = startOfMonth(currentInterval).getTime();
      intervalEnd = endOfMonth(currentInterval).getTime();
      dateLabel = format(currentInterval, labelFormatString, { locale: dateLocale });
    } else if (timeframeType === 'month') {
      const weekStart = startOfWeek(currentInterval, { locale: dateLocale }).getTime();
      const weekEnd = endOfWeek(currentInterval, { locale: dateLocale }).getTime();
      intervalStart = Math.max(weekStart, startLimit);
      intervalEnd = Math.min(weekEnd, endLimit);
      dateLabel = format(new Date(intervalStart), labelFormatString, { locale: dateLocale });
    } else {
      intervalStart = currentInterval.getTime();
      // For day view, we want the whole day
      intervalEnd = endOfDay(currentInterval).getTime();
      dateLabel = format(currentInterval, labelFormatString, { locale: dateLocale });
    }

    return { intervalStart, intervalEnd, dateLabel };
  });

  // Efficiently group transactions into intervals
  return intervalBounds.map(({ intervalStart, intervalEnd, dateLabel }) => {
    const intervalTransactions = transactions.filter((t) => {
      const time = t.date.getTime();
      return time >= intervalStart && time <= intervalEnd;
    });

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
