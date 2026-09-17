'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const tools = [
  { href: '/operations', label: 'Operations' },
  { href: '/insights', label: 'Insights' },
  { href: '/provisioning', label: 'Provisioning' },
  { href: '/finance', label: 'Finance' },
  { href: '/support', label: 'Support' },
  { href: '/reports', label: 'Reports' },
  { href: '/audit', label: 'Audit' },
];

export default function AdminOperationsLauncher() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
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

  const availableTools = tools.filter((tool) => tool.href !== pathname);
  if (availableTools.length === 0) return null;

  return (
    <div style={{ position: 'fixed', right: 20, bottom: 84, zIndex: 60, display: 'grid', justifyItems: 'end', gap: 8 }}>
      {open && (
        <div style={{ display: 'grid', gap: 6, minWidth: 175, padding: 8, background: 'white', border: '1px solid var(--line)', borderRadius: 14, boxShadow: '0 12px 32px rgba(0,0,0,.16)' }}>
          {availableTools.map((tool) => <a key={tool.href} href={tool.href} className="btn" style={{ textDecoration: 'none', textAlign: 'left' }}>{tool.label}</a>)}
        </div>
      )}
      <button type="button" className="btn primary" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Open admin tools" style={{ boxShadow: '0 10px 28px rgba(0,0,0,.18)' }}>Admin tools</button>
    </div>
  );
}
