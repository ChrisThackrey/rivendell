import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import ErrorBoundary from "@/components/error-boundary";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from '@vercel/analytics/react';
import { CodeFileProvider } from "../components/code-file-provider";
import ConnectionStyles from "@/components/connection-styles";
import { NavTabs } from "@/components/nav-tabs";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: "Rivendell AI Agent Platform",
  description: "AI agent platform for creating and managing AI agents",
  icons: {
    icon: [
      { url: "/favicon.ico" }
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning={true}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} antialiased relative overflow-x-hidden`}
        suppressHydrationWarning={true}
      >
        <ConnectionStyles />
        <NavTabs />
        <ErrorBoundary>
          <CodeFileProvider>
            <div className="pt-16">{children}</div>
          </CodeFileProvider>
        </ErrorBoundary>
        <Toaster />
        <Analytics />
        
        {/* Script to silence specific console warnings */}
        <Script id="silence-warnings" strategy="afterInteractive">
          {`
            // Silence specific warnings from node_modules
            if (typeof window !== 'undefined') {
              const originalWarn = console.warn;
              console.warn = function(...args) {
                if (args[0] && typeof args[0] === 'string' && 
                   (args[0].includes('unreachable code after return statement') || 
                    args[0].includes('node_modules'))) {
                  return; // Suppress the warning
                }
                originalWarn.apply(console, args);
              };
            }
          `}
        </Script>
      </body>
    </html>
  );
}
