'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type AuditEvent = {
  id: string;
  actorUserId?: string | null;
  actorEmail?: string | null;
  method: string;
  route: string;
  path: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  tenantId?: string | null;
  statusCode: number;
  success: boolean;
  changes?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string;
};

type AuditSummary = {
  total24h: number;
  successful24h: number;
  failed24h: number;
  actors24h: number;
  topActions: Array<{ action: string; total: number }>;
};

const actionOptions = [
  'MERCHANT_STATUS_UPDATE',
  'MERCHANT_SETTINGS_UPDATE',
  'USER_ACCESS_UPDATE',
  'DRIVER_APPROVAL',
  'DRIVER_STATE_UPDATE',
  'BRANCH_CREATE',
  'BRANCH_UPDATE',
  'MERCHANT_STAFF_ASSIGN',
  'MERCHANT_STAFF_UPDATE',
  'CATALOG_PRODUCT_UPDATE',
  'CATALOG_CATEGORY_VISIBILITY_UPDATE',
];

const targetOptions = ['TENANT', 'USER', 'DRIVER', 'BRANCH', 'MEMBERSHIP', 'PRODUCT', 'CATEGORY'];
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AuditPage() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('ALL');
  const [targetType, setTargetType] = useState('ALL');
  const [outcome, setOutcome] = useState('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const adminFetch = useCallback(async (path: string) => {
    const response = await fetch(`/api/admin/${path}`, { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/';
      throw new Error('Admin session expired.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    return payload;
  }, []);

  const loadEvents = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (action !== 'ALL') params.set('action', action);
      if (targetType !== 'ALL') params.set('targetType', targetType);
      if (outcome === 'SUCCESS') params.set('success', 'true');
      if (outcome === 'FAILED') params.set('success', 'false');
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      params.set('limit', '200');
      const rows = await adminFetch(`audit?${params.toString()}`);
      setEvents(rows as AuditEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load audit history.');
    } finally {
      setBusy(false);
    }
  }, [action, adminFetch, from, outcome, query, targetType, to]);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [summaryRow, eventRows] = await Promise.all([adminFetch('audit/summary'), adminFetch('audit?limit=200')]);
      setSummary(summaryRow as AuditSummary);
      setEvents(eventRows as AuditEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load audit history.');
    } finally {
      setBusy(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    void (async () => {
      const session = await fetch('/api/session/me', { cache: 'no-store' });
      if (!session.ok) {
        window.location.href = '/';
        return;
      }
      await loadAll();
      setChecking(false);
    })();
  }, [loadAll]);

  const visibleActions = useMemo(() => {
    const values = new Set(actionOptions);
    events.forEach((event) => values.add(event.action));
    return [...values].sort();
  }, [events]);

  async function apply(event?: FormEvent) {
    event?.preventDefault();
    await loadEvents();
  }

  async function clear() {
    setQuery('');
    setAction('ALL');
    setTargetType('ALL');
    setOutcome('ALL');
    setFrom('');
    setTo('');
    setBusy(true);
    setError(null);
    try {
      const rows = await adminFetch('audit?limit=200');
      setEvents(rows as AuditEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load audit history.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="loading">Checking admin session…</div>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Audit Center</div></div></div>
      <nav className="nav">
        <a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a>
        <a className="btn" href="/operations" style={{ textDecoration: 'none', textAlign: 'center' }}>Operations</a>
        <a className="btn" href="/support" style={{ textDecoration: 'none', textAlign: 'center' }}>Support</a>
        <a className="btn" href="/reports" style={{ textDecoration: 'none', textAlign: 'center' }}>Reports</a>
      </nav>
      <div className="sidebar-footer"><div className="sidebar-user">Read-only history<br />Platform admin changes</div></div>
    </aside>

    <main className="content">
      <header className="topbar"><div><h1>Audit history</h1><p>Trace platform-admin changes, rejected actions and operational controls.</p></div><button className="btn" disabled={busy} onClick={() => void loadAll()}>{busy ? 'Refreshing…' : 'Refresh'}</button></header>
      {error && <div className="error">{error}</div>}

      <section className="cards">
        <article className="card stat"><div className="stat-label">Changes / attempts</div><div className="stat-value">{summary?.total24h ?? '—'}</div><div className="stat-note">Last 24 hours</div></article>
        <article className="card stat"><div className="stat-label">Successful</div><div className="stat-value">{summary?.successful24h ?? '—'}</div><div className="stat-note">Completed admin actions</div></article>
        <article className="card stat"><div className="stat-label">Rejected / failed</div><div className="stat-value">{summary?.failed24h ?? '—'}</div><div className="stat-note">Guardrails and validation</div></article>
        <article className="card stat"><div className="stat-label">Active admins</div><div className="stat-value">{summary?.actors24h ?? '—'}</div><div className="stat-note">Unique actors in 24h</div></article>
      </section>

      <section className="panel">
        <div className="panel-head" style={{ alignItems: 'flex-start' }}><div><h2>Change log</h2><p>{events.length} events shown · request secrets are redacted before storage.</p></div></div>
        <form className="panel-body" onSubmit={(e) => void apply(e)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,1.5fr) repeat(3,minmax(160px,1fr))', gap: 10 }}>
            <input className="input" style={{ minWidth: 0, width: '100%' }} placeholder="Admin, action, target ID or route" value={query} onChange={(e) => setQuery(e.target.value)} />
            <select className="select" style={{ minWidth: 0, width: '100%' }} value={action} onChange={(e) => setAction(e.target.value)}><option value="ALL">All actions</option>{visibleActions.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select>
            <select className="select" style={{ minWidth: 0, width: '100%' }} value={targetType} onChange={(e) => setTargetType(e.target.value)}><option value="ALL">All targets</option>{targetOptions.map((value) => <option key={value} value={value}>{humanize(value)}</option>)}</select>
            <select className="select" style={{ minWidth: 0, width: '100%' }} value={outcome} onChange={(e) => setOutcome(e.target.value)}><option value="ALL">All outcomes</option><option value="SUCCESS">Successful</option><option value="FAILED">Rejected / failed</option></select>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'end', marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}><label>From</label><input className="input" style={{ minWidth: 170 }} type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="field" style={{ margin: 0 }}><label>To</label><input className="input" style={{ minWidth: 170 }} type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <button className="btn primary" disabled={busy}>{busy ? 'Applying…' : 'Apply'}</button>
            <button className="btn" type="button" disabled={busy} onClick={() => void clear()}>Clear</button>
          </div>
        </form>

        {events.length === 0 ? <div className="empty">No admin changes match these filters.</div> : <div className="table-wrap"><table style={{ minWidth: 1180 }}><thead><tr><th>Time</th><th>Administrator</th><th>Action</th><th>Target</th><th>Result</th><th>Changed values</th><th></th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td><div className="cell-title">{formatDate(event.createdAt)}</div><div className="cell-sub">{event.method} · HTTP {event.statusCode}</div></td><td><div className="cell-title">{event.actorEmail || 'Platform admin'}</div><div className="cell-sub">{event.actorUserId || 'No actor ID'}</div></td><td><span className="badge active">{humanize(event.action)}</span><div className="cell-sub">{event.route}</div></td><td><div className="cell-title">{event.targetType ? humanize(event.targetType) : 'admin resource'}</div><div className="cell-sub">{event.targetId || event.tenantId || '—'}</div></td><td><span className={`badge ${event.success ? 'active' : 'rejected'}`}>{event.success ? 'success' : 'rejected'}</span></td><td><code style={{ fontSize: 12 }}>{compactChanges(event.changes)}</code></td><td><button className="btn small" onClick={() => setSelected(event)}>Details</button></td></tr>)}</tbody></table></div>}
      </section>

      {summary?.topActions?.length ? <section className="panel"><div className="panel-head"><div><h2>Most frequent actions</h2><p>Last 24 hours</p></div></div><div className="table-wrap"><table><thead><tr><th>Action</th><th>Events</th></tr></thead><tbody>{summary.topActions.map((row) => <tr key={row.action}><td>{humanize(row.action)}</td><td><strong>{row.total}</strong></td></tr>)}</tbody></table></div></section> : null}
    </main>

    {selected && <AuditDetail event={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function compactChanges(value: unknown) {
  if (!value || typeof value !== 'object') return '—';
  const text = Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${String(item)}`).join(' · ');
  return text.length > 80 ? `${text.slice(0, 77)}…` : text || '—';
}

function AuditDetail({ event, onClose }: { event: AuditEvent; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label="Audit event detail">
      <div className="modal-head"><div><div className="eyebrow">Audit event</div><h2>{humanize(event.action)}</h2><div className="modal-statuses"><span className={`badge ${event.success ? 'active' : 'rejected'}`}>{event.success ? 'successful' : 'rejected / failed'}</span><span className="badge">HTTP {event.statusCode}</span></div></div><button className="btn" onClick={onClose}>Close</button></div>
      <div className="detail-grid">
        <article className="detail-card"><div className="detail-label">Administrator</div><div className="detail-value">{event.actorEmail || 'Platform admin'}</div><div className="cell-sub">{event.actorUserId || '—'}</div></article>
        <article className="detail-card"><div className="detail-label">When</div><div className="detail-value compact">{formatDate(event.createdAt)}</div></article>
        <article className="detail-card"><div className="detail-label">Target</div><div className="detail-value">{event.targetType ? humanize(event.targetType) : 'admin resource'}</div><div className="cell-sub">{event.targetId || event.tenantId || '—'}</div></article>
        <article className="detail-card"><div className="detail-label">Source</div><div className="detail-value compact">{event.ipAddress || '—'}</div><div className="cell-sub">{event.method} {event.path}</div></article>
      </div>
      <div className="detail-section"><h3>Changed values</h3><JsonBlock value={event.changes} /></div>
      <div className="detail-section"><h3>Request context</h3><JsonBlock value={event.metadata} /></div>
      <div className="detail-section"><h3>User agent</h3><div className="settings-note" style={{ marginTop: 0, overflowWrap: 'anywhere' }}>{event.userAgent || '—'}</div></div>
      <div style={{ height: 24 }} />
    </section>
  </div>;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre style={{ margin: 0, padding: 14, border: '1px solid var(--line)', borderRadius: 12, background: '#f8faf9', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12, lineHeight: 1.5 }}>{value == null ? '—' : JSON.stringify(value, null, 2)}</pre>;
}
