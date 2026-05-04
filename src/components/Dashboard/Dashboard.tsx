import React, { useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboardUI } from '../../context/UIContext';
import { useDashboardData } from '../../context/useDashboardData';
import { format } from 'date-fns';
import TimeframeSelector from './TimeframeSelector';
import ExpenseSummary from './ExpenseSummary';
import IndustryBreakdown from './IndustryBreakdown';
import TimeTrendChart from './TimeTrendChart';
import TransactionTable from './TransactionTable';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { translation } = useLanguage();
  const { selectedIndustry } = useDashboardUI();
  const {
    timeframeStartDate,
    timeframeEndDate,
    filteredTransactions,
    industryBreakdownData,
    timeTrendData,
  } = useDashboardData();

  const [selectedTrendPeriod, setSelectedTrendPeriod] = useState<string | null>(null);

  // Unified filtering for both Summary Cards and Detailed Table
  const activeFilteredTransactions = useMemo(() => {
    let filtered = filteredTransactions;
    if (selectedIndustry) {
      filtered = filtered.filter((t) => t.industry === selectedIndustry);
    }
    if (selectedTrendPeriod) {
      filtered = filtered.filter((t) => format(t.date, 'MMM dd') === selectedTrendPeriod);
    }
    return filtered;
  }, [filteredTransactions, selectedIndustry, selectedTrendPeriod]);

  const translateIndustry = (industry: string) => {
    if (industry === 'unknown') return translation.unknown;
    if (industry === 'other') return translation.other;
    return industry;
  };

  return (
    <div className={styles.dashboard}>
      <ExpenseSummary transactions={activeFilteredTransactions} />

      <div className={styles.topRow}>
        <TimeframeSelector start={timeframeStartDate} end={timeframeEndDate} />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3>{translation.industryBreakdown}</h3>
          <IndustryBreakdown data={industryBreakdownData} />
        </div>
        <div className={styles.chartCard}>
          <h3>
            {translation.spendingTrend}{' '}
            {selectedIndustry ? `(${translateIndustry(selectedIndustry)})` : ''}
          </h3>
          <TimeTrendChart
            data={timeTrendData}
            onBarClick={setSelectedTrendPeriod}
            selectedPeriod={selectedTrendPeriod}
          />
        </div>
      </div>

      <div className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <h3>{translation.transactionDetails}</h3>
          <div className={styles.activeFilters}>
            {selectedIndustry && (
              <span className={styles.filterBadge}>{translateIndustry(selectedIndustry)}</span>
            )}
            {selectedTrendPeriod && (
              <span className={styles.filterBadge}>{selectedTrendPeriod}</span>
            )}
          </div>
        </div>
        <TransactionTable transactions={activeFilteredTransactions} />
      </div>
    </div>
  );
};

export default Dashboard;
