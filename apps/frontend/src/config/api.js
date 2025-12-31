// API configuration for mobile/desktop/production support
// Dynamically determines the backend URL based on environment

const getBackendUrl = () => {
    // Production: use environment variable set during build
    if (import.meta.env.VITE_BACKEND_URL) {
        console.log('[API Config] Using production backend URL:', import.meta.env.VITE_BACKEND_URL);
        return import.meta.env.VITE_BACKEND_URL;
    }

    // Development: use the same host that's serving the frontend
    // This ensures mobile devices can reach the backend
    const host = window.location.hostname;
    const backendPort = 3002;
    const protocol = window.location.protocol === 'https:' ? 'https' : 'http';

    // In development, always use http (backend doesn't have SSL locally)
    const devUrl = `http://${host}:${backendPort}`;
    console.log('[API Config] Using development backend URL:', devUrl);
    return devUrl;
};

export const BACKEND_URL = getBackendUrl();
export default BACKEND_URL;

