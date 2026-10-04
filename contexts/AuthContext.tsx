'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { auth, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserSettings {
  timezone: string;
  language: string;
  emailAssignee: boolean;
  emailRequester: boolean;
  emailChanges: boolean;
  emailMentioned: boolean;
  emailMessages: boolean;
  groupFrequency: string;
  defaultMeetingLink?: string;
}

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  loading: boolean;
  googleError: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  registerWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;
  accessToken: string | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  settings: null,
  loading: true,
  googleError: null,
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  resetPassword: async () => {},
  logout: async () => {},
  accessToken: null,
  updateSettings: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const settingsRef = useRef<UserSettings | null>(settings);
  settingsRef.current = settings;
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!isMounted) return;
      setUser(currentUser);

      try {
        if (currentUser) {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (!isMounted) return;
          if (userDoc.exists()) {
            const data = userDoc.data();
            setAccessToken(data.calendarToken || null);
            setSettings({
              timezone: 'Europe/Rome',
              language: 'it',
              emailAssignee: true,
              emailRequester: false,
              emailChanges: false,
              emailMentioned: true,
              emailMessages: false,
              groupFrequency: '3min',
              defaultMeetingLink: '',
              ...(data.settings || {}),
            });
          } else {
            setAccessToken(null);
            setSettings({
              timezone: 'Europe/Rome',
              language: 'it',
              emailAssignee: true,
              emailRequester: false,
              emailChanges: false,
              emailMentioned: true,
              emailMessages: false,
              groupFrequency: '3min',
            });
          }
        } else {
          setAccessToken(null);
          setSettings(null);
        }
      } catch (error) {
        console.error('Unable to load user settings:', error);
        if (isMounted && currentUser) {
          setAccessToken(null);
          setSettings({
            timezone: 'Europe/Rome',
            language: 'it',
            emailAssignee: true,
            emailRequester: false,
            emailChanges: false,
            emailMentioned: true,
            emailMessages: false,
            groupFrequency: '3min',
          });
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    getRedirectResult(auth).then(async (result) => {
      if (!result || !isMounted) return;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (!token) return;
      setAccessToken(token);
      try {
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          calendarToken: token,
          lastLogin: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error('Unable to save Google Calendar token:', error);
      }
    }).catch((error) => {
      console.error('Error completing Google sign-in:', error);
      if (isMounted) setGoogleError(error instanceof Error ? error.message : 'Accesso con Google non riuscito. Riprova.');
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in with email", error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      // Aggiorniamo subito il nome nel documento utente
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(userRef, {
        displayName: name,
        email: email,
        photoURL: null,
        plan: 'free', // Predisposizione per la fase 2
        createdAt: new Date(),
      }, { merge: true });
    } catch (error) {
      console.error("Error registering with email", error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error resetting password", error);
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    setGoogleError(null);
    try {
      const provider = new GoogleAuthProvider();
      // We must request the calendar scope to manipulate events
      provider.addScope('https://www.googleapis.com/auth/calendar');

      const isMobile = typeof window !== 'undefined' && (
        /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        window.matchMedia('(max-width: 767px)').matches
      );

      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return;
      }
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setAccessToken(token);
        try {
          // Store the token in Firestore so we can use it on the public booking page!
          await setDoc(doc(db, 'users', result.user.uid), {
            email: result.user.email,
            displayName: result.user.displayName,
            photoURL: result.user.photoURL,
            calendarToken: token,
            lastLogin: new Date().toISOString()
          }, { merge: true });
        } catch (error) {
          console.error('Unable to save Google Calendar token:', error);
        }
      }
      
    } catch (error) {
      console.error("Error signing in with Google", error);
      setGoogleError(error instanceof Error ? error.message : 'Accesso con Google non riuscito. Riprova.');
      throw error;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    const currentSettings = settingsRef.current;
    if (!user || !currentSettings) return;
    const updatedSettings = { ...currentSettings, ...newSettings };
    settingsRef.current = updatedSettings;
    setSettings(updatedSettings);
    await setDoc(doc(db, 'users', user.uid), { settings: updatedSettings }, { merge: true });
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, settings, loading, googleError, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout, accessToken, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}
