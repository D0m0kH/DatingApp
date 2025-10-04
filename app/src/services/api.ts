// app/src/services/api.ts

import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// --- Type Definitions ---
// Define the specific structure of the refresh response now that it's FASE-aware
interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  fingerprintId: string;
  user: any;
}
interface ApiResponse<T> {
  data: T;
  message?: string;
}

export class ApiError extends Error {
  constructor(public message: string, public status: number, public code?: string, public details?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = Constants.expoConfig?.extra?.API_URL;
if (!API_URL) {
  console.error('API_URL is not configured in Expo constants.');
}

// --- Axios Instance ---
const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    // Advanced: Placeholder for PoP (Proof of Possession) header if needed
    // 'X-Client-Proof': '...' 
  },
});

// --- State for Token Refresh Queue ---
let isRefreshing = false;
let failedQueue: { resolve: (value: any) => void; reject: (reason?: any) => void; config: any }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(api(prom.config));
    }
  });
  failedQueue = [];
};

// --- Request Interceptor: Attach Access Token ---
api.interceptors.request.use(async (config) => {
  const accessToken = await SecureStore.getItemAsync('accessToken');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// --- Response Interceptor: Handle 401 and FASE Token Refresh ---
api.interceptors.response.use(
  (response) => response, 
  async (error: AxiosError) => {
    const originalRequest = error.config;

    // Check for 401 Unauthorized (and ensure it's not the refresh endpoint itself)
    if (error.response?.status === 401 && originalRequest && originalRequest.url !== '/api/auth/refresh') {
      
      // 1. Queue the original request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject, config: originalRequest });
        });
      }

      isRefreshing = true;
      const refreshToken = await SecureStore.getItemAsync('refreshToken');
      const fingerprintId = await SecureStore.getItemAsync('fingerprintId'); // FASE ID is critical

      if (!refreshToken || !fingerprintId) {
        isRefreshing = false;
        // Missing FASE component, trigger full logout
        return Promise.reject(error);
      }

      try {
        // 3. Attempt FASE-aligned token refresh
        const refreshResponse = await axios.post<ApiResponse<RefreshResponseData>>(`${API_URL}/api/auth/refresh`, {
            refreshToken,
            fingerprintId, // Send FASE ID for rotation verification
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken, fingerprintId: newFingerprintId } = refreshResponse.data.data;

        // 4. Update stored FASE tokens
        await SecureStore.setItemAsync('accessToken', newAccessToken);
        await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        await SecureStore.setItemAsync('fingerprintId', newFingerprintId); // Update FASE ID

        // 5. Retry queued requests
        processQueue(null, newAccessToken);

        // 6. Retry the original failed request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // 7. Refresh failed (token expired/revoked) - force logout
        processQueue(refreshError);
        // The AuthProvider should catch this original 401 error and initiate clean logout
        return Promise.reject(error); 
      } finally {
        isRefreshing = false;
      }
    }

    // 8. Handle non-401 errors
    const status = error.response?.status || 500;
    const data = error.response?.data as { error: string, code?: string, details?: any };
    const message = data?.error || error.message;
    const code = data?.code;
    const details = data?.details;
    
    // Advanced: Map IdentityError (403) specifically
    if (status === 403 && code === 'VERIFICATION_NEEDED') {
        return Promise.reject(new ApiError('Identity verification required.', 403, 'IDENTITY_REQUIRED', details));
    }

    return Promise.reject(new ApiError(message, status, code, details));
  }
);

// --- Exported Helpers (Unwrap data and throw typed errors) ---

const unwrap = <T>(promise: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> => {
  return promise.then(response => response.data.data);
};

export const get = <T>(url: string, params?: object) => {
  return unwrap(api.get<ApiResponse<T>>(url, { params }));
};

export const post = <T>(url: string, data?: object) => {
  return unwrap(api.post<ApiResponse<T>>(url, data));
};

export const put = <T>(url: string, data?: object) => {
  return unwrap(api.put<ApiResponse<T>>(url, data));
};

export const patch = <T>(url: string, data?: object) => {
  return unwrap(api.patch<ApiResponse<T>>(url, data));
};

export const del = <T>(url: string) => {
  return unwrap(api.delete<ApiResponse<T>>(url));
};