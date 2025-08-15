import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ],
};

export const metadata: Metadata = {
  title: 'BillPay UK - Smart Bill Management for Everyone',
  description: 'Manage and pay all your UK bills in one secure app. Built for those excluded from traditional banking services.',
  keywords: 'bill payment, UK bills, utility payment, council tax, credit building',
  authors: [{ name: 'Chude', email: 'chude@emeke.org' }],
  creator: 'Chude',
  publisher: 'BillPay UK',
  formatDetection: {
    telephone: false,
    date: false,
    email: false,
    address: false,
  },
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-icon.png' },
      { url: '/icons/apple-icon-180x180.png', sizes: '180x180' },
    ],
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://billpay.uk',
    siteName: 'BillPay UK',
    title: 'BillPay UK - Smart Bill Management',
    description: 'Manage and pay all your UK bills in one secure app',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'BillPay UK',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'BillPay UK - Smart Bill Management',
    description: 'Manage and pay all your UK bills in one secure app',
    images: ['/twitter-image.png'],
    creator: '@billpayuk',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB" className={inter.variable} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f0fdf4',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fef2f2',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}