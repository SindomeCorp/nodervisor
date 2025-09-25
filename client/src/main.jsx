import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './app.css';
import './dashboard.css';

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
