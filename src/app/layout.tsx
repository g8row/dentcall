import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { LanguageProvider } from "@/lib/translations";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DentCall - Cold Calling Management",
  description: "Internal tool for managing dentist cold calling campaigns",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
