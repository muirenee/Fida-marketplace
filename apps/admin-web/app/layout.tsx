import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fida Marketplace Control Center',
  description: 'Fida Marketplace platform administration',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
