import "./globals.css";
import React from "react";
import { ClientProviders } from "@/components/ClientProviders";
import { cookies } from "next/headers";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { TranslationProvider } from "@/contexts/TranslationContext";

export const metadata = {
  title: "Unfract",
  description: "Unfract workspace and collaboration platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const locale = cookieStore.get("NEXT_LOCALE")?.value || "it";
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale}>
      <body>
        <TranslationProvider dictionary={dictionary} locale={locale}>
          <ClientProviders>
            {children}
          </ClientProviders>
        </TranslationProvider>
      </body>
    </html>
  );
}
