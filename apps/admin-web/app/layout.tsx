import type { Metadata } from 'next';
import AdminOperationsLauncher from './admin-operations-launcher';
import './globals.css';
import './polish.css';

export const metadata: Metadata = {
  title: 'Fida Marketplace Control Center',
  description: 'Fida Marketplace platform administration',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <AdminOperationsLauncher />
      </body>
    </html>
  );
}
