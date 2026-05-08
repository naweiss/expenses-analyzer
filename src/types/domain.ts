/**
 * Domain types for the Expenses Analyzer application.
 */

export interface Transaction {
  id: string;
  date: Date;
  businessName: string;
  industry: string;
  transactionAmount: number;
  debitAmount: number;
  details: string;
  userNotes?: string;
}

export interface CSVFile {
  id: string;
  name: string;
  transactions: Transaction[];
}

export enum SectionType {
  Domestic = 'domestic',
  Foreign = 'foreign',
  Unknown = 'unknown',
}

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

export type Language = 'en' | 'he';

export interface TranslationSchema {
  title: string;
  welcome: string;
  welcomeSub: string;
  reset: string;
  dragDrop: string;
  dropActive: string;
  formatHint: string;
  uploadedFiles: string;
  aggregatedView: string;
  week: string;
  month: string;
  year: string;
  industryBreakdown: string;
  spendingTrend: string;
  totalExpenses: string;
  avgPeriodic: {
    week: string;
    month: string;
    year: string;
  };
  transactions: string;
  unknown: string;
  other: string;
  date: string;
  description: string;
  category: string;
  amount: string;
  transactionDetails: string;
  notes: string;
  editCategory: string;
  editNotes: string;
  save: string;
  cancel: string;
  applyToAll: string;
  applyToAllHint: string;
  customCategory: string;
  newCategory: string;
  exportCSV: string;
}
