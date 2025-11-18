// frontend/src/services/apiService.js
import axios from 'axios';

// Create an Axios instance configured to use the backend URL from environment variables.
const apiClient = axios.create({
    baseURL: "http://127.0.0.1:5000"
});

// --- Caching Configuration ---
const cache = {};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Checks cache for a GET request. If found and valid, returns a resolved Promise with the cached data.
 * @param {string} url - The URL to check in the cache.
 * @returns {Promise<object> | null} A resolved Promise with the cached data if hit, otherwise null.
 */
const getFromCache = (url) => {
    const cachedEntry = cache[url];
    const now = Date.now();

    if (cachedEntry && now < cachedEntry.expiry) {
        // Return a mock Axios response object wrapped in a resolved promise
        const mockResponse = {
            data: cachedEntry.data,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config: { url },
            isCached: true // Custom flag for debugging/logging if needed
        };
        return Promise.resolve(mockResponse);
    }
    return null;
};

/**
 * Stores data in the cache for a GET request.
 * @param {string} url - The URL key for the cache.
 * @param {object} data - The data to cache.
 */
const setToCache = (url, data) => {
    cache[url] = {
        data: data,
        expiry: Date.now() + CACHE_DURATION
    };
};

/**
 * A wrapper for all GET requests to implement caching.
 * Only non-transient data like device info, neighbors, and cacti groups are cached.
 * Task status is NOT cached.
 * @param {string} url - The API endpoint.
 * @param {object} [config={}] - Axios request config.
 * @returns {Promise<object>} The Axios response.
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

// Use a request interceptor to automatically add the auth token to every request.
apiClient.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Use a response interceptor to handle 401 Unauthorized errors globally.
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Check if the error is a 401 Unauthorized response.
        if (error.response && error.response.status === 401) {
            // Clear the invalid/expired token from storage.
            localStorage.removeItem('token');
            // Redirect the user to the login page by reloading the application.
            window.location.href = '/';
        }
        // For all other errors, reject the promise to allow for local error handling.
        return Promise.reject(error);
    }
);


/**
 * Authenticates a user against the backend.
 * @param {string} username - The user's username.
 * @param {string} password - The user's password.
 * @returns {Promise<object>} A promise resolving to the authentication response, containing the token.
 */
export const login = (username, password) => {
    return apiClient.post('/login', { username, password });
};

/**
 * Fetches detailed information for a single device by its IP address.
 * @param {string} ip - The IP address of the device.
 * @returns {Promise<object>} A promise that resolves to the device's information.
 */
export const getDeviceInfo = (ip) => {
    return cachedGet(`/get-device-info/${ip}`);
};

/**
 * Fetches the list of CDP neighbors for a given device.
 * @param {string} ip - The IP address of the device.
 * @returns {Promise<object>} A promise that resolves to the list of neighbors.
 */
export const getDeviceNeighbors = (ip) => {
    return cachedGet(`/get-device-neighbors/${ip}`);
};

/**
 * Fetches all registered Cacti groups from the backend.
 * @returns {Promise<object>} A promise that resolves to the list of Cacti groups.
 */
export const getCactiGroups = () => {
    return cachedGet('/groups');
};

/**
 * Fetches information for the initial device to start a map.
 * This is a POST request to align with the original backend endpoint.
 * @param {string} ip - The IP address of the starting device.
 * @returns {Promise<object>} A promise that resolves to the initial device's data.
 */
export const getInitialDevice = (ip) => {
    return apiClient.post('/api/devices', { ip });
};

/**
 * Fetches the Cacti Weathermap configuration template from the backend.
 * @returns {Promise<object>} A promise that resolves with the template content.
 */
export const getConfigTemplate = () => {
    // Templates are not cached as they might be updated on the server.
    return apiClient.get('/config-template');
};

/**
 * Uploads the generated map image and configuration file to the backend to start a task.
 * @param {FormData} formData - The form data containing the image, config, map name, and Cacti group ID.
 * @returns {Promise<object>} A promise that resolves with the task creation response.
 */
export const createMap = (formData) => {
    return apiClient.post('/create-map', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
};

/**
 * Retrieves the status of a background map creation task.
 * @param {string} taskId - The ID of the task to check.
 * @returns {Promise<object>} A promise that resolves with the current task status.
 */
export const getTaskStatus = (taskId) => {
    // Task status is transient and must not be cached.
    return apiClient.get(`/task-status/${taskId}`);
};
