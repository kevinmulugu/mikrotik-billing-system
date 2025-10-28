import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { Providers } from '@/lib/providers';
import { Toaster } from 'sonner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    template: '%s | PAY N BROWSE',
    default: 'PAY N BROWSE - WiFi Hotspot & PPPoE Management',
  },
  description: 'Monetize your internet with WiFi hotspots and PPPoE management. Generate vouchers, accept M-Pesa payments, and earn revenue.',
  keywords: ['WiFi hotspot', 'PPPoE management', 'MikroTik', 'internet monetization', 'voucher system', 'M-Pesa', 'Kenya', 'ISP billing'],
  authors: [{ name: 'PAY N BROWSE' }],
  creator: 'PAY N BROWSE',
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://paynbrowse.com',
    title: 'PAY N BROWSE - WiFi Hotspot & PPPoE Management',
    description: 'Monetize your internet with WiFi hotspots and PPPoE management. Accept M-Pesa payments and earn revenue.',
    siteName: 'PAY N BROWSE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PAY N BROWSE - WiFi Hotspot & PPPoE Management',
    description: 'Monetize your internet with WiFi hotspots and PPPoE management',
    creator: '@paynbrowse',
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
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers session={session}>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            expand={false}
            toastOptions={{
              duration: 4000,
              classNames: {
                toast: 'border shadow-lg',
                title: 'text-sm font-semibold',
                description: 'text-sm',
                actionButton: 'bg-primary text-primary-foreground',
                cancelButton: 'bg-muted text-muted-foreground',
                closeButton: 'bg-background border',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}