
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';

function Header() {
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNavigation = (path) => {
    setShowDropdown(false);
    navigate(path);
  };

  if (!user) return null;

  return React.createElement('header', 
    { className: 'fixed top-0 left-0 right-0 bg-white border-b z-50' },
    React.createElement('div', 
      { className: 'container mx-auto px-4' },
      React.createElement('nav', 
        { className: 'flex items-center justify-between h-16' },
        React.createElement('div', 
          { className: 'flex items-center gap-8' },
          [
            React.createElement('h1', 
              { className: 'text-xl font-bold text-gray-900', key: 'title' }, 
              'Document Manager'
            ),
            React.createElement('div', 
              { className: 'flex items-center gap-4', key: 'nav-buttons' },
              [
                React.createElement('button', 
                  { onClick: () => handleNavigation('/dashboard'), 
                    className: 'text-gray-600 hover:text-gray-900',
                    key: 'dashboard' }, 
                  'Dashboard'
                ),
                React.createElement('button', 
                  { onClick: () => handleNavigation('/documents'),
                    className: 'text-gray-600 hover:text-gray-900',
                    key: 'documents' }, 
                  'Documents'
                ),
                user?.role === 'admin' && React.createElement('button', 
                  { onClick: () => handleNavigation('/users'),
                    className: 'text-gray-600 hover:text-gray-900',
                    key: 'users' }, 
                  'Users'
                )
              ]
            )
          ]
        ),
        React.createElement('div', 
          { className: 'relative' },
          [
            React.createElement('button', 
              { onClick: () => setShowDropdown(!showDropdown),
                className: 'flex items-center gap-2 text-gray-600 hover:text-gray-900',
                key: 'dropdown-button' },
              [
                React.createElement('span', { key: 'user-name' }, user?.name || user?.email),
                React.createElement('i', 
                  { className: `fas fa-chevron-down transform transition-transform ${showDropdown ? 'rotate-180' : ''}`,
                    key: 'chevron' }
                )
              ]
            ),
            showDropdown && React.createElement('div', 
              { className: 'absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1',
                key: 'dropdown-menu' },
              [
                React.createElement('button', 
                  { onClick: () => handleNavigation('/profile'),
                    className: 'block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100',
                    key: 'profile' },
                  'Profile'
                ),
                React.createElement('button', 
                  { onClick: handleLogout,
                    className: 'block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100',
                    key: 'logout' },
                  'Logout'
                )
              ]
            )
          ]
        )
      )
    )
  );
}

export default Header;
