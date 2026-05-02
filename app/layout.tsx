import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SpectroMind - AI-Powered NMR & FTIR Spectroscopy Analysis",
  description: "Advanced AI-powered tool for analyzing 1H NMR and FTIR spectroscopy data. Identify molecules from peak data using Google Gemini and OpenAI GPT models with comprehensive spectral libraries.",
  keywords: ["NMR spectroscopy", "FTIR analysis", "AI spectroscopy", "molecular identification", "chemical analysis", "peak analysis", "Gemini AI", "GPT-4"],
  authors: [{ name: "SpectroMind Team" }],
  creator: "SpectroMind",
  publisher: "SpectroMind",
  applicationName: "SpectroMind",
  metadataBase: new URL('https://spectromind.app'),

  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://spectromind.app',
    title: 'SpectroMind - AI-Powered NMR & FTIR Analysis',
    description: 'Advanced AI-powered tool for analyzing 1H NMR and FTIR spectroscopy data with comprehensive molecular libraries.',
    siteName: 'SpectroMind',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'SpectroMind - AI Spectroscopy Analysis',
    description: 'Analyze NMR and FTIR spectra with AI-powered molecular identification.',
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" dir="ltr">
      <head>
        <link rel="canonical" href="https://spectromind.app" />
        <meta name="theme-color" content="#0f172a" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
