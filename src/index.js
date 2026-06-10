import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, getThemePref } from './lib/theme';
import './index.css';
import './styles/effects.css';

// The inline script in public/index.html already set the theme; re-apply to sync meta tags.
applyTheme(getThemePref());

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
