// Resolve API base URL dynamically depending on where the app is loaded from
const getApiBase = () => {
  // If Vite injects a production API URL via environment variables, use it.
  if (import.meta && import.meta.env && import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  if (typeof window !== "undefined" && window.location) {
    if (window.location.protocol === "chrome-extension:") {
      return "http://localhost:8000";
    }
    const hostname = window.location.hostname;
    // If accessing via local network IP (e.g. mobile scan / other host), connect to backend on that same host
    if (hostname && hostname !== "localhost" && hostname !== "127.0.0.1") {
      return `http://${hostname}:8000`;
    }
  }
  return "http://localhost:8000";
};

export const API_BASE = getApiBase();
