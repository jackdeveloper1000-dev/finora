import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setAccessToken, setAuthFailureHandler, refreshSession } from '../api/http';
import { authApi } from '../api/services';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const startSession = useCallback(({ user: nextUser, accessToken }) => {
    setAccessToken(accessToken);
    setUser(nextUser);
    return nextUser;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthFailureHandler(clearSession);
    refreshSession()
      .then(startSession)
      .catch(clearSession)
      .finally(() => setBooting(false));
  }, [startSession, clearSession]);

  const value = useMemo(
    () => ({
      user,
      booting,
      // Resolves to { mfaRequired, mfaToken } when a second step is needed, otherwise signs in.
      login: async (payload) => {
        const data = await authApi.login(payload);
        return data.mfaRequired ? data : startSession(data);
      },
      loginWithGoogle: async (credential) => {
        const data = await authApi.google(credential);
        return data.mfaRequired ? data : startSession(data);
      },
      verifyMfa: async (payload) => startSession(await authApi.verifyMfa(payload)),
      // Registration no longer signs the user in; the emailed code does.
      register: (payload) => authApi.register(payload),
      verifyEmail: async (payload) => startSession(await authApi.verifyEmail(payload)),
      updateUser: (changes) => setUser((current) => (current ? { ...current, ...changes } : current)),
      logout: async () => {
        await authApi.logout().catch(() => {});
        clearSession();
      },
      logoutAll: async () => {
        await authApi.logoutAll();
        clearSession();
      },
      endSession: clearSession,
    }),
    [user, booting, startSession, clearSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
