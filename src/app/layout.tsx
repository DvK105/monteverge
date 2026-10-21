// For adding custom fonts with other frameworks, see:
// https://tailwindcss.com/docs/font-family
import type { Metadata } from "next";
import { Lexend, Playfair_Display, Source_Code_Pro } from "next/font/google";
import "./index.css";
import "./design-system.css";
import "katex/dist/katex.min.css";

const fontSans = Lexend({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "MonteVerge | Tata Group Quantitative Research",
  description: "Stochastic mean-reversion research across Tata Group equities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} min-h-dvh bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
