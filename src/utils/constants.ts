import { Language } from '../types/domain';

/**
 * UI Theme & Branding
 */
export const PRIMARY_COLOR = '#6366f1';
export const SUCCESS_COLOR = '#10b981';
export const WARNING_COLOR = '#f59e0b';
export const DANGER_COLOR = '#ef4444';

export const UI_COLORS = {
  text: '#64748b',
  background: '#f8fafc',
  border: '#e2e8f0',
  grid: '#f1f5f9',
  activeBorder: '#6366f1',
  dangerSoft: '#fef2f2',
};

/**
 * Charting Configuration
 */
export const CHART_COLORS = [
  '#6366f1', // Indigo 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#f43f5e', // Rose 500
  '#8b5cf6', // Violet 500
  '#06b6d4', // Cyan 500
  '#f97316', // Orange 500
  '#14b8a6', // Teal 500
  '#ec4899', // Pink 500
  '#3b82f6', // Blue 500
  '#2dd4bf', // Teal 400
  '#fbbf24', // Amber 400
  '#a78bfa', // Violet 400
  '#fb7185', // Rose 400
  '#4ade80', // Emerald 400
  '#60a5fa', // Blue 400
  '#34d399', // Emerald 400 alt
  '#fb923c', // Orange 400
  '#818cf8', // Indigo 400
  '#22d3ee', // Cyan 400
];

export const DIMMED_OPACITY = 0.3;

export const TREND_DATE_FORMATS = {
  year: 'MMM',
  month: 'dd MMM',
  week: 'dd MMM',
} as const;

export const CHART_CONFIG = {
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    color: '#1e293b',
    padding: '12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  },
  margins: { top: 20, right: 30, left: 20, bottom: 20 },
};

/**
 * Formatting Utilities
 */
export const FORMAT_CURRENCY = (value: number, language: Language = 'en'): string => {
  const formattedValue = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = language === 'he' ? '₪' : '$';
  const isNegative = value < 0;

  if (language === 'he') {
    /**
     * In Hebrew (RTL), we want the minus sign to appear to the left of the currency symbol.
     * Example: -₪100.00
     */
    return isNegative
      ? `\u200E-\u200F${symbol}${formattedValue}`
      : `\u200F${symbol}${formattedValue}`;
  }

  return isNegative ? `-${symbol}${formattedValue}` : `${symbol}${formattedValue}`;
};
