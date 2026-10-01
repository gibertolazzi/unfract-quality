const fs = require('fs');

let content = fs.readFileSync('app/(public)/invite/[id]/page.tsx', 'utf-8');

// Import LoginScreen
if (!content.includes('import { LoginScreen }')) {
  content = content.replace(
    "import { Loader2 } from 'lucide-react';",
    "import { Loader2 } from 'lucide-react';\nimport { LoginScreen } from '@/components/auth/LoginScreen';"
  );
}

// Modify the early return in render
content = content.replace(
  /return \(\n\s*<div className="flex h-screen w-full items-center justify-center bg-\[#0B0B0B\] text-white">/,
  `if (!user && !loading) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0B0B0B] text-white">`
);

// Remove the text saying "Effettua il login per accettare questo invito."
content = content.replace(
  /if \(!user\) \{\n\s*\/\/ Potremmo reindirizzare al login, ma per ora il sistema ha solo il popup AuthContext\.\n\s*\/\/ Assumiamo che se non c'è l'utente, non può accettare l'invito finché non accede\.\n\s*setStatus\('Effettua il login per accettare questo invito\.'\);\n\s*return;\n\s*\}/,
  `if (!user) {
      return;
    }`
);

// Remove the old HTML text
content = content.replace(
  /\{\!user && \!loading && \(\n\s*<p className="text-sm text-\[#858585\] mt-2">Torna alla home o ricarica dopo aver fatto l'accesso\.<\/p>\n\s*\)\}/,
  ""
);

fs.writeFileSync('app/(public)/invite/[id]/page.tsx', content);
