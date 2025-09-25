import React from 'react';
import { createRoot } from 'react-dom/client';
import DashboardApp from './DashboardApp.jsx';

const container = document.getElementById('dashboard-root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <DashboardApp />
    </React.StrictMode>
  );
}
