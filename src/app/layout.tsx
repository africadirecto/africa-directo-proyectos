import type { Metadata, Viewport } from 'next';
import { Quicksand } from 'next/font/google';
import './globals.css';

const quicksand = Quicksand({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--fuente' });

export const metadata: Metadata = {
  title: { default: 'Proyectos · Africa Directo', template: '%s · Africa Directo' },
  description: 'Gestión de proyectos de Africa Directo',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#E54611' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={quicksand.variable}>
      <body>{children}</body>
    </html>
  );
}
