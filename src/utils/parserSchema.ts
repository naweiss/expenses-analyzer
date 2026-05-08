/**
 * Parser schema and mapping utilities for CSV and PDF parsers.
 */

export const COLUMN_ALIASES = {
  DATE: ['Date', 'תאריך', 'DATE'],
  BUSINESS_NAME: [
    'Business Name',
    'BusinessName',
    'שם בית העסק',
    'שם בית עסק',
    'שם העסק',
    'שם',
    'עסק',
    'בית עסק',
  ],
  INDUSTRY: ['Category', 'Industry', 'ענף', 'CATEGORY', 'INDUSTRY'],
  ORIGINAL_AMOUNT: [
    'Transaction Amount',
    'Amount',
    'סכום עסקה',
    'סכום מקורי',
    'ORIGINAL_AMOUNT',
    'TRANSACTION_AMOUNT',
  ],
  CHARGE_AMOUNT: [
    'Debit Amount',
    'Debit',
    'סכום חיוב',
    'החיוב',
    'סכום החיוב',
    'בש"ח',
    'לתשלום',
    'CHARGE_AMOUNT',
    'DEBIT_AMOUNT',
  ],
  DETAILS: ['Details', 'פירוט', 'נוסף', 'DETAILS'],
  NOTES: ['Notes', 'הערות', 'NOTES'],
};

export type ColumnGoal = keyof typeof COLUMN_ALIASES;

/**
 * Finds the canonical column name for a given header string.
 */
export const mapHeaderToGoal = (header: string): ColumnGoal | null => {
  const normalizedHeader = header.trim();

  for (const [goal, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (
      aliases.some((alias) => normalizedHeader.includes(alias) || alias.includes(normalizedHeader))
    ) {
      return goal as ColumnGoal;
    }
  }

  return null;
};

/**
 * Robustly extracts values from a row object based on canonical goals.
 */
export const getRowValue = (row: Record<string, string>, goal: ColumnGoal): string => {
  const aliases = COLUMN_ALIASES[goal];
  const keys = Object.keys(row);

  // Try exact match first
  for (const alias of aliases) {
    if (row[alias] !== undefined) return row[alias];
  }

  // Try partial match
  for (const key of keys) {
    if (aliases.some((alias) => key.includes(alias) || alias.includes(key))) {
      return row[key];
    }
  }

  return '';
};
