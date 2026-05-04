import { createContext, useContext } from 'react';
import { TimeframeType } from '../utils/dataAggregator';

export interface DashboardUIContextType {
  currentFileIndex: number;
  setCurrentFileIndex: (index: number) => void;
  timeframeViewType: TimeframeType;
  setTimeframeViewType: (type: TimeframeType) => void;
  referenceDate: Date;
  navigateTimeframe: (direction: number) => void;
  resetView: () => void;
  selectedIndustry: string | null;
  setSelectedIndustry: (industry: string | null) => void;
}

export const DashboardUIContext = createContext<DashboardUIContextType | undefined>(undefined);

export const useDashboardUI = () => {
  const context = useContext(DashboardUIContext);
  if (!context) throw new Error('useDashboardUI must be used within DashboardUIProvider');
  return context;
};
