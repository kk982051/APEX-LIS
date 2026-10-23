import axios from 'axios';

// Resolve Backend Base URL dynamically
export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In development, Vite proxies /api to http://localhost:8000
  return '';
};

// Configure Axios Defaults
axios.defaults.baseURL = getApiBaseUrl();

// Resolve WebSocket URL dynamically
export const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  const apiBase = getApiBaseUrl();
  if (apiBase) {
    // Separately hosted API (e.g. Netlify frontend): derive the socket from VITE_API_URL
    return `${apiBase.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/live`;
  }
  // Same origin: the Vite dev proxy (port 3000) or the backend serving the built app (Docker / Cloud Run)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws/live`;
};

export default axios;
