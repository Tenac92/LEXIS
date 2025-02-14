
import { useState, useEffect } from 'react';
import { TokenManager } from './tokenManager.js';

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const token = TokenManager.getStoredToken();
        if (token) {
          // You might want to verify the token with your backend here
          setIsAuthenticated(true);
          // Set user data if needed
        }
      } catch (error) {
        console.error('Auth verification error:', error);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      TokenManager.setToken(data.token);
      setUser(data.user);
      setIsAuthenticated(true);
      return data.user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = () => {
    TokenManager.clearToken();
    setUser(null);
    setIsAuthenticated(false);
    window.location.href = '/';
  };

  return { isAuthenticated, user, loading, login, logout };
};

export const getAuthToken = () => TokenManager.getStoredToken();

export const getUserFromToken = async () => {
  try {
    const token = TokenManager.getStoredToken();
    if (!token) return null;

    const response = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error('Failed to get user data');
    return await response.json();
  } catch (error) {
    console.error('Error getting user from token:', error);
    return null;
  }
};
