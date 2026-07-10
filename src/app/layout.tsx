import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = {
  title: APP_NAME,
  description: `Labour and Allocation Management System — ${APP_NAME}`,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
