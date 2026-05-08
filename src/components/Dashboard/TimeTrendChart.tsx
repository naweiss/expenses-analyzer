import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  TooltipValueType,
  DotItemDotProps,
} from 'recharts';
import { NameType } from 'recharts/types/component/DefaultTooltipContent';
import { BarChart3, Layers, LineChart as LineIcon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useTranslate } from '../../hooks/useTranslate';
import {
  CHART_CONFIG,
  DIMMED_OPACITY,
  FORMAT_CURRENCY,
  PRIMARY_COLOR,
  UI_COLORS,
} from '../../utils/constants';
import { TimeTrendPoint } from '../../types/domain';
import styles from './Dashboard.module.css';

interface TimeTrendChartProps {
  data: TimeTrendPoint[];
  onBarClick: (dateLabel: string | null) => void;
  selectedPeriod: string | null;
}

type ChartType = 'bar' | 'stackedBar' | 'line';

interface CustomDotProps extends DotItemDotProps {
  payload: TimeTrendPoint;
}

interface RechartsClickState {
  activeLabel?: string | number;
  activePayload?: { payload: TimeTrendPoint }[];
}

const TimeTrendChart: React.FC<TimeTrendChartProps> = ({
  data: trendData,
  onBarClick,
  selectedPeriod,
}) => {
  const { isRightToLeft, currentLanguage } = useLanguage();
  const { translateIndustry, translation } = useTranslate();
  const { industryColorMap } = useExpenseData();
  const { selectedIndustries } = useDashboardUI();
  const isMobile = useIsMobile();
  const [chartType, setChartType] = useState<ChartType>('bar');

  const industries = useMemo(() => {
    return Object.keys(industryColorMap).filter((industry) =>
      trendData.some((point) => (Number(point[industry]) || 0) > 0),
    );
  }, [industryColorMap, trendData]);

  const activeColor =
    selectedIndustries.length === 1
      ? (industryColorMap[selectedIndustries[0]] ?? PRIMARY_COLOR)
      : PRIMARY_COLOR;

  const handleChartClick = (state: RechartsClickState) => {
    const label = state?.activeLabel ?? state?.activePayload?.[0]?.payload?.dateLabel;
    if (label !== undefined && label !== null) {
      const labelStr = String(label);
      // Only allow selection if the clicked point has expenses
      const point = trendData.find((d) => d.dateLabel === labelStr);
      if (point && point.totalAmount > 0) {
        onBarClick(selectedPeriod === labelStr ? null : labelStr);
      }
    }
  };

  const chartMargins = {
    top: 10,
    bottom: 20,
    left: isMobile ? 0 : isRightToLeft ? 10 : 20,
    right: isMobile ? 0 : isRightToLeft ? 20 : 10,
  };

  const renderChart = () => {
    const commonProps = {
      data: trendData,
      margin: chartMargins,
      onClick: handleChartClick,
    };

    const xAxis = (
      <XAxis
        dataKey="dateLabel"
        axisLine={false}
        tickLine={false}
        tick={{ fill: UI_COLORS.text, fontSize: 11 }}
        dy={10}
        reversed={isRightToLeft}
      />
    );

    const yAxis = (
      <YAxis
        width={50}
        axisLine={false}
        tickLine={false}
        domain={[0, 'auto']}
        tick={{
          fill: UI_COLORS.text,
          fontSize: isMobile ? 9 : 10,
          textAnchor: isRightToLeft ? 'start' : 'end',
        }}
        tickFormatter={(value: number) =>
          isRightToLeft ? `₪${value.toLocaleString()}` : `$${value.toLocaleString()}`
        }
        orientation={isRightToLeft ? 'right' : 'left'}
      />
    );

    const tooltip = (
      <Tooltip
        formatter={(value: TooltipValueType | undefined, name: NameType | undefined) => {
          if (value === undefined) return null;
          const val = (Array.isArray(value) ? value[0] : value) as string | number | undefined;
          const numValue = typeof val === 'number' ? val : Number(val ?? 0);
          if (numValue <= 0) return null;

          const translatedName = translateIndustry(String(name ?? ''));

          return [FORMAT_CURRENCY(numValue, currentLanguage), translatedName];
        }}
        separator=": "
        contentStyle={{
          ...CHART_CONFIG.tooltip,
          textAlign: isRightToLeft ? 'right' : 'left',
          direction: isRightToLeft ? 'rtl' : 'ltr',
        }}
        cursor={{ fill: UI_COLORS.background }}
        itemSorter={(item) => -(Number(item.value) || 0)}
      />
    );

    switch (chartType) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={UI_COLORS.grid} />
            {xAxis}
            {yAxis}
            {tooltip}
            <Bar
              dataKey="totalAmount"
              name={translation.totalExpenses}
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(data: { dateLabel?: string; payload?: { dateLabel?: string } }) => {
                const label = data?.dateLabel ?? data?.payload?.dateLabel;
                if (label) {
                  const point = trendData.find((pt) => pt.dateLabel === label);
                  if (point && point.totalAmount > 0) {
                    onBarClick(selectedPeriod === label ? null : label);
                  }
                }
              }}
            >
              {trendData.map((point, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={activeColor}
                  opacity={
                    selectedPeriod && selectedPeriod !== point.dateLabel ? DIMMED_OPACITY : 1
                  }
                />
              ))}
            </Bar>
          </BarChart>
        );
      case 'stackedBar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={UI_COLORS.grid} />
            {xAxis}
            {yAxis}
            {tooltip}
            {industries.map((industry) => (
              <Bar
                key={industry}
                dataKey={industry}
                stackId="a"
                fill={industryColorMap[industry]}
                radius={[0, 0, 0, 0]}
                cursor="pointer"
                onClick={(data: { dateLabel?: string; payload?: { dateLabel?: string } }) => {
                  const label = data?.dateLabel ?? data?.payload?.dateLabel;
                  if (label) {
                    const point = trendData.find((pt) => pt.dateLabel === label);
                    if (point && point.totalAmount > 0) {
                      onBarClick(selectedPeriod === label ? null : label);
                    }
                  }
                }}
              >
                {trendData.map((point, index) => {
                  const isDateSelected = !selectedPeriod || selectedPeriod === point.dateLabel;
                  return (
                    <Cell key={`cell-${index}`} opacity={isDateSelected ? 1 : DIMMED_OPACITY} />
                  );
                })}
              </Bar>
            ))}
          </BarChart>
        );
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={UI_COLORS.grid} />
            {xAxis}
            {yAxis}
            {tooltip}
            {industries.map((industry) => {
              const lineOpacity = selectedPeriod ? DIMMED_OPACITY : 1;

              return (
                <Line
                  key={industry}
                  type="monotone"
                  dataKey={industry}
                  stroke={industryColorMap[industry]}
                  strokeWidth={2}
                  opacity={lineOpacity}
                  dot={(props: CustomDotProps) => {
                    const { cx, cy, payload } = props;
                    if (cx === undefined || cy === undefined) return <React.Fragment />;

                    // If a date is selected, hide all dots except the selected one
                    if (selectedPeriod && selectedPeriod !== payload.dateLabel) {
                      return <React.Fragment />;
                    }

                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={selectedPeriod ? 5 : 4}
                        fill={industryColorMap[industry]}
                        stroke="none"
                        opacity={1}
                      />
                    );
                  }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.chartWithSwitcher}>
      <div className={styles.chartSwitcher}>
        <button
          className={`${styles.switcherBtn} ${chartType === 'bar' ? styles.active : ''}`}
          onClick={() => setChartType('bar')}
          data-tooltip="Total Spending"
        >
          <BarChart3 size={16} />
        </button>
        <button
          className={`${styles.switcherBtn} ${chartType === 'stackedBar' ? styles.active : ''}`}
          onClick={() => setChartType('stackedBar')}
          data-tooltip="Stacked Categories"
        >
          <Layers size={16} />
        </button>
        <button
          className={`${styles.switcherBtn} ${chartType === 'line' ? styles.active : ''}`}
          onClick={() => setChartType('line')}
          data-tooltip="Category Trends"
        >
          <LineIcon size={16} />
        </button>
      </div>
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={100}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TimeTrendChart;
