import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

const container = document.getElementById('app-root');
const initialState = window.__APP_STATE__ ?? {};

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App initialState={initialState} />
    </React.StrictMode>
  );
}
