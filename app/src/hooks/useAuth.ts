// app/src/hooks/useAuth.ts

import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import * as Device from 'expo-device';

import { post, ApiError, get } from '../services/api';
import { AuthResponse, UserPublic, Dtos, DeviceFingerprintDto, LoginDto, RegisterDto } from '../types/shared';

// --- Secure Store Fallback (for web/unsupported platforms) ---
const storage = {
  // ... (Storage utility implementation remains the same)
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web' || !SecureStore.isAvailableAsync()) { return AsyncStorage.getItem(key); }
    return SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web' || !SecureStore.isAvailableAsync()) { return AsyncStorage.setItem(key, value); }
    return SecureStore.setItemAsync(key, value);
  },
  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web' || !SecureStore.isAvailableAsync()) { return AsyncStorage.removeItem(key); }
    return SecureStore.deleteItemAsync(key);
  },
};

// --- FASE Fingerprint Generation ---
const generateFingerprint = async (): Promise<DeviceFingerprintDto> => {
    // Advanced: Generate a stable client ID (can use Expo's installation ID or generate a UUID)
    const clientId = await storage.getItem('clientId') || Application.getInstallationId() || 'web-client';
    await storage.setItem('clientId', clientId); // Ensure persistence

    return {
        userAgent: `${Device.modelName} (${Platform.OS})`,
        clientId: clientId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
};


// --- Auth Context Types ---
interface AuthContextType {
  user: UserPublic | null;
  isLoggedIn: boolean;
  loading: boolean;
  isReady: boolean; // Indicates if the initial session check is complete
  login: (data: Dtos.Login) => Promise<UserPublic>;
  register: (data: Dtos.Register) => Promise<UserPublic>;
  logout: () => Promise<void>;
  getCurrentUser: () => Promise<UserPublic | null>;
  fingerprint: DeviceFingerprintDto | null; // Expose the FASE Fingerprint
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Auth Provider ---
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [fingerprint, setFingerprint] = useState<DeviceFingerprintDto | null>(null);

  // --- Initial Fingerprint Generation ---
  useEffect(() => {
    generateFingerprint().then(setFingerprint);
  }, []);

  // --- Session Persistence Handlers ---

  /**
   * @description Stores FASE tokens and user data on successful auth.
   */
  const saveSession = useCallback(async (authResponse: AuthResponse) => {
    await storage.setItem('accessToken', authResponse.accessToken);
    await storage.setItem('refreshToken', authResponse.refreshToken);
    await storage.setItem('fingerprintId', authResponse.fingerprintId); // FASE ID
    await storage.setItem('user', JSON.stringify(authResponse.user));
    setUser(authResponse.user);
    return authResponse.user;
  }, []);

  /**
   * @description Clears all session data.
   */
  const clearSession = useCallback(async () => {
    await Promise.all([
      storage.deleteItem('accessToken'),
      storage.deleteItem('refreshToken'),
      storage.deleteItem('fingerprintId'),
      storage.deleteItem('user'),
    ]);
    setUser(null);
  }, []);

  // --- Core Auth Functions ---

  /**
   * @description Attempts to refresh the access token using the stored FASE token.
   */
  const refresh = useCallback(async (): Promise<UserPublic | null> => {
    const refreshToken = await storage.getItem('refreshToken');
    const fingerprintId = await storage.getItem('fingerprintId');

    if (!refreshToken || !fingerprintId) return null;

    try {
      // API service interceptor handles the actual refresh attempt
      const response = await post<AuthResponse>('/auth/refresh', { refreshToken, fingerprintId });
      await saveSession(response as AuthResponse);
      return response.user;
    } catch (error) {
      console.log('FASE Refresh token failed/expired. Logging out.', error);
      await clearSession();
      return null;
    }
  }, [saveSession, clearSession]);

  /**
   * @description Logs in the user with FASE fingerprint.
   */
  const login = useCallback(async (data: LoginDto): Promise<UserPublic> => {
    if (!fingerprint) throw new Error('Device fingerprint not ready.');
    setLoading(true);
    try {
      const payload: LoginDto = { ...data, fingerprint };
      const response = await post<AuthResponse>('/auth/login', payload);
      const loggedInUser = await saveSession(response as AuthResponse);
      setLoading(false);
      return loggedInUser;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [saveSession, fingerprint]);

  /**
   * @description Registers a new user with FASE fingerprint.
   */
  const register = useCallback(async (data: RegisterDto): Promise<UserPublic> => {
    if (!fingerprint) throw new Error('Device fingerprint not ready.');
    setLoading(true);
    try {
      const payload: RegisterDto = { ...data, fingerprint };
      const response = await post<AuthResponse>('/auth/register', payload);
      const registeredUser = await saveSession(response as AuthResponse);
      setLoading(false);
      return registeredUser;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  }, [saveSession, fingerprint]);

  /**
   * @description Logs out the user and revokes the FASE session on the server.
   */
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      // Server handles revocation using the current access token's fingerprintId claim
      await post('/auth/logout', {}); 
    } catch (error) {
      console.error('Server logout failed, proceeding with client-side session clear.', error);
    } finally {
      await clearSession();
      setLoading(false);
    }
  }, [clearSession]);

  /**
   * @description Retrieves the current user's profile from the server.
   */
  const getCurrentUser = useCallback(async (): Promise<UserPublic | null> => {
    try {
      // Hitting the /api/profile/me endpoint to refresh user data
      const freshUser = await get<UserPublic>('/profile/me'); 
      await storage.setItem('user', JSON.stringify(freshUser));
      setUser(freshUser);
      return freshUser;
    } catch (error) {
      // If 401, the interceptor refresh failed. Log out.
      if (error instanceof ApiError && error.status === 401) {
        await logout();
      }
      return null;
    }
  }, [logout]);


  // --- Initial Session Restore Effect ---
  useEffect(() => {
    const restoreSession = async () => {
      // Wait for fingerprint to be generated before attempting session restore
      if (!fingerprint) return;

      setLoading(true);
      try {
        const storedUser = await storage.getItem('user');
        const accessToken = await storage.getItem('accessToken');
        const refreshToken = await storage.getItem('refreshToken');
        const fingerprintId = await storage.getItem('fingerprintId');

        if (storedUser && accessToken && refreshToken && fingerprintId) {
          // Attempt to get fresh data, triggering FASE refresh via interceptor if needed
          const freshUser = await getCurrentUser();
          if (!freshUser) {
             // If profile fetch failed (due to token failure) attempt explicit FASE refresh
             await refresh();
          }
        } else {
          await clearSession();
        }
      } catch (e) {
        console.error('Error during FASE session restore:', e);
        await clearSession();
      } finally {
        setLoading(false);
        setIsReady(true);
      }
    };

    if (fingerprint) {
        restoreSession();
    }
  }, [fingerprint, refresh, clearSession, getCurrentUser]);

  // --- Memoized Context Value ---
  const contextValue = useMemo(() => ({
    user,
    isLoggedIn: !!user,
    loading,
    isReady,
    login,
    register,
    logout,
    getCurrentUser,
    fingerprint,
  }), [user, loading, isReady, login, register, logout, getCurrentUser, fingerprint]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// --- Custom Hook ---
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};