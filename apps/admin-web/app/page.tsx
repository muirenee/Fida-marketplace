'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type AdminUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isPlatformAdmin: boolean;
  createdAt?: string;
  driver?: { id: string; isOnline: boolean; isAvailable: boolean; lastSeenAt?: string | null } | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  merchantType: string;
  currency: string;
  createdAt?: string;
  branches?: Array<{ id: string; name: string; city?: string | null; isActive: boolean }>;
  _count?: { memberships: number; products: number; orders: number };
};

type Driver = {
  id: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeenAt?: string | null;
  user: AdminUser;
  _count?: { deliveries: number };
};

type Overview = {
  tenants: number;
  pendingTenants: number;
  users: number;
  drivers: number;
  onlineDrivers: number;
  orders: number;
};

type Tab = 'overview' | 'merchants' | 'users' | 'drivers';

const displayName = (user: Partial<AdminUser>) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Unnamed user';
};

const statusClass = (status: string) => `badge ${status.toLowerCase()}`;

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('ALL');

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/admin/${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      setUser(null);
      throw new Error('Your admin session has expired. Please sign in again.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    }
    if (response.status === 204) return null;
    return response.json();
  }, []);

  const loadData = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [summary, tenantRows, userRows, driverRows] = await Promise.all([
        adminFetch('overview'),
        adminFetch('tenants'),
        adminFetch('users'),
        adminFetch('drivers'),
      ]);
      setOverview(summary as Overview);
      setTenants(tenantRows as Tenant[]);
      setUsers(userRows as AdminUser[]);
      setDrivers(driverRows as Driver[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load admin data.');
    } finally {
      setBusy(false);
    }
  }, [adminFetch]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/session/me', { cache: 'no-store' });
        if (response.ok) {
          const payload = await response.json();
          setUser(payload.user);
        }
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (user) void loadData();
  }, [user, loadData]);

  async function login(email: string, password: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch('/api/session/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? 'Sign in failed.');
      setUser(payload.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    setUser(null);
    setOverview(null);
  }

  async function setTenantStatus(tenant: Tenant, status: string) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`tenants/${tenant.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update merchant.');
      setBusy(false);
    }
  }

  async function setUserActive(target: AdminUser, isActive: boolean) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`users/${target.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update user.');
      setBusy(false);
    }
  }

  async function approveDriver(target: AdminUser) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch('drivers', {
        method: 'POST',
        body: JSON.stringify({ userId: target.id }),
      });
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to approve driver.');
      setBusy(false);
    }
  }

  async function searchUsers(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const rows = await adminFetch(`users${userQuery.trim() ? `?q=${encodeURIComponent(userQuery.trim())}` : ''}`);
      setUsers(rows as AdminUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to search users.');
    } finally {
      setBusy(false);
    }
  }

  const filteredTenants = useMemo(
    () => tenantFilter === 'ALL' ? tenants : tenants.filter((tenant) => tenant.status === tenantFilter),
    [tenants, tenantFilter],
  );

  if (checking) return <div className="loading">Checking admin session…</div>;
  if (!user) return <Login busy={busy} error={error} onLogin={login} />;

  const titles: Record<Tab, [string, string]> = {
    overview: ['Overview', 'Marketplace health and pending work.'],
    merchants: ['Merchants', 'Approve, suspend and review marketplace tenants.'],
    users: ['Users', 'Customer accounts, access state and driver approval.'],
    drivers: ['Drivers', 'Approved delivery partners and live availability.'],
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">F</div>
          <div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Control Center</div></div>
        </div>
        <nav className="nav">
          {(['overview', 'merchants', 'users', 'drivers'] as Tab[]).map((value) => (
            <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>
              {value === 'overview' ? 'Overview' : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user"><strong>{displayName(user)}</strong><br />{user.email}</div>
          <button className="btn" onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><h1>{titles[tab][0]}</h1><p>{titles[tab][1]}</p></div>
          <div className="actions"><button className="btn" disabled={busy} onClick={() => void loadData()}>{busy ? 'Refreshing…' : 'Refresh'}</button></div>
        </header>
        {error && <div className="error">{error}</div>}

        {tab === 'overview' && <OverviewView overview={overview} tenants={tenants} onOpenMerchants={() => setTab('merchants')} />}
        {tab === 'merchants' && (
          <MerchantsView tenants={filteredTenants} filter={tenantFilter} setFilter={setTenantFilter} busy={busy} setStatus={setTenantStatus} />
        )}
        {tab === 'users' && (
          <UsersView users={users} query={userQuery} setQuery={setUserQuery} busy={busy} search={searchUsers} approveDriver={approveDriver} setActive={setUserActive} />
        )}
        {tab === 'drivers' && <DriversView drivers={drivers} />}
      </main>

      <nav className="mobile-nav">
        {(['overview', 'merchants', 'users', 'drivers'] as Tab[]).map((value) => (
          <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'overview' ? 'Home' : value}</button>
        ))}
      </nav>
    </div>
  );
}

function Login({ busy, error, onLogin }: { busy: boolean; error: string | null; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <main className="login-page">
      <form className="login-card" onSubmit={(e) => { e.preventDefault(); void onLogin(email, password); }}>
        <div className="login-logo">F</div>
        <h1>Fida Marketplace</h1>
        <p>Platform administrator sign in</p>
        {error && <div className="error">{error}</div>}
        <div className="field"><label>Email</label><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function OverviewView({ overview, tenants, onOpenMerchants }: { overview: Overview | null; tenants: Tenant[]; onOpenMerchants: () => void }) {
  const cards = [
    ['Merchants', overview?.tenants ?? '—', `${overview?.pendingTenants ?? 0} pending approval`],
    ['Orders', overview?.orders ?? '—', 'All marketplace orders'],
    ['Users', overview?.users ?? '—', 'Registered accounts'],
    ['Drivers', overview?.drivers ?? '—', `${overview?.onlineDrivers ?? 0} online`],
    ['Pending merchants', overview?.pendingTenants ?? '—', 'Require platform review'],
    ['Online drivers', overview?.onlineDrivers ?? '—', 'Currently sharing availability'],
  ];
  const pending = tenants.filter((tenant) => tenant.status === 'PENDING');
  return <>
    <section className="cards">{cards.map(([label, value, note]) => <article className="card stat" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}</section>
    <section className="panel">
      <div className="panel-head"><div><h2>Pending merchant approvals</h2><p>New businesses stay hidden from customers until activated.</p></div><button className="btn small" onClick={onOpenMerchants}>Open merchants</button></div>
      {pending.length === 0 ? <div className="empty">No merchants are waiting for approval.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Type</th><th>Branches</th><th>Products</th></tr></thead><tbody>{pending.slice(0, 6).map((tenant) => <tr key={tenant.id}><td><div className="cell-title">{tenant.name}</div><div className="cell-sub">{tenant.slug}</div></td><td>{tenant.merchantType}</td><td>{tenant.branches?.length ?? 0}</td><td>{tenant._count?.products ?? 0}</td></tr>)}</tbody></table></div>}
    </section>
  </>;
}

function MerchantsView({ tenants, filter, setFilter, busy, setStatus }: { tenants: Tenant[]; filter: string; setFilter: (v: string) => void; busy: boolean; setStatus: (t: Tenant, s: string) => Promise<void> }) {
  return <section className="panel">
    <div className="panel-head"><div><h2>Marketplace merchants</h2><p>{tenants.length} shown</p></div><div className="toolbar"><select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All statuses</option><option>PENDING</option><option>ACTIVE</option><option>SUSPENDED</option><option>CLOSED</option></select></div></div>
    {tenants.length === 0 ? <div className="empty">No merchants match this filter.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Status</th><th>Branches</th><th>Catalog</th><th>Orders</th><th>Actions</th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id}><td><div className="cell-title">{tenant.name}</div><div className="cell-sub">{tenant.merchantType.toLowerCase()} · {tenant.currency}</div></td><td><span className={statusClass(tenant.status)}>{tenant.status}</span></td><td>{tenant.branches?.map((b) => b.city || b.name).join(', ') || '—'}</td><td>{tenant._count?.products ?? 0}</td><td>{tenant._count?.orders ?? 0}</td><td><div className="actions">{tenant.status !== 'ACTIVE' && tenant.status !== 'CLOSED' && <button className="btn primary small" disabled={busy} onClick={() => void setStatus(tenant, 'ACTIVE')}>Activate</button>}{tenant.status === 'ACTIVE' && <button className="btn small" disabled={busy} onClick={() => void setStatus(tenant, 'SUSPENDED')}>Suspend</button>}{tenant.status !== 'CLOSED' && <button className="btn danger small" disabled={busy} onClick={() => void setStatus(tenant, 'CLOSED')}>Close</button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function UsersView({ users, query, setQuery, busy, search, approveDriver, setActive }: { users: AdminUser[]; query: string; setQuery: (v: string) => void; busy: boolean; search: (e?: FormEvent) => Promise<void>; approveDriver: (u: AdminUser) => Promise<void>; setActive: (u: AdminUser, active: boolean) => Promise<void> }) {
  return <section className="panel">
    <div className="panel-head"><div><h2>User directory</h2><p>Search accounts and approve delivery partners.</p></div><form className="toolbar" onSubmit={(e) => void search(e)}><input className="input" placeholder="Email, phone or name" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn" disabled={busy}>Search</button></form></div>
    {users.length === 0 ? <div className="empty">No users found.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Account</th><th>Driver</th><th>Actions</th></tr></thead><tbody>{users.map((row) => <tr key={row.id}><td><div className="cell-title">{displayName(row)}</div><div className="cell-sub">{row.email || row.phone || row.id}</div></td><td><span className={statusClass(row.isActive ? 'active' : 'inactive')}>{row.isPlatformAdmin ? 'platform admin' : row.isActive ? 'active' : 'inactive'}</span></td><td>{row.driver ? <><span className={statusClass(row.driver.isOnline ? 'active' : 'pending')}>{row.driver.isOnline ? 'online' : 'approved'}</span><div className="cell-sub">{row.driver.isAvailable ? 'available' : 'not available'}</div></> : 'Not approved'}</td><td><div className="actions">{!row.driver && row.isActive && !row.isPlatformAdmin && <button className="btn primary small" disabled={busy} onClick={() => void approveDriver(row)}>Approve driver</button>}{!row.isPlatformAdmin && <button className={`btn small ${row.isActive ? 'danger' : ''}`} disabled={busy} onClick={() => void setActive(row, !row.isActive)}>{row.isActive ? 'Disable' : 'Enable'}</button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function DriversView({ drivers }: { drivers: Driver[] }) {
  return <section className="panel"><div className="panel-head"><div><h2>Approved drivers</h2><p>{drivers.length} delivery partners</p></div></div>{drivers.length === 0 ? <div className="empty">No drivers approved yet.</div> : <div className="table-wrap"><table><thead><tr><th>Driver</th><th>Status</th><th>Availability</th><th>Deliveries</th><th>Last seen</th></tr></thead><tbody>{drivers.map((driver) => <tr key={driver.id}><td><div className="cell-title">{displayName(driver.user)}</div><div className="cell-sub">{driver.user.email || driver.user.phone}</div></td><td><span className={statusClass(driver.isOnline ? 'active' : 'pending')}>{driver.isOnline ? 'online' : 'offline'}</span></td><td>{driver.isAvailable ? 'Available' : 'Unavailable'}</td><td>{driver._count?.deliveries ?? 0}</td><td>{driver.lastSeenAt ? new Date(driver.lastSeenAt).toLocaleString() : 'Never'}</td></tr>)}</tbody></table></div>}</section>;
}
