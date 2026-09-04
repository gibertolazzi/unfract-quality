import "./globals.css";
import React from "react";
import { ClientProviders } from "@/components/ClientProviders";
import { AppShell } from "@/components/AppShell";

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ClientProviders>
          <AppShell>
            {children}
          </AppShell>
        </ClientProviders>
      </body>
    </html>
  );
}
