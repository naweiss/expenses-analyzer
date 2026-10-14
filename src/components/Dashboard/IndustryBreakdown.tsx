import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, TooltipValueType } from 'recharts';
import { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { NameType } from 'recharts/types/component/DefaultTooltipContent';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { CHART_CONFIG, DIMMED_OPACITY, FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import { IndustryTotal } from '../../utils/dataAggregator';
import styles from './Dashboard.module.css';

interface IndustryBreakdownProps {
  data: IndustryTotal[];
}

const IndustryBreakdown: React.FC<IndustryBreakdownProps> = ({ data: industryData }) => {
  const { isRightToLeft, currentLanguage, translation } = useLanguage();
  const { industryColorMap } = useExpenseData();
  const { toggleIndustry, selectedIndustries } = useDashboardUI();
  const isMobile = useIsMobile();

  const activeIndustryData = useMemo(() => {
    return (industryData || []).filter((item) => item && item.totalAmount > 0);
  }, [industryData]);

  const translateIndustry = (industry: string) => {
    if (!industry) return '';
    if (industry === 'unknown') return translation.unknown;
    if (industry === 'other') return translation.other;
    return industry;
  };

  return (
    <div className={styles.industryBreakdown}>
      <div className={styles.pieContainer}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100}>
          <PieChart margin={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Pie
              data={activeIndustryData}
              cx="50%"
              cy="50%"
              innerRadius={isMobile ? 50 : 60}
              outerRadius={isMobile ? 70 : 80}
              paddingAngle={5}
              dataKey="totalAmount"
              nameKey="industry"
              onClick={(data: PieSectorDataItem | null) => {
                const industry = (data?.payload as IndustryTotal | undefined)?.industry;
                if (industry) {
                  toggleIndustry(industry);
                }
              }}
              cursor="pointer"
              isAnimationActive={false}
            >
              {activeIndustryData.map((entry) => (
                <Cell
                  key={`cell-${entry.industry}`}
                  fill={industryColorMap[entry.industry] || UI_COLORS.border}
                  stroke={
                    selectedIndustries.includes(entry.industry) ? UI_COLORS.activeBorder : 'none'
                  }
                  strokeWidth={2}
                  opacity={
                    selectedIndustries.length > 0 && !selectedIndustries.includes(entry.industry)
                      ? DIMMED_OPACITY
                      : 1
                  }
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: TooltipValueType | undefined, name: NameType | undefined) => {
                if (value === undefined) return [null, null];
                const val = (Array.isArray(value) ? value[0] : value) as
                  | string
                  | number
                  | undefined;
                const numValue = typeof val === 'number' ? val : Number(val ?? 0);
                if (numValue === 0) return [null, null];

                const translatedName = translateIndustry(String(name ?? ''));

                return [FORMAT_CURRENCY(numValue, currentLanguage), translatedName];
              }}
              separator=": "
              contentStyle={{
                ...CHART_CONFIG.tooltip,
                textAlign: isRightToLeft ? 'right' : 'left',
                direction: isRightToLeft ? 'rtl' : 'ltr',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div
        className={styles.industryLegend}
        role="group"
        aria-label={translation.industryBreakdown}
      >
        {activeIndustryData.map((entry) => {
          const isSelected = selectedIndustries.includes(entry.industry);
          const translatedName = translateIndustry(entry.industry);

          return (
            <button
              type="button"
              key={`legend-${entry.industry}`}
              className={`${styles.legendItem} ${isSelected ? styles.legendItemSelected : ''}`}
              onClick={() => toggleIndustry(entry.industry)}
              aria-pressed={isSelected}
            >
              <span
                className={styles.legendColorDot}
                style={{ backgroundColor: industryColorMap[entry.industry] || UI_COLORS.border }}
              />
              <span className={styles.legendText} title={translatedName}>
                {translatedName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default IndustryBreakdown;
