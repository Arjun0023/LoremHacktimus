import React from 'react';
import './TableComponent.css';

// Helper to make color lighter (for hex colors)
function lightenColor(hex, percent = 0.85) {
  if (!hex || !hex.startsWith('#')) return hex;
  let num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) + Math.round((255 - (num >> 16)) * percent);
  let g = ((num >> 8) & 0x00FF) + Math.round((255 - ((num >> 8) & 0x00FF)) * percent);
  let b = (num & 0x0000FF) + Math.round((255 - (num & 0x0000FF)) * percent);
  return `rgb(${r},${g},${b})`;
}

const TableComponent = ({ data }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="no-data">No table data available</div>;
  }


  const headers = Object.keys(data[0] || {}).filter(h => h.toLowerCase() !== 'color');

  return (
    <div className="table-container">
      <table className="results-table">
        <thead>
          <tr>
            {headers.map(header => (
              <th key={header}>{header.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={index}
              style={{
                background: row.color ? lightenColor(row.color, 0.85) : 'transparent'
              }}
            >
              {headers.map(header => (
                <td key={header}>
                  {typeof row[header] === 'number'
                    ? row[header].toLocaleString()
                    : row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableComponent;