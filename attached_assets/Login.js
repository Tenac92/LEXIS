import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../utils/api.js';
import { useAuth } from '../contexts/AuthContext.js';
import LoadingSpinner from './LoadingSpinner.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const validateInput = () => {
    if (!email.trim()) return 'Email is required';
    if (!password.trim()) return 'Password is required';
    if (password.length < 6) return 'Password must be at least 6 characters';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const validationError = validateInput();
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    try {
      const response = await API.request('api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim()
        })
      });

      if (response?.token) {
        await login({ email, password });
        navigate('/', { replace: true });
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return React.createElement('div', { className: 'min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8' },
    React.createElement('div', { className: 'max-w-md w-full space-y-8' },
      React.createElement('div', null,
        React.createElement('h2', { className: 'mt-6 text-center text-3xl font-extrabold text-gray-900' }, 'Sign in to your account'),
        React.createElement('p', { className: 'mt-2 text-center text-sm text-gray-600' }, 'Please enter your credentials')
      ),
      error && React.createElement('div', { 
        className: 'bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative',
        role: 'alert'
      }, React.createElement('span', { className: 'block sm:inline' }, error)),
      React.createElement('form', { className: 'mt-8 space-y-6', onSubmit: handleSubmit },
        React.createElement('div', { className: 'rounded-md shadow-sm -space-y-px' },
          React.createElement('div', null,
            React.createElement('input', {
              id: 'email',
              name: 'email',
              type: 'email',
              required: true,
              value: email,
              onChange: (e) => setEmail(e.target.value),
              className: 'appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm',
              placeholder: 'Email address',
              disabled: isLoading
            })
          ),
          React.createElement('div', null,
            React.createElement('input', {
              id: 'password',
              name: 'password',
              type: 'password',
              required: true,
              value: password,
              onChange: (e) => setPassword(e.target.value),
              className: 'appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm',
              placeholder: 'Password',
              disabled: isLoading
            })
          )
        ),
        React.createElement('div', null,
          React.createElement('button', {
            type: 'submit',
            disabled: isLoading,
            className: `group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`
          }, isLoading ? React.createElement(LoadingSpinner) : 'Sign in')
        )
      )
    )
  );
}