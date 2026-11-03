import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';

import './index.css';

// Configure API base URL from environment variable.
// In development this is empty (proxied by Vite or same-origin).
// In production on Vercel, VITE_API_URL points to the backend server.
const apiUrl = import.meta.env.VITE_API_URL ?? '';
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    console.error(error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
