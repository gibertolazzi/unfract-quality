import re

with open('contexts/AuthContext.tsx', 'r') as f:
    content = f.read()

# Fix imports
content = content.replace(
    "import { auth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from '@/lib/firebase';",
    "import { auth, GoogleAuthProvider, signInWithPopup } from '@/lib/firebase';"
)

content = content.replace(
    "import { onAuthStateChanged, User, signOut } from 'firebase/auth';",
    "import { onAuthStateChanged, User, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';"
)

with open('contexts/AuthContext.tsx', 'w') as f:
    f.write(content)

print("Imports fixed")
