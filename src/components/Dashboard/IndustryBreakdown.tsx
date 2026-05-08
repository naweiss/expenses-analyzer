import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  LegendPayload,
  TooltipValueType,
} from 'recharts';
import { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { NameType } from 'recharts/types/component/DefaultTooltipContent';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTranslate } from '../../hooks/useTranslate';
import { CHART_CONFIG, DIMMED_OPACITY, FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import { IndustryTotal } from '../../types/domain';
import styles from './Dashboard.module.css';

interface IndustryBreakdownProps {
  data: IndustryTotal[];
}

const IndustryBreakdown: React.FC<IndustryBreakdownProps> = ({ data: industryData }) => {
  const { isRightToLeft, currentLanguage } = useLanguage();
  const { translateIndustry } = useTranslate();
  const { industryColorMap } = useExpenseData();
  const { toggleIndustry, selectedIndustries } = useDashboardUI();
  const isMobile = useIsMobile();

  const activeIndustryData = useMemo(() => {
    return (industryData || []).filter((item) => item && item.totalAmount > 0);
  }, [industryData]);

  const legendPadding = {
    paddingTop: isMobile ? '10px' : '20px',
    paddingLeft: isRightToLeft ? '0px' : isMobile ? '10px' : '24px',
    paddingRight: isRightToLeft ? (isMobile ? '10px' : '24px') : '0px',
  };

  return (
    <div className={styles.chartContainer}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100}>
        <PieChart>
          <Pie
            data={activeIndustryData}
            innerRadius={60}
            outerRadius={80}
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
              const val = (Array.isArray(value) ? value[0] : value) as string | number | undefined;
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
          <Legend
            align={isRightToLeft ? 'right' : 'left'}
            verticalAlign="bottom"
            layout="horizontal"
            iconType="circle"
            wrapperStyle={legendPadding}
            formatter={(value: string) => (
              <span
                style={{
                  color: selectedIndustries.includes(value)
                    ? 'var(--color-primary)'
                    : 'var(--color-text-main)',
                  fontWeight: selectedIndustries.includes(value) ? 600 : 400,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  background: selectedIndustries.includes(value)
                    ? 'var(--color-primary-soft)'
                    : 'transparent',
                }}
              >
                {translateIndustry(value)}
              </span>
            )}
            onClick={(props: LegendPayload) => {
              if (props?.value) {
                toggleIndustry(props.value);
              }
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IndustryBreakdown;
