import { createContext, useContext } from 'react';
import { TimeframeType } from '../utils/dataAggregator';

export interface DashboardUIContextType {
  currentFileIndex: number;
  setCurrentFileIndex: (index: number) => void;
  timeframeViewType: TimeframeType;
  setTimeframeViewType: (type: TimeframeType) => void;
  referenceDate: Date;
  setReferenceDate: (date: Date) => void;
  navigateTimeframe: (direction: number) => void;
  resetView: () => void;
  selectedIndustries: string[];
  setSelectedIndustries: (industries: string[]) => void;
  toggleIndustry: (industry: string) => void;
  selectedTrendPeriod: string | null;
  setSelectedTrendPeriod: (period: string | null) => void;
}

export const DashboardUIContext = createContext<DashboardUIContextType | undefined>(undefined);

export const useDashboardUI = () => {
  const context = useContext(DashboardUIContext);
  if (!context) throw new Error('useDashboardUI must be used within DashboardUIProvider');
  return context;
};
