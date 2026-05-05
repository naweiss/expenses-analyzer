import { parse, isValid } from 'date-fns';

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

export const sanitizeAmount = (value: string | undefined): number => {
  if (!value) return 0;
  // Remove commas used as thousand separators
  const cleanValue = value.replace(/,/g, '');
  // Match numbers with optional decimal point and optional leading minus
  const matches = cleanValue.match(/-?\d+(\.\d+)?/g);
  if (matches && matches.length > 0) {
    // Return the last match found in the string
    const parsed = parseFloat(matches[matches.length - 1]);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

export const parseDateString = (dateString: string | undefined): Date => {
  if (!dateString) return new Date(NaN);

  const trimmed = dateString.trim();

  // Try common formats using date-fns parse
  // 1. DD/MM/YY
  let parsedDate = parse(trimmed, 'dd/MM/yy', new Date());
  if (isValid(parsedDate)) return parsedDate;

  // 2. DD/MM/YYYY
  parsedDate = parse(trimmed, 'dd/MM/yyyy', new Date());
  if (isValid(parsedDate)) return parsedDate;

  // Fallback to native Date parser for ISO and other common formats
  return new Date(trimmed);
};
