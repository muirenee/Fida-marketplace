'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type CurrencySummary = {
  currency: string;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  failedOrders: number;
  refundedOrders: number;
  paidValue: number;
  pendingValue: number;
  refundedValue: number;
};

type MerchantSummary = {
  tenantId: string;
  merchant: string;
  status: string;
  currency: string;
  orders: number;
  paidOrders: number;
  pendingOrders: number;
  paidValue: number;
  pendingValue: number;
};

type PaymentGroup = {
  tenantId: string;
  merchant: string;
  currency: string;
  paymentMethod: string;
  paymentStatus: string;
  orders: number;
  value: number;
};

type FinanceSummary = {
  currencies: CurrencySummary[];
  merchants: MerchantSummary[];
  paymentGroups: PaymentGroup[];
};

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const formatMoney = (value: string | number, currency = 'RWF') => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'RWF' ? 0 : 2,
  }).format(amount);
};

export default function FinancePage() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinanceSummary>({ currencies: [], merchants: [], paymentGroups: [] });
  const [currencyFilter, setCurrencyFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [methodFilter, setMethodFilter] = useState('ALL');

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

  const loadFinance = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = await adminFetch('finance/summary');
      setSummary(payload as FinanceSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load finance summary.');
    } finally {
      setBusy(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/session/me', { cache: 'no-store' });
        if (!response.ok) {
          window.location.href = '/';
          return;
        }
        await loadFinance();
      } finally {
        setChecking(false);
      }
    })();
  }, [loadFinance]);

  const currencies = useMemo(() => summary.currencies.map((row) => row.currency), [summary.currencies]);
  const methods = useMemo(() => [...new Set(summary.paymentGroups.map((row) => row.paymentMethod))].sort(), [summary.paymentGroups]);
  const statuses = useMemo(() => [...new Set(summary.paymentGroups.map((row) => row.paymentStatus))].sort(), [summary.paymentGroups]);

  const merchantRows = useMemo(
    () => summary.merchants.filter((row) => currencyFilter === 'ALL' || row.currency === currencyFilter),
    [currencyFilter, summary.merchants],
  );

  const paymentRows = useMemo(
    () => summary.paymentGroups.filter((row) => {
      if (currencyFilter !== 'ALL' && row.currency !== currencyFilter) return false;
      if (statusFilter !== 'ALL' && row.paymentStatus !== statusFilter) return false;
      if (methodFilter !== 'ALL' && row.paymentMethod !== methodFilter) return false;
      return true;
    }),
    [currencyFilter, methodFilter, statusFilter, summary.paymentGroups],
  );

  if (checking) return <div className="loading">Checking admin session…</div>;

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Finance Center</div></div></div>
        <nav className="nav">
          <a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a>
          <a className="btn" href="/operations" style={{ textDecoration: 'none', textAlign: 'center' }}>Operations</a>
          <a className="btn" href="/provisioning" style={{ textDecoration: 'none', textAlign: 'center' }}>Provisioning</a>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><h1>Finance</h1><p>Read-only marketplace payment and settlement visibility.</p></div>
          <div className="actions"><button className="btn" disabled={busy} onClick={() => void loadFinance()}>{busy ? 'Refreshing…' : 'Refresh'}</button></div>
        </header>
        {error && <div className="error">{error}</div>}

        <section className="panel">
          <div className="panel-head"><div><h2>Currency summaries</h2><p>Values stay separated by currency to avoid misleading cross-currency totals.</p></div></div>
          {summary.currencies.length === 0 ? <div className="empty">No marketplace payments yet.</div> : (
            <div className="cards panel-body">
              {summary.currencies.map((row) => (
                <article className="card stat" key={row.currency}>
                  <div className="stat-label">{row.currency} paid value</div>
                  <div className="stat-value">{formatMoney(row.paidValue, row.currency)}</div>
                  <div className="stat-note">{row.paidOrders} paid · {row.pendingOrders} pending · {row.orders} total orders</div>
                  <div className="stat-note">Pending {formatMoney(row.pendingValue, row.currency)} · Refunded {formatMoney(row.refundedValue, row.currency)}</div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Merchant payment position</h2><p>{merchantRows.length} merchants shown</p></div>
            <div className="toolbar"><select className="select" value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}><option value="ALL">All currencies</option>{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></div>
          </div>
          {merchantRows.length === 0 ? <div className="empty">No merchant payment data matches this currency.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Status</th><th>Currency</th><th>Orders</th><th>Paid orders</th><th>Pending orders</th><th>Paid value</th><th>Pending value</th></tr></thead><tbody>{merchantRows.map((row) => <tr key={row.tenantId}><td><div className="cell-title">{row.merchant}</div></td><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.currency}</td><td>{row.orders}</td><td>{row.paidOrders}</td><td>{row.pendingOrders}</td><td><strong>{formatMoney(row.paidValue, row.currency)}</strong></td><td>{formatMoney(row.pendingValue, row.currency)}</td></tr>)}</tbody></table></div>}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Payment breakdown</h2><p>{paymentRows.length} grouped payment positions</p></div>
            <div className="toolbar">
              <select className="select" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}><option value="ALL">All methods</option>{methods.map((method) => <option key={method}>{method}</option>)}</select>
              <select className="select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
              <button className="btn" type="button" onClick={() => { setCurrencyFilter('ALL'); setMethodFilter('ALL'); setStatusFilter('ALL'); }}>Clear filters</button>
            </div>
          </div>
          {paymentRows.length === 0 ? <div className="empty">No payment groups match these filters.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Method</th><th>Payment status</th><th>Orders</th><th>Value</th></tr></thead><tbody>{paymentRows.map((row) => <tr key={`${row.tenantId}-${row.paymentMethod}-${row.paymentStatus}`}><td><div className="cell-title">{row.merchant}</div><div className="cell-sub">{row.currency}</div></td><td>{humanize(row.paymentMethod)}</td><td><span className={statusClass(row.paymentStatus)}>{humanize(row.paymentStatus)}</span></td><td>{row.orders}</td><td><strong>{formatMoney(row.value, row.currency)}</strong></td></tr>)}</tbody></table></div>}
        </section>

        <div className="settings-note">Finance is intentionally read-only in this batch. Payment status changes continue to follow the order and delivery workflows rather than manual Admin overrides.</div>
      </main>
    </div>
  );
}
