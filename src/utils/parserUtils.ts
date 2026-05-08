/**
 * Utility functions shared between CSV and PDF parsers.
 */

/**
 * Collapses multiple spaces into a single space and trims the string.
 * Ensures consistent comparison and grouping of text values.
 */
export const normalizeText = (text: string | undefined): string => {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').trim();
};

/**
 * Robustly parses a currency/amount string into a number.
 * Handles thousands separators (commas), various currency symbols, and
 * cases where multiple numbers might be present in a single string.
 */
export const sanitizeAmount = (value: string | undefined): number => {
  if (!value) return 0;

  // Remove commas used as thousand separators
  const cleanValue = value.replace(/,/g, '');

  // Match numbers with optional decimal point and optional leading minus.
  // We use a regex that handles both dot and comma (if used as decimal)
  // but since we already removed commas, we focus on dot.
  const matches = cleanValue.match(/-?\d+(\.\d+)?/g);

  if (matches && matches.length > 0) {
    /**
     * In many bank exports (especially PDF), a cell might contain
     * both the original and the converted amount.
     * By convention, the actual charge/debit amount is usually the last
     * numerical value mentioned in the cell's text.
     */
    const parsed = parseFloat(matches[matches.length - 1]);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

/**
 * Parses a date string into a Date object.
 * Prioritizes common local formats (DD/MM/YYYY) before falling back to ISO.
 */
export const parseDateString = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(NaN);

  const trimmed = dateString.trim();

  // Handle DD/MM/YYYY or DD/MM/YY
  if (trimmed.includes('/')) {
    const segments = trimmed.split('/');
    if (segments.length === 3) {
      const [day, month, yearPart] = segments;
      const year = yearPart.length === 2 ? `20${yearPart}` : yearPart;
      const d = parseInt(day, 10);
      const m = parseInt(month, 10) - 1; // 0-indexed
      const y = parseInt(year, 10);

      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // Fallback to native Date parser for ISO and other common formats
  const fallbackDate = new Date(trimmed);
  return fallbackDate;
};
