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
      <head>
        {/* Apply the persisted (or system) theme before first paint to avoid a
            flash of the wrong palette. Mirrors the ThemeToggle storage key. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('lams.theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
