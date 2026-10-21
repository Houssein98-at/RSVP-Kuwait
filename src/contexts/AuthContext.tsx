import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  type User,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../services/firebase';
import { checkAdminAllowlist } from '../services/firestore';
import type { AdminUser } from '../types';

interface AuthContextType {
  user: User | null;
  adminUser: AdminUser | null;
  loading: boolean;
  isConfigured: boolean;
  error: string | null;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      setError(null);

      if (!currentUser) {
        setUser(null);
        setAdminUser(null);
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        // Verify UID strictly against the admin allowlist in Firestore
        const adminData = await checkAdminAllowlist(currentUser.uid);

        if (adminData) {
          setAdminUser(adminData);
        } else {
          // User authenticated with Firebase, but NOT in allowlist
          setAdminUser(null);
          setError('حسابك غير مسجل ضمن قائمة المسؤولين المعتمدين لهذا الحفل (Account not in admin allowlist)');
          // Automatically sign out non-admin accounts to prevent unauthorized access
          if (auth) {
            await fbSignOut(auth);
          }
          setUser(null);
        }
      } catch (err: unknown) {
        console.error('Error during admin verification:', err);
        setError('تعذر التحقق من صلاحيات المسؤول. يرجى إعادة المحاولة.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    if (!auth) {
      throw new Error('Firebase credentials are not configured. Check .env file.');
    }
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
      const adminData = await checkAdminAllowlist(cred.user.uid);

      if (!adminData) {
        await fbSignOut(auth);
        setUser(null);
        setAdminUser(null);
        throw new Error('حسابك غير مسجل ضمن قائمة المسؤولين المعتمدين لهذا الحفل.');
      } else {
        setAdminUser(adminData);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Login error:', msg);
      if (
        msg.includes('auth/invalid-credential') ||
        msg.includes('auth/wrong-password') ||
        msg.includes('auth/user-not-found')
      ) {
        setError('بيانات الدخول غير صحيحة. يرجى التحقق من البريد الإلكتروني وكلمة المرور.');
      } else {
        setError(msg);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    if (auth) {
      await fbSignOut(auth);
    }
    setUser(null);
    setAdminUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        adminUser,
        loading,
        isConfigured: isFirebaseConfigured,
        error,
        login,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
