import React, { useEffect, useState } from 'react';

/**
 * AlertToast - displays a temporary toast notification.
 * Props:
 *   message: string - the message to display
 *   risk: string (optional) - risk level or tag, displayed as a prefix
 *   duration: number (optional) - how long the toast stays visible (ms)
 */
export default function AlertToast({ message, risk = '', duration = 5000 }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const hideTimer = setTimeout(() => setVisible(false), duration);
    return () => clearTimeout(hideTimer);
  }, [duration]);

  if (!visible) return null;

  const toastStyle = {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    minWidth: '240px',
    padding: '14px 18px',
    background: 'rgba(30, 41, 59, 0.92)', // dark glass
    backdropFilter: 'blur(8px)',
    color: '#fff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    zIndex: 10000,
    opacity: visible ? 1 : 0,
    transition: 'opacity 0.4s ease',
    fontFamily: "'Outfit', sans-serif",
  };

  const header = risk ? `[${risk}] ` : '';

  return (
    <div style={toastStyle} role="alert">
      {header}{message}
    </div>
  );
}
