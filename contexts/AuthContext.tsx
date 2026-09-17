'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UserSettings {
  timezone: string;
  language: string;
  emailAssignee: boolean;
  emailRequester: boolean;
  emailChanges: boolean;
  emailMentioned: boolean;
  groupFrequency: string;
  defaultMeetingLink?: string;
}

interface AuthContextType {
  user: User | null;
  settings: UserSettings | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  accessToken: string | null;
  updateSettings: (newSettings: Partial<UserSettings>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  settings: null,
  loading: true,
  loginWithGoogle: async () => {},
  logout: async () => {},
  accessToken: null,
  updateSettings: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Fetch the stored token and settings if needed from DB
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setAccessToken(data.calendarToken || null);
          setSettings(data.settings || {
            timezone: 'Europe/Rome',
            language: 'it',
            emailAssignee: true,
            emailRequester: false,
            emailChanges: false,
            emailMentioned: true,
            groupFrequency: '3min',
            defaultMeetingLink: data.settings?.defaultMeetingLink || ''
          });
        } else {
          setSettings({
            timezone: 'Europe/Rome',
            language: 'it',
            emailAssignee: true,
            emailRequester: false,
            emailChanges: false,
            emailMentioned: true,
            groupFrequency: '3min'
          });
        }
      } else {
        setAccessToken(null);
        setSettings(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      // We must request the calendar scope to manipulate events
      provider.addScope('https://www.googleapis.com/auth/calendar');
      
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      
      if (token) {
        setAccessToken(token);
        // Store the token in Firestore so we can use it on the public booking page!
        await setDoc(doc(db, 'users', result.user.uid), {
          email: result.user.email,
          displayName: result.user.displayName,
          photoURL: result.user.photoURL,
          calendarToken: token,
          lastLogin: new Date().toISOString()
        }, { merge: true });
      }
      
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user || !settings) return;
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    await setDoc(doc(db, 'users', user.uid), { settings: updatedSettings }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{ user, settings, loading, loginWithGoogle, logout, accessToken, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}
