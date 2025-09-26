import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { applyTheme, resolvePreferredTheme } from './themePreferences.js';

import './styles/tokens.css';

applyTheme(resolvePreferredTheme());

const container = document.getElementById('app-root');

function getInitialState() {
  const stateElement = document.getElementById('app-state');

  if (stateElement?.textContent) {
    try {
      return JSON.parse(stateElement.textContent);
    } catch (error) {
      console.error('Failed to parse initial app state', error);
    }
  }

  return window.__APP_STATE__ ?? {};
}

const initialState = getInitialState();

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App initialState={initialState} />
    </React.StrictMode>
  );
}
