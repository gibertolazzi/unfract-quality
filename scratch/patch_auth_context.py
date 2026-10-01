import re

with open('contexts/AuthContext.tsx', 'r') as f:
    content = f.read()

# Add new imports
content = content.replace(
    "import { auth, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';",
    "import { auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@/lib/firebase';"
)

# Add new types to the AuthContextType interface
old_interface = """  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;"""
new_interface = """  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (e: string, p: string) => Promise<void>;
  registerWithEmail: (e: string, p: string, name: string) => Promise<void>;
  resetPassword: (e: string) => Promise<void>;
  logout: () => Promise<void>;"""
content = content.replace(old_interface, new_interface)

# Add default values
old_defaults = """  loginWithGoogle: async () => {},
  logout: async () => {},"""
new_defaults = """  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  registerWithEmail: async () => {},
  resetPassword: async () => {},
  logout: async () => {},"""
content = content.replace(old_defaults, new_defaults)

# Add the actual functions
old_funcs = "  const loginWithGoogle = async () => {"
new_funcs = """  const loginWithEmail = async (email: string, password: string) => {
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

  const loginWithGoogle = async () => {"""
content = content.replace(old_funcs, new_funcs)

# Export them in the provider
old_provider = "<AuthContext.Provider value={{ user, settings, loading, loginWithGoogle, logout, accessToken, updateSettings }}>"
new_provider = "<AuthContext.Provider value={{ user, settings, loading, loginWithGoogle, loginWithEmail, registerWithEmail, resetPassword, logout, accessToken, updateSettings }}>"
content = content.replace(old_provider, new_provider)

with open('contexts/AuthContext.tsx', 'w') as f:
    f.write(content)

print("AuthContext patched")
