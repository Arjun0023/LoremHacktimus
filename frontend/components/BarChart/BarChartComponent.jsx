import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import './BarChartComponent.css';

const BarChartComponent = ({ data }) => {
  console.log("BarChartComponent data:", data);
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="no-chart-data">No chart data available</div>;
  }

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          <p className="tooltip-label">{`${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="tooltip-value" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toLocaleString()}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Determine the data key for the bar (could be 'value', 'count', 'amount', etc.)
  const getDataKey = () => {
    if (data.length === 0) return 'value';
    const firstItem = data[0];
    const numericKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'number' && key !== 'id'
    );
    return numericKeys[0] || 'value';
  };

  // Determine the category key for X-axis
  const getCategoryKey = () => {
    if (data.length === 0) return 'category';
    const firstItem = data[0];
    const stringKeys = Object.keys(firstItem).filter(key => 
      typeof firstItem[key] === 'string' || key === 'category' || key === 'name'
    );
    return stringKeys[0] || 'category';
  };

  const dataKey = getDataKey();
  const categoryKey = getCategoryKey();

  return (
    <div className="bar-chart-wrapper">
      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart 
            data={data} 
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey={categoryKey}
              angle={-45}
              textAnchor="end"
              height={100}
              interval={0}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickFormatter={(value) => value.toLocaleString()}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '20px' }}
            />
            <Bar 
              dataKey={dataKey} 
              radius={[4, 4, 0, 0]}
              name={dataKey.charAt(0).toUpperCase() + dataKey.slice(1)}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BarChartComponent;