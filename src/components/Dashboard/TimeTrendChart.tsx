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
} from 'recharts';
import { BarChart3, Layers, LineChart as LineIcon } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useExpenseData } from '../../context/DataContext';
import { useDashboardUI } from '../../context/UIContext';
import { CHART_CONFIG, FORMAT_CURRENCY, PRIMARY_COLOR, UI_COLORS } from '../../utils/constants';
import { TimeTrendPoint } from '../../utils/dataAggregator';
import styles from './Dashboard.module.css';

interface TimeTrendChartProps {
  data: TimeTrendPoint[];
  onBarClick: (dateLabel: string | null) => void;
  selectedPeriod: string | null;
}

type ChartType = 'bar' | 'stackedBar' | 'line';

const TimeTrendChart: React.FC<TimeTrendChartProps> = ({
  data: trendData,
  onBarClick,
  selectedPeriod,
}) => {
  const { isRightToLeft, currentLanguage, translation } = useLanguage();
  const { industryColorMap } = useExpenseData();
  const { selectedIndustry } = useDashboardUI();
  const [chartType, setChartType] = useState<ChartType>('bar');

  const translateIndustry = (industry: string) => {
    if (industry === 'unknown') return translation.unknown;
    if (industry === 'other') return translation.other;
    return industry;
  };

  const industries = useMemo(() => {
    return Object.keys(industryColorMap).filter((industry) =>
      trendData.some((point) => (Number(point[industry]) || 0) > 0),
    );
  }, [industryColorMap, trendData]);

  const activeColor = selectedIndustry ? industryColorMap[selectedIndustry] : PRIMARY_COLOR;

  const handleChartClick = (data: unknown) => {
    const chartData = data as { activePayload?: { payload: TimeTrendPoint }[] };
    if (chartData?.activePayload && chartData.activePayload.length > 0) {
      const { dateLabel } = chartData.activePayload[0].payload;
      onBarClick(selectedPeriod === dateLabel ? null : dateLabel);
    }
  };

  const chartMargins = {
    ...CHART_CONFIG.margins,
    // Note: Container is now forced to LTR.
    // Left axis (English) needs left margin.
    // Right axis (Hebrew) needs right margin.
    left: isRightToLeft ? 10 : 20,
    right: isRightToLeft ? 20 : 10,
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
        width={isRightToLeft ? 90 : 70}
        axisLine={false}
        tickLine={false}
        domain={[0, 'auto']}
        tick={{
          fill: UI_COLORS.text,
          fontSize: 11,
          // Since container is now LTR:
          // Right orientation labels should be 'start' (grow right)
          // Left orientation labels should be 'end' (grow left)
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
        formatter={(value: unknown, name: unknown) => {
          const val = Array.isArray(value) ? (value as unknown[])[0] : value;
          const numValue = typeof val === 'number' ? val : Number(val ?? 0);

          // IMPORTANT: Return primitive null (not an array) to tell Recharts
          // to completely skip rendering this item's <li> element.
          if (numValue <= 0) return null;

          const nameVal = Array.isArray(name) ? (name as unknown[])[0] : name;
          const translatedName = translateIndustry(
            typeof nameVal === 'string' || typeof nameVal === 'number' ? String(nameVal) : '',
          );

          const isTotalAmount = nameVal === 'totalAmount' || nameVal === translation.totalExpenses;

          if (isTotalAmount) {
            // For Total Spending: Return [value, ""] with separator="" result: "Value"
            return [FORMAT_CURRENCY(numValue, currentLanguage), ''];
          }

          // For Breakdowns: Return [": " + value, name] with separator="" result: "Name: Value"
          return [`: ${FORMAT_CURRENCY(numValue, currentLanguage)}`, translatedName];
        }}
        separator=""
        contentStyle={CHART_CONFIG.tooltip}
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
            >
              {trendData.map((point, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={activeColor}
                  opacity={selectedPeriod && selectedPeriod !== point.dateLabel ? 0.3 : 1}
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
                opacity={selectedIndustry && selectedIndustry !== industry ? 0.3 : 1}
                radius={[0, 0, 0, 0]}
                cursor="pointer"
              />
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
            {industries.map((industry) => (
              <Line
                key={industry}
                type="monotone"
                dataKey={industry}
                stroke={industryColorMap[industry]}
                strokeWidth={2}
                dot={{ r: 4, fill: industryColorMap[industry], strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                opacity={selectedIndustry && selectedIndustry !== industry ? 0.2 : 1}
                connectNulls
              />
            ))}
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
