'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';

type SupportUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isPlatformAdmin: boolean;
  emailVerifiedAt?: string | null;
  phoneVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  _count?: { customerOrders: number; memberships: number; addresses: number };
  driver?: { id: string; isOnline: boolean; isAvailable: boolean; lastSeenAt?: string | null } | null;
};

type UserDetail = SupportUser & {
  updatedAt: string;
  addresses: Array<{
    id: string;
    label?: string | null;
    addressLine: string;
    city?: string | null;
    instructions?: string | null;
    isDefault: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  memberships: Array<{
    id: string;
    role: string;
    createdAt: string;
    tenant: { id: string; name: string; status: string; merchantType: string };
    branch?: { id: string; name: string; city?: string | null; isActive: boolean } | null;
  }>;
  driver?: {
    id: string;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeenAt?: string | null;
    _count?: { deliveries: number };
  } | null;
  customerOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    total: string | number;
    deliveryAddress?: string | null;
    createdAt: string;
    tenant: { id: string; name: string; currency: string };
    branch: { id: string; name: string; city?: string | null };
    delivery?: {
      status: string;
      deliveredAt?: string | null;
      driver?: { user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } } | null;
    } | null;
    _count?: { items: number };
  }>;
};

const displayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Unnamed user';
};
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
const formatMoney = (value: string | number, currency = 'RWF') => new Intl.NumberFormat('en-RW', {
  style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2,
}).format(Number(value ?? 0));

export default function SupportPage() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SupportUser[]>([]);
  const [selected, setSelected] = useState<UserDetail | null>(null);

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

  const searchUsers = useCallback(async (search = '') => {
    setBusy(true);
    setError(null);
    try {
      const rows = await adminFetch(`support/users${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
      setUsers(rows as SupportUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to search users.');
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
      await searchUsers();
      setChecking(false);
    })();
  }, [searchUsers]);

  async function submitSearch(event: FormEvent) {
    event.preventDefault();
    await searchUsers(query);
  }

  async function openUser(userId: string) {
    setDetailBusy(true);
    setError(null);
    try {
      setSelected(await adminFetch(`support/users/${userId}`) as UserDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load user details.');
    } finally {
      setDetailBusy(false);
    }
  }

  if (checking) return <div className="loading">Checking admin session…</div>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Support Center</div></div></div>
      <nav className="nav"><a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a><a className="btn" href="/operations" style={{ textDecoration: 'none', textAlign: 'center' }}>Operations</a><a className="btn" href="/reports" style={{ textDecoration: 'none', textAlign: 'center' }}>Reports</a></nav>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>Support</h1><p>Look up customer, merchant-staff and driver account context from one place.</p></div><button className="btn" disabled={busy} onClick={() => void searchUsers(query)}>{busy ? 'Refreshing…' : 'Refresh'}</button></header>
      {error && <div className="error">{error}</div>}
      <section className="panel">
        <div className="panel-head"><div><h2>User lookup</h2><p>{users.length} shown</p></div><form className="toolbar" onSubmit={(e) => void submitSearch(e)}><input className="input" placeholder="Name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn primary" disabled={busy}>Search</button><button className="btn" type="button" disabled={busy} onClick={() => { setQuery(''); void searchUsers(''); }}>Clear</button></form></div>
        {users.length === 0 ? <div className="empty">No users found.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Account</th><th>Orders</th><th>Merchant roles</th><th>Addresses</th><th>Driver</th><th>Last login</th><th></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="cell-title">{displayName(user)}</div><div className="cell-sub">{user.email || user.phone || user.id}</div></td><td><span className={statusClass(user.isActive ? 'active' : 'inactive')}>{user.isPlatformAdmin ? 'platform admin' : user.isActive ? 'active' : 'disabled'}</span></td><td>{user._count?.customerOrders ?? 0}</td><td>{user._count?.memberships ?? 0}</td><td>{user._count?.addresses ?? 0}</td><td>{user.driver ? <span className={statusClass(user.driver.isOnline ? 'active' : 'pending')}>{user.driver.isOnline ? 'online' : 'approved'}</span> : '—'}</td><td>{formatDate(user.lastLoginAt)}</td><td><button className="btn small" disabled={detailBusy} onClick={() => void openUser(user.id)}>View</button></td></tr>)}</tbody></table></div>}
      </section>
    </main>
    {selected && <UserDetailModal user={selected} onClose={() => setSelected(null)} />}
  </div>;
}

function UserDetailModal({ user, onClose }: { user: UserDetail; onClose: () => void }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-label={`Support details for ${displayName(user)}`}>
      <div className="modal-head"><div><div className="eyebrow">Support account detail</div><h2>{displayName(user)}</h2><div className="modal-statuses"><span className={statusClass(user.isActive ? 'active' : 'inactive')}>{user.isActive ? 'active' : 'disabled'}</span>{user.isPlatformAdmin && <span className={statusClass('active')}>platform admin</span>}{user.driver && <span className={statusClass(user.driver.isOnline ? 'active' : 'pending')}>{user.driver.isOnline ? 'driver online' : 'driver approved'}</span>}</div></div><button className="btn" onClick={onClose}>Close</button></div>

      <div className="detail-grid">
        <article className="detail-card"><div className="detail-label">Contact</div><div className="detail-value">{user.email || user.phone || 'No contact'}</div><div className="cell-sub">Email {user.emailVerifiedAt ? 'verified' : 'not verified'} · Phone {user.phoneVerifiedAt ? 'verified' : 'not verified'}</div></article>
        <article className="detail-card"><div className="detail-label">Account created</div><div className="detail-value compact">{formatDate(user.createdAt)}</div></article>
        <article className="detail-card"><div className="detail-label">Last login</div><div className="detail-value compact">{formatDate(user.lastLoginAt)}</div></article>
        <article className="detail-card"><div className="detail-label">Driver</div><div className="detail-value">{user.driver ? `${user.driver._count?.deliveries ?? 0} deliveries` : 'Not a driver'}</div>{user.driver && <div className="cell-sub">{user.driver.isAvailable ? 'available' : 'not available'} · seen {formatDate(user.driver.lastSeenAt)}</div>}</article>
      </div>

      <div className="detail-section"><h3>Addresses</h3>{user.addresses.length === 0 ? <div className="empty">No saved addresses.</div> : <div className="table-wrap"><table><thead><tr><th>Label</th><th>Address</th><th>City</th><th>Default</th><th>Instructions</th></tr></thead><tbody>{user.addresses.map((address) => <tr key={address.id}><td>{address.label || '—'}</td><td>{address.addressLine}</td><td>{address.city || '—'}</td><td>{address.isDefault ? 'Yes' : 'No'}</td><td>{address.instructions || '—'}</td></tr>)}</tbody></table></div>}</div>

      <div className="detail-section"><h3>Merchant memberships</h3>{user.memberships.length === 0 ? <div className="empty">No merchant membership.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Type</th><th>Status</th><th>Role</th><th>Branch</th></tr></thead><tbody>{user.memberships.map((membership) => <tr key={membership.id}><td>{membership.tenant.name}</td><td>{humanize(membership.tenant.merchantType)}</td><td><span className={statusClass(membership.tenant.status)}>{humanize(membership.tenant.status)}</span></td><td>{humanize(membership.role)}</td><td>{membership.branch ? `${membership.branch.name}${membership.branch.city ? ` · ${membership.branch.city}` : ''}` : 'All branches'}</td></tr>)}</tbody></table></div>}</div>

      <div className="detail-section"><h3>Recent customer orders</h3>{user.customerOrders.length === 0 ? <div className="empty">No customer orders.</div> : <div className="table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Merchant</th><th>Total</th><th>Payment</th><th>Order status</th><th>Delivery</th><th>Created</th></tr></thead><tbody>{user.customerOrders.map((order) => <tr key={order.id}><td><div className="cell-title">{order.orderNumber}</div><div className="cell-sub">{order._count?.items ?? 0} item{(order._count?.items ?? 0) === 1 ? '' : 's'}</div></td><td><div className="cell-title">{order.tenant.name}</div><div className="cell-sub">{order.branch.city || order.branch.name}</div></td><td><strong>{formatMoney(order.total, order.tenant.currency)}</strong></td><td><span className={statusClass(order.paymentStatus)}>{humanize(order.paymentStatus)}</span><div className="cell-sub">{humanize(order.paymentMethod)}</div></td><td><span className={statusClass(order.status)}>{humanize(order.status)}</span></td><td>{order.delivery ? <span className={statusClass(order.delivery.status)}>{humanize(order.delivery.status)}</span> : '—'}</td><td>{formatDate(order.createdAt)}</td></tr>)}</tbody></table></div>}</div>
      <div style={{ height: 24 }} />
    </section>
  </div>;
}
