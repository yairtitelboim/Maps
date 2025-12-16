import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { PerplexityModalProvider } from './contexts/PerplexityModalContext';

// Import default scenes to ensure they load on app start
import './utils/defaultScenes';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <PerplexityModalProvider>
      <App />
    </PerplexityModalProvider>
  </React.StrictMode>
);