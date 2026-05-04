import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { PieSectorDataItem } from 'recharts/types/polar/Pie';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { CHART_CONFIG, FORMAT_CURRENCY, UI_COLORS } from '../../utils/constants';
import { IndustryTotal } from '../../utils/dataAggregator';
import styles from './Dashboard.module.css';

interface IndustryBreakdownProps {
  data: IndustryTotal[];
}

const IndustryBreakdown: React.FC<IndustryBreakdownProps> = ({ data: industryData }) => {
  const { isRightToLeft, currentLanguage, translation } = useLanguage();
  const { industryColorMap } = useExpenseData();
  const { setSelectedIndustry, selectedIndustry } = useDashboardUI();

  const activeIndustryData = useMemo(() => {
    return (industryData || []).filter((item) => item && item.totalAmount > 0);
  }, [industryData]);

  const translateIndustry = (industry: string) => {
    if (!industry) return '';
    if (industry === 'unknown') return translation.unknown;
    if (industry === 'other') return translation.other;
    return industry;
  };

  const handleIndustrySelect = (industry: string) => {
    setSelectedIndustry(selectedIndustry === industry ? null : industry);
  };

  const legendPadding = {
    paddingTop: '20px',
    paddingLeft: isRightToLeft ? '0px' : '24px',
    paddingRight: isRightToLeft ? '24px' : '0px',
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
                handleIndustrySelect(industry);
              }
            }}
            cursor="pointer"
            isAnimationActive={false}
          >
            {activeIndustryData.map((entry) => (
              <Cell
                key={`cell-${entry.industry}`}
                fill={industryColorMap[entry.industry] || UI_COLORS.border}
                stroke={selectedIndustry === entry.industry ? UI_COLORS.activeBorder : 'none'}
                strokeWidth={2}
                opacity={selectedIndustry && selectedIndustry !== entry.industry ? 0.3 : 1}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              const val = Array.isArray(value) ? (value as unknown[])[0] : value;
              const numValue = typeof val === 'number' ? val : Number(val ?? 0);
              if (numValue === 0) return [null, null];

              const nameVal = Array.isArray(name) ? (name as unknown[])[0] : name;
              const translatedName = translateIndustry(
                typeof nameVal === 'string' || typeof nameVal === 'number' ? String(nameVal) : '',
              );

              return [FORMAT_CURRENCY(numValue, currentLanguage), translatedName];
            }}
            separator=": "
            contentStyle={CHART_CONFIG.tooltip}
          />
          <Legend
            align={isRightToLeft ? 'right' : 'left'}
            verticalAlign="bottom"
            layout="horizontal"
            iconType="circle"
            wrapperStyle={legendPadding}
            formatter={(value: string) => translateIndustry(value)}
            onClick={(props: unknown) => {
              const payload = props as { value?: string };
              if (payload?.value) {
                handleIndustrySelect(payload.value);
              }
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default IndustryBreakdown;
