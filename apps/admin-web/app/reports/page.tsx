'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Tenant = { id: string; name: string; status: string; currency: string };
type StatusRow = { status: string; total: number };
type CurrencyRow = {
  currency: string;
  orders: number;
  completedOrders: number;
  paidOrders: number;
  paidValue: number;
  serviceFeesPaid: number;
  deliveryFeesPaid: number;
};
type MerchantRow = {
  tenantId: string;
  merchant: string;
  status: string;
  currency: string;
  orders: number;
  completedOrders: number;
  paidOrders: number;
  paidValue: number;
  serviceFeesPaid: number;
  deliveryFeesPaid: number;
};
type DailyRow = {
  date: string;
  currency: string;
  orders: number;
  completedOrders: number;
  paidOrders: number;
  paidValue: number;
};
type Report = {
  period: { from: string; to: string; days: number };
  orders: number;
  orderStatuses: StatusRow[];
  paymentStatuses: StatusRow[];
  currencies: CurrencyRow[];
  merchants: MerchantRow[];
  daily: DailyRow[];
};

const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const formatMoney = (value: string | number, currency = 'RWF') => new Intl.NumberFormat('en-RW', {
  style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2,
}).format(Number(value ?? 0));
const inputDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const defaultDates = () => {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);
  return { from: inputDate(from), to: inputDate(to) };
};

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<unknown>>) {
  const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const defaults = useMemo(defaultDates, []);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [tenantId, setTenantId] = useState('ALL');

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

  const loadReport = useCallback(async (nextFrom: string, nextTo: string, nextTenantId: string) => {
    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({ from: nextFrom, to: nextTo });
      if (nextTenantId !== 'ALL') params.set('tenantId', nextTenantId);
      setReport(await adminFetch(`reports/overview?${params.toString()}`) as Report);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load report.');
    } finally {
      setBusy(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/session/me', { cache: 'no-store' });
      if (!response.ok) {
        window.location.href = '/';
        return;
      }
      try {
        const tenantRows = await adminFetch('tenants');
        setTenants((tenantRows as Tenant[]).map((tenant) => ({ id: tenant.id, name: tenant.name, status: tenant.status, currency: tenant.currency })));
        await loadReport(defaults.from, defaults.to, 'ALL');
      } finally {
        setChecking(false);
      }
    })();
  }, [adminFetch, defaults.from, defaults.to, loadReport]);

  async function apply(event: FormEvent) {
    event.preventDefault();
    await loadReport(from, to, tenantId);
  }

  function exportMerchants() {
    if (!report) return;
    downloadCsv(
      `fida-merchant-report-${from}-to-${to}.csv`,
      ['Merchant', 'Status', 'Currency', 'Orders', 'Completed orders', 'Paid orders', 'Paid value', 'Paid service fees', 'Paid delivery fees'],
      report.merchants.map((row) => [row.merchant, row.status, row.currency, row.orders, row.completedOrders, row.paidOrders, row.paidValue, row.serviceFeesPaid, row.deliveryFeesPaid]),
    );
  }

  function exportDaily() {
    if (!report) return;
    downloadCsv(
      `fida-daily-report-${from}-to-${to}.csv`,
      ['Date', 'Currency', 'Orders', 'Completed orders', 'Paid orders', 'Paid value'],
      report.daily.map((row) => [row.date, row.currency, row.orders, row.completedOrders, row.paidOrders, row.paidValue]),
    );
  }

  if (checking) return <div className="loading">Checking admin session…</div>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Reports Center</div></div></div>
      <nav className="nav"><a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a><a className="btn" href="/finance" style={{ textDecoration: 'none', textAlign: 'center' }}>Finance</a><a className="btn" href="/support" style={{ textDecoration: 'none', textAlign: 'center' }}>Support</a></nav>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>Reports</h1><p>Marketplace activity and paid-value reporting by period, merchant and currency.</p></div><div className="actions"><button className="btn" disabled={!report || busy} onClick={exportMerchants}>Export merchants CSV</button><button className="btn" disabled={!report || busy} onClick={exportDaily}>Export daily CSV</button></div></header>
      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Report period</h2><p>Up to 93 days per report.</p></div><form className="toolbar" onSubmit={(e) => void apply(e)}><input className="input" type="date" required value={from} onChange={(e) => setFrom(e.target.value)} /><input className="input" type="date" required value={to} onChange={(e) => setTo(e.target.value)} /><select className="select" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="ALL">All merchants</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><button className="btn primary" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</button></form></div>
        {report && <div className="panel-body"><div className="cell-sub">{report.orders} orders · {report.period.days} day{report.period.days === 1 ? '' : 's'} · values remain separated by currency</div></div>}
      </section>

      {report && <>
        <section className="cards">
          {report.currencies.map((row) => <article className="card stat" key={row.currency}><div className="stat-label">{row.currency} paid value</div><div className="stat-value">{formatMoney(row.paidValue, row.currency)}</div><div className="stat-note">{row.orders} orders · {row.completedOrders} completed · {row.paidOrders} paid</div><div className="stat-note">Service fees {formatMoney(row.serviceFeesPaid, row.currency)} · Delivery fees {formatMoney(row.deliveryFeesPaid, row.currency)}</div></article>)}
          {report.currencies.length === 0 && <article className="card stat"><div className="stat-label">Orders</div><div className="stat-value">0</div><div className="stat-note">No orders in this period</div></article>}
        </section>

        <section className="panel"><div className="panel-head"><div><h2>Merchant performance</h2><p>{report.merchants.length} merchants with orders in this period</p></div></div>{report.merchants.length === 0 ? <div className="empty">No merchant activity in this period.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Status</th><th>Currency</th><th>Orders</th><th>Completed</th><th>Paid</th><th>Paid value</th><th>Service fees</th><th>Delivery fees</th></tr></thead><tbody>{report.merchants.map((row) => <tr key={row.tenantId}><td><div className="cell-title">{row.merchant}</div></td><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.currency}</td><td>{row.orders}</td><td>{row.completedOrders}</td><td>{row.paidOrders}</td><td><strong>{formatMoney(row.paidValue, row.currency)}</strong></td><td>{formatMoney(row.serviceFeesPaid, row.currency)}</td><td>{formatMoney(row.deliveryFeesPaid, row.currency)}</td></tr>)}</tbody></table></div>}</section>

        <section className="panel"><div className="panel-head"><div><h2>Daily activity</h2><p>Order creation date, separated by currency.</p></div></div>{report.daily.length === 0 ? <div className="empty">No daily activity in this period.</div> : <div className="table-wrap"><table><thead><tr><th>Date</th><th>Currency</th><th>Orders</th><th>Completed</th><th>Paid</th><th>Paid value</th></tr></thead><tbody>{report.daily.map((row) => <tr key={`${row.date}-${row.currency}`}><td>{row.date}</td><td>{row.currency}</td><td>{row.orders}</td><td>{row.completedOrders}</td><td>{row.paidOrders}</td><td><strong>{formatMoney(row.paidValue, row.currency)}</strong></td></tr>)}</tbody></table></div>}</section>

        <div className="detail-grid two" style={{ padding: 0 }}>
          <section className="panel"><div className="panel-head"><div><h2>Order statuses</h2></div></div>{report.orderStatuses.length === 0 ? <div className="empty">No order statuses.</div> : <div className="table-wrap"><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>{report.orderStatuses.map((row) => <tr key={row.status}><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.total}</td></tr>)}</tbody></table></div>}</section>
          <section className="panel"><div className="panel-head"><div><h2>Payment statuses</h2></div></div>{report.paymentStatuses.length === 0 ? <div className="empty">No payment statuses.</div> : <div className="table-wrap"><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>{report.paymentStatuses.map((row) => <tr key={row.status}><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.total}</td></tr>)}</tbody></table></div>}</section>
        </div>
      </>}
    </main>
  </div>;
}
