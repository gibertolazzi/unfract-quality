import "./globals.css";
import React from "react";
import Script from "next/script";
import { ClientProviders } from "@/components/ClientProviders";
import { CookieConsentBanner } from "@/components/shared/CookieConsentBanner";
import { cookies } from "next/headers";
import { getDictionary, normalizeLocale } from "@/lib/i18n/dictionaries";
import { TranslationProvider } from "@/contexts/TranslationContext";

export const metadata = {
  title: "Unfract",
  description: "Unfract workspace and collaboration platform",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = normalizeLocale(cookieStore.get("NEXT_LOCALE")?.value);
  const dictionary = await getDictionary(locale);

  return (
    <html lang={locale}>
      <head>
        {/* Google Tag (gtag.js) con Google Consent Mode v2 per conformità GDPR */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-CDWXPHH1S8"
        />
        <Script id="google-analytics-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            var savedConsent = 'denied';
            try {
              if (localStorage.getItem('unfract_cookie_consent') === 'granted') {
                savedConsent = 'granted';
              }
            } catch (e) {}
            gtag('consent', 'default', {
              'analytics_storage': savedConsent,
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied'
            });
            gtag('js', new Date());
            gtag('config', 'G-CDWXPHH1S8', {
              page_path: window.location.pathname,
            });
          `}
        </Script>
      </head>
      <body>
        <TranslationProvider dictionary={dictionary} locale={locale}>
          <ClientProviders>
            {children}
            <CookieConsentBanner />
          </ClientProviders>
        </TranslationProvider>
      </body>
    </html>
  );
}
