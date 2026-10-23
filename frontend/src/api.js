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
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname || 'localhost';
  const port = '8000';
  return `${protocol}//${host}:${port}/ws/live`;
};

export default axios;
