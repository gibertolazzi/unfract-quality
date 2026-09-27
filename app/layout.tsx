import "./globals.css";
import React from "react";
import { ClientProviders } from "@/components/ClientProviders";

export const metadata = {
  title: "Unfract MVP",
  description: "Unfract MVP Application",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
