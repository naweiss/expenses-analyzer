import { Language } from './translations';

export const CHART_COLORS = [
  '#6366f1', // Indigo 500
  '#10b981', // Emerald 500
  '#f59e0b', // Amber 500
  '#f43f5e', // Rose 500
  '#8b5cf6', // Violet 500
  '#06b6d4', // Cyan 500
  '#ec4899', // Pink 500
  '#3b82f6', // Blue 500
  '#84cc16', // Lime 500
  '#ef4444', // Red 500
  '#0891b2', // Cyan 600
  '#4f46e5', // Indigo 600
  '#c026d3', // Fuchsia 600
  '#ea580c', // Orange 600
  '#16a34a', // Green 600
  '#2563eb', // Blue 600
  '#9333ea', // Purple 600
  '#db2777', // Pink 600
];

// Semantic color constants (Compile-time)
export const PRIMARY_COLOR = '#6366f1';
export const DEBIT_COLOR = '#f43f5e';
export const SUCCESS_COLOR = '#10b981';
export const WARNING_COLOR = '#f59e0b';

export const UI_COLORS = {
  text: '#64748b',
  background: '#f8fafc',
  border: '#cbd5e1',
  activeBorder: '#1e293b',
  grid: '#f1f5f9',
};

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
    // Using RLM (\u200F) and LRM (\u200E) to ensure correct symbol and sign placement in RTL
    return `\u200F${sign}${symbol}${formattedValue}`;
  }

  return `${sign}${symbol}${formattedValue}`;
};
