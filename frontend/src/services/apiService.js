// frontend/src/services/apiService.js
import axios from 'axios';

// Create an Axios instance configured to use the backend URL.
const apiClient = axios.create({
    baseURL: "http://127.0.0.1:5000"
});

// --- Caching Configuration ---
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks cache for a GET request.
 */
const getFromCache = (url) => {
    const cachedEntry = cache[url];
    const now = Date.now();

    if (cachedEntry && now < cachedEntry.expiry) {
        const mockResponse = {
            data: cachedEntry.data,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config: { url },
            isCached: true
        };
        return Promise.resolve(mockResponse);
    }
    return null;
};

/**
 * Stores data in the cache.
 */
const setToCache = (url, data) => {
    cache[url] = {
        data: data,
        expiry: Date.now() + CACHE_DURATION
    };
};

/**
 * A wrapper for all GET requests to implement caching.
 */
const cachedGet = (url, config = {}) => {
    const cachedPromise = getFromCache(url);
    if (cachedPromise) {
        return cachedPromise;
    }
    
    return apiClient.get(url, config).then(response => {
        setToCache(url, response.data);
        return response;
    });
};

// Request interceptor: Add Token
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor: Handle 401
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/';
        }
        return Promise.reject(error);
    }
);


// --- API FUNCTIONS ---

export const login = (username, password) => {
    return apiClient.post('/login', { username, password });
};

// 1. Get all users (Admin)
export const getUsers = () => {
  return apiClient.get('/users');
};

// 2. Change Privilege (Admin)
export const changeUserPrivilege = (userId, privilege) => {
  return apiClient.put(`/users/change-privileges/${userId}/${privilege}`);
};

export const getDeviceInfo = (ip) => {
    return cachedGet(`/get-device-info/${ip}`);
};

export const getDeviceNeighbors = (ip) => {
    return cachedGet(`/get-device-neighbors/${ip}`);
};

export const getFullDeviceNeighbors = (ip) => {
    return cachedGet(`/get-full-neighbors/${ip}`);
};

export const getCactiGroups = () => {
    return cachedGet('/groups');
};

export const getInitialDevice = (ip) => {
    return apiClient.post('/api/devices', { ip });
};

export const getConfigTemplate = () => {
    return apiClient.get('/config-template');
};

/**
 * Uploads the generated map image and configuration file.
 * 
 * IMPORTANT: 
 * 1. Name must be 'createMap' to match import in mapExportService.js.
 * 2. Do NOT manually set 'Content-Type'. Let the browser set the boundary for FormData.
 */
export const createMap = (formData) => {
    return apiClient.post('/create-map', formData);
};

export const getTaskStatus = (taskId) => {
    return apiClient.get(`/task-status/${taskId}`);
};