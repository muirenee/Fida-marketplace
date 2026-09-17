'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export default function AdminOperationsLauncher() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (pathname === '/operations') {
      setVisible(false);
      return;
    }

    let active = true;
    void fetch('/api/session/me', { cache: 'no-store' })
      .then((response) => {
        if (active) setVisible(response.ok);
      })
      .catch(() => {
        if (active) setVisible(false);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  if (!visible) return null;

  return (
    <a
      href="/operations"
      className="btn primary"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 84,
        zIndex: 60,
        textDecoration: 'none',
        boxShadow: '0 10px 28px rgba(0,0,0,.18)',
      }}
    >
      Operations
    </a>
  );
}
