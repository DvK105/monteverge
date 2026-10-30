import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monteverge",
  description: "Monteverge market intelligence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased font-sans`}>
      <body className="m-0 min-h-svh w-full overflow-x-hidden select-none">{children}</body>
    </html>
  );
}
