import { Language } from './translations';

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

// Semantic color constants (Compile-time)
export const PRIMARY_COLOR = '#6366f1';
export const DEBIT_COLOR = '#f43f5e';
export const SUCCESS_COLOR = '#10b981';
export const WARNING_COLOR = '#f59e0b';

export const DIMMED_OPACITY = 0.3;

export const UI_COLORS = {
  text: '#64748b',
  background: '#f8fafc',
  border: '#cbd5e1',
  activeBorder: '#1e293b',
  grid: '#f1f5f9',
};

export const TREND_DATE_FORMATS = {
  year: 'MMM',
  month: 'dd MMM',
  week: 'dd MMM',
} as const;

export const CHART_CONFIG = {
  margins: { top: 10, bottom: 20, left: 10, right: 10 },
  animationDuration: 300,
  tooltip: {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    padding: '12px',
    color: '#1e293b',
    textAlign: 'inherit' as const,
  },
};

export const FORMAT_CURRENCY = (value: number, language: Language) => {
  const absValue = Math.abs(value);
  const symbol = language === 'he' ? '₪' : '$';
  const formattedValue = absValue.toLocaleString(language === 'he' ? 'he-IL' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sign = value < 0 ? '-' : '';

  if (language === 'he') {
    // Prepend LRM (\u200E) to ensure the minus sign stays on the left of the currency symbol in RTL
    return `\u200E${sign}${symbol}${formattedValue}`;
  }

  return `${sign}${symbol}${formattedValue}`;
};
