import React, { createContext, useContext, useState, useEffect } from 'react';
import AlertToast from '../components/AlertToast';
import axios from 'axios';
import { API_BASE } from '../config';

// Create Context
const AuthContext = createContext({
  token: '',
  setToken: () => {},
  refreshToken: () => {}
});

export const AuthProvider = ({ children }) => {
  // Try to read token from chrome.storage.sync if available, else fallback to localStorage
  const [token, setToken] = useState('');

  // Initial load
  useEffect(() => {
    const loadToken = async () => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        chrome.storage.sync.get(['aegis_token'], (result) => {
          if (result.aegis_token) {
            setToken(result.aegis_token);
          } else {
            const ls = localStorage.getItem('aegis_token');
            if (ls) setToken(ls);
          }
        });
      } else {
        const ls = localStorage.getItem('aegis_token');
        if (ls) setToken(ls);
      }
    };
    loadToken();
  }, []);

  // Alert state and listener
  const [alert, setAlert] = useState({ message: '', risk: '', visible: false });

  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      const listener = (msg, sender, sendResponse) => {
        if (msg.type === 'alert') {
          let payload = msg.payload;
          try { payload = JSON.parse(msg.payload); } catch (e) {}
          const message = typeof payload === 'object' && payload.message ? payload.message : payload;
          const risk = typeof payload === 'object' && payload.risk ? payload.risk : '';
          setAlert({ message, risk, visible: true });
        }
      };
      chrome.runtime.onMessage.addListener(listener);
      return () => chrome.runtime.onMessage.removeListener(listener);
    }
  }, []);

  // Persist token changes
  useEffect(() => {
    if (!token) return;
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ aegis_token: token }, () => {});
    }
    localStorage.setItem('aegis_token', token);
  }, [token]);

  // Refresh token periodically (every 5 minutes)
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const resp = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const newToken = resp.data.access_token;
        if (newToken && newToken !== token) {
          setToken(newToken);
        }
      } catch (e) {
        console.warn('Auth refresh failed', e);
      }
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [token]);

  const refreshToken = async () => {
    if (!token) return;
    try {
      const resp = await axios.post(`${API_BASE}/api/auth/refresh`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const newToken = resp.data.access_token;
      if (newToken) setToken(newToken);
    } catch (e) {
      console.warn('Manual auth refresh failed', e);
    }
  };

  return (
    <AuthContext.Provider value={{ token, setToken, refreshToken }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook for consuming the context
export const useAuth = () => useContext(AuthContext);
