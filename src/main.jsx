import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import './index.css';

/**
 * Static hosts such as GitHub Pages have no rewrite rules, so a deep link like
 * `/codecraft/arena/A` 404s before the app boots. `public/404.html` bounces it back through
 * the entry document with the path parked in the hash; restore it here, using the base
 * Vite baked into this build. On hosts with real rewrites (Vercel) the hash is absent and
 * this is a no-op.
 */
function restoreDeepLink() {
  const { hash } = window.location;
  if (hash.length < 2 || hash[1] !== '/') return;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  window.history.replaceState(null, '', base + hash.slice(1));
}

restoreDeepLink();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
