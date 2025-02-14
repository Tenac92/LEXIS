
import React from 'react';

const DataCard = ({ title, value, icon }) => {
  return React.createElement('div', 
    { className: 'bg-white p-6 rounded-lg shadow-lg' },
    [
      React.createElement('div', 
        { className: 'flex items-center space-x-4', key: 'header' },
        [
          icon && React.createElement('div', { className: 'text-blue-600', key: 'icon' }, icon),
          React.createElement('h3', { className: 'text-lg font-semibold', key: 'title' }, title)
        ]
      ),
      React.createElement('p', 
        { className: 'text-3xl font-bold mt-2', key: 'value' }, 
        typeof value === 'object' ? JSON.stringify(value) : value
      )
    ]
  );
};

export default DataCard;
