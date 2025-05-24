import React from 'react';
import './TableComponent.css';

const TableComponent = ({ data }) => {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return <div className="no-data">No table data available</div>;
  }

  const headers = Object.keys(data[0] || {});
  
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
            <tr key={index}>
              {headers.map(header => (
                <td key={header}>
                  {typeof row[header] === 'number' ? 
                    row[header].toLocaleString() : 
                    row[header]
                  }
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