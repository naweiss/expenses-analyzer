import React from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useDashboardUI } from '../../context/UIContext';
import { useTranslate } from '../../hooks/useTranslate';
import { getDateLocale } from '../../utils/dateUtils';
import styles from './Dashboard.module.css';

interface TimeframeSelectorProps {
  start: Date;
  end: Date;
}

const TimeframeSelector: React.FC<TimeframeSelectorProps> = ({ start, end }) => {
  const { currentLanguage, isRightToLeft } = useLanguage();
  const { translation } = useTranslate();
  const { timeframeViewType, setTimeframeViewType, navigateTimeframe } = useDashboardUI();

  const dateLocale = getDateLocale(currentLanguage);

  const NextIcon = isRightToLeft ? ChevronLeft : ChevronRight;
  const PrevIcon = isRightToLeft ? ChevronRight : ChevronLeft;

  const renderDateRange = () => {
    if (timeframeViewType === 'week') {
      return `${format(start, 'dd MMM', { locale: dateLocale })} - ${format(end, 'dd MMM yyyy', {
        locale: dateLocale,
      })}`;
    }
    if (timeframeViewType === 'month') {
      return format(start, 'MMMM yyyy', { locale: dateLocale });
    }
    return format(start, 'yyyy', { locale: dateLocale });
  };

  return (
    <div className={styles.timeframeSelector}>
      <div className={styles.toggleGroup}>
        <button
          type="button"
          className={timeframeViewType === 'week' ? styles.active : ''}
          onClick={() => setTimeframeViewType('week')}
        >
          {translation.week}
        </button>
        <button
          type="button"
          className={timeframeViewType === 'month' ? styles.active : ''}
          onClick={() => setTimeframeViewType('month')}
        >
          {translation.month}
        </button>
        <button
          type="button"
          className={timeframeViewType === 'year' ? styles.active : ''}
          onClick={() => setTimeframeViewType('year')}
        >
          {translation.year}
        </button>
      </div>

      <div className={styles.navigation}>
        <button type="button" onClick={() => navigateTimeframe(-1)} aria-label="Previous period">
          <PrevIcon size={20} />
        </button>
        <span className={styles.dateRange}>{renderDateRange()}</span>
        <button type="button" onClick={() => navigateTimeframe(1)} aria-label="Next period">
          <NextIcon size={20} />
        </button>
      </div>
    </div>
  );
};

export default TimeframeSelector;
