
import React from 'react';

function FAB({ onClick, icon, label }) {
  return React.createElement('button',
    {
      onClick: onClick,
      className: 'fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors',
      'aria-label': label
    },
    React.createElement('i', { className: `fas ${icon}` })
  );
}

export default FAB;
