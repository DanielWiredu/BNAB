import type { Metadata } from "next";

import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "GDLC LAMS",
  description: "Labour and Allocation Management System — Ghana Dockyard Labour Company",
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
