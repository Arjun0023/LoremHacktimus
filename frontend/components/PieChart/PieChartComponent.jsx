import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import './PieChartComponent.css';

const PieChartComponent = ({ data }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="no-chart-data">No chart data available</div>;
  }

  // Take only top 10 items for better pie chart visualization
  const topData = data.slice(0, 10);

  // Generate colors for pie chart segments
  const generateColors = (length) => {
    const colors = [];
    for (let i = 0; i < length; i++) {
      const hue = (i * 360) / length;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  };

  const colors = generateColors(topData.length);

  // Determine the data key for values
  const getDataKey = () => {
    if (topData.length === 0) return 'value';
    const firstItem = topData[0];
    const numericKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'number' && key !== 'id'
    );
    return numericKeys[0] || 'value';
  };

  // Determine the category key for labels
  const getCategoryKey = () => {
    if (topData.length === 0) return 'category';
    const firstItem = topData[0];
    const stringKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'string' || key === 'category' || key === 'name'
    );
    return stringKeys[0] || 'category';
  };

  const dataKey = getDataKey();
  const categoryKey = getCategoryKey();

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="custom-pie-tooltip">
          <p className="tooltip-label">{data[categoryKey]}</p>
          <p className="tooltip-value" style={{ color: payload[0].color }}>
            Value: {data[dataKey].toLocaleString()}
          </p>
          <p className="tooltip-percentage">
            {((data[dataKey] / topData.reduce((sum, item) => sum + item[dataKey], 0)) * 100).toFixed(1)}%
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom label function
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
    if (percent < 0.05) return null; // Don't show labels for slices smaller than 5%
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
        fontSize="12"
        fontWeight="600"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="pie-chart-wrapper">
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={topData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={120}
              fill="#8884d8"
              dataKey={dataKey}
              animationBegin={0}
              animationDuration={800}
            >
              {topData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color || colors[index]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value, entry) => (
                <span style={{ color: entry.color, fontWeight: '500' }}>
                  {topData[entry.payload?.index]?.[categoryKey] || value}
                </span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {data.length > 10 && (
        <div className="chart-note">
          <p>Showing top 10 items out of {data.length} total items</p>
        </div>
      )}
    </div>
  );
};

export default PieChartComponent;