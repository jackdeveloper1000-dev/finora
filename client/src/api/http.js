import axios from 'axios';

const http = axios.create({ baseURL: '/api', withCredentials: true, timeout: 20000 });

let accessToken = null;
let refreshPromise = null;
let onAuthFailure = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const setAuthFailureHandler = (handler) => {
  onAuthFailure = handler;
};

// Single-flight: concurrent callers (incl. React StrictMode) share one refresh,
// so a rotated refresh token is never replayed.
export const refreshSession = () => {
  refreshPromise ??= axios
    .post('/api/auth/refresh', null, { withCredentials: true })
    .then(({ data }) => {
      accessToken = data.accessToken;
      return data;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const isAuthCall = config?.url?.startsWith('/auth/');
    if (response?.status === 401 && config && !config._retried && !isAuthCall) {
      config._retried = true;
      try {
        await refreshSession();
        return http(config);
      } catch {
        accessToken = null;
        onAuthFailure();
      }
    }
    return Promise.reject(error);
  },
);

export default http;
