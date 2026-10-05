import React, { useCallback } from 'react';
import { parse, isValid } from 'date-fns';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboardUI } from '../../context/UIContext';
import { useDashboardData } from '../../context/useDashboardData';
import { getDateLocale } from '../../utils/dateUtils';
import { TREND_DATE_FORMATS } from '../../utils/constants';
import TimeframeSelector from './TimeframeSelector';
import ExpenseSummary from './ExpenseSummary';
import IndustryBreakdown from './IndustryBreakdown';
import TimeTrendChart from './TimeTrendChart';
import TransactionTable from './TransactionTable';
import styles from './Dashboard.module.css';

const Dashboard: React.FC = () => {
  const { translation, currentLanguage } = useLanguage();
  const {
    selectedIndustries,
    setSelectedIndustries,
    timeframeViewType,
    setTimeframeViewType,
    setReferenceDate,
    referenceDate,
    selectedTrendPeriod,
    setSelectedTrendPeriod,
  } = useDashboardUI();

  const dateLocale = getDateLocale(currentLanguage);
  const {
    timeframeStartDate,
    timeframeEndDate,
    filteredTransactions,
    industryBreakdownData,
    timeTrendData,
  } = useDashboardData();

  const handleChartClick = useCallback(
    (label: string | null) => {
      if (!label) {
        setSelectedTrendPeriod(null);
        return;
      }

      // If we're already at the lowest level (week), just filter the table
      if (timeframeViewType === 'week') {
        setSelectedTrendPeriod(selectedTrendPeriod === label ? null : label);
        return;
      }

      // Otherwise, drill down into the selected period
      const targetDate = parse(label, TREND_DATE_FORMATS[timeframeViewType], referenceDate, {
        locale: dateLocale,
      });
      if (isValid(targetDate)) {
        setReferenceDate(targetDate);
        setTimeframeViewType(timeframeViewType === 'year' ? 'month' : 'week');
      }

      setSelectedTrendPeriod(null);
    },
    [
      timeframeViewType,
      referenceDate,
      dateLocale,
      setTimeframeViewType,
      setReferenceDate,
      selectedTrendPeriod,
      setSelectedTrendPeriod,
    ],
  );

  const translateIndustry = (industry: string) => {
    if (industry === 'unknown') return translation.unknown;
    if (industry === 'other') return translation.other;
    return industry;
  };

  return (
    <div className={styles.dashboard}>
      <ExpenseSummary
        transactions={filteredTransactions}
        startDate={timeframeStartDate}
        endDate={timeframeEndDate}
      />

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
            {selectedIndustries.length > 0
              ? `(${selectedIndustries.map(translateIndustry).join(', ')})`
              : ''}
          </h3>
          <TimeTrendChart
            data={timeTrendData}
            onBarClick={handleChartClick}
            selectedPeriod={selectedTrendPeriod}
          />
        </div>
      </div>

      <div className={styles.detailsCard}>
        <div className={styles.detailsHeader}>
          <h3>{translation.transactionDetails}</h3>
          <div className={styles.activeFilters}>
            {(selectedIndustries.length > 0 || selectedTrendPeriod) && (
              <button
                className={styles.clearFiltersBtn}
                onClick={() => {
                  setSelectedIndustries([]);
                  setSelectedTrendPeriod(null);
                }}
              >
                {translation.reset}
              </button>
            )}
            {selectedIndustries.map((industry) => (
              <span key={industry} className={styles.filterBadge}>
                {translateIndustry(industry)}
              </span>
            ))}
            {selectedTrendPeriod && (
              <span className={styles.filterBadge}>{selectedTrendPeriod}</span>
            )}
          </div>
        </div>
        <TransactionTable transactions={filteredTransactions} />
      </div>
    </div>
  );
};

export default Dashboard;
