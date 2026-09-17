'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type SessionUser = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

type Tenant = {
  id: string;
  name: string;
  status: string;
  currency: string;
};

type Branch = {
  id: string;
  name: string;
  code?: string | null;
  addressLine?: string | null;
  city?: string | null;
  isActive: boolean;
  isAcceptingOrders: boolean;
  tenant: Tenant;
  _count?: { memberships: number; orders: number };
};

type Membership = {
  id: string;
  role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'STAFF';
  branchId?: string | null;
  createdAt: string;
  tenant: Pick<Tenant, 'id' | 'name' | 'status'>;
  branch?: { id: string; name: string; city?: string | null; isActive: boolean } | null;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive: boolean;
    lastLoginAt?: string | null;
  };
};

type Driver = {
  id: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeenAt?: string | null;
  user: {
    id: string;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    isActive: boolean;
  };
  _count?: { deliveries: number };
};

type OperationsSummary = {
  activeBranches: number;
  pausedBranches: number;
  activeProducts: number;
  unavailableProducts: number;
  activeOrders: number;
  completedOrders: number;
  completedRevenue: string | number;
  pendingCashOrders: number;
  pendingCashValue: string | number;
  merchantStaff: number;
};

type View = 'summary' | 'branches' | 'staff' | 'drivers';

const displayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.phone || 'Unnamed user';
};

const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : '—');
const formatMoney = (value: string | number, currency = 'RWF') => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat('en-RW', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'RWF' ? 0 : 2,
  }).format(amount);
};

export default function OperationsPage() {
  const [checking, setChecking] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [view, setView] = useState<View>('summary');
  const [summary, setSummary] = useState<OperationsSummary | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tenantId, setTenantId] = useState('ALL');
  const [branchState, setBranchState] = useState('ALL');
  const [staffQuery, setStaffQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      window.location.href = '/';
      throw new Error('Admin session expired.');
    }
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    }
    return response.status === 204 ? null : response.json();
  }, []);

  const loadOperations = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [summaryRow, tenantRows, branchRows, membershipRows, driverRows] = await Promise.all([
        adminFetch('operations/summary'),
        adminFetch('tenants'),
        adminFetch('branches'),
        adminFetch('memberships'),
        adminFetch('drivers'),
      ]);
      setSummary(summaryRow as OperationsSummary);
      setTenants((tenantRows as Array<Tenant & { slug?: string }>).map((tenant) => ({ id: tenant.id, name: tenant.name, status: tenant.status, currency: tenant.currency })));
      setBranches(branchRows as Branch[]);
      setMemberships(membershipRows as Membership[]);
      setDrivers(driverRows as Driver[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load operations data.');
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
        const payload = await response.json();
        setSessionUser(payload.user);
        await loadOperations();
      } finally {
        setChecking(false);
      }
    })();
  }, [loadOperations]);

  const filteredBranches = useMemo(() => branches.filter((branch) => {
    if (tenantId !== 'ALL' && branch.tenant.id !== tenantId) return false;
    if (branchState === 'ACTIVE' && !branch.isActive) return false;
    if (branchState === 'INACTIVE' && branch.isActive) return false;
    if (branchState === 'PAUSED' && (!branch.isActive || branch.isAcceptingOrders)) return false;
    return true;
  }), [branches, branchState, tenantId]);

  const filteredMemberships = useMemo(() => memberships.filter((membership) => {
    if (tenantId !== 'ALL' && membership.tenant.id !== tenantId) return false;
    if (!staffQuery.trim()) return true;
    const haystack = [membership.tenant.name, membership.user.firstName, membership.user.lastName, membership.user.email, membership.user.phone]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(staffQuery.trim().toLowerCase());
  }), [memberships, staffQuery, tenantId]);

  async function patchBranch(branch: Branch, patch: { isActive?: boolean; isAcceptingOrders?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`branches/${branch.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const [branchRows, summaryRow] = await Promise.all([adminFetch('branches'), adminFetch('operations/summary')]);
      setBranches(branchRows as Branch[]);
      setSummary(summaryRow as OperationsSummary);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update branch.');
    } finally {
      setBusy(false);
    }
  }

  async function patchMembership(membership: Membership, patch: { role?: string; branchId?: string | null }) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`memberships/${membership.id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      const rows = await adminFetch('memberships');
      setMemberships(rows as Membership[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update merchant staff.');
    } finally {
      setBusy(false);
    }
  }

  async function patchDriver(driver: Driver, patch: { isOnline?: boolean; isAvailable?: boolean }) {
    setBusy(true);
    setError(null);
    try {
      await adminFetch(`drivers/${driver.id}/state`, { method: 'PATCH', body: JSON.stringify(patch) });
      const rows = await adminFetch('drivers');
      setDrivers(rows as Driver[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update driver state.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="loading">Checking admin session…</div>;

  const titles: Record<View, [string, string]> = {
    summary: ['Operations', 'Live marketplace operations, settlement exposure and workload.'],
    branches: ['Branches', 'Control branch availability without suspending the entire merchant.'],
    staff: ['Merchant staff', 'Review merchant roles and branch assignments.'],
    drivers: ['Driver controls', 'Operational controls for approved delivery partners.'],
  };

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Operations Center</div></div></div>
        <nav className="nav">
          <button className={view === 'summary' ? 'active' : ''} onClick={() => setView('summary')}>Summary</button>
          <button className={view === 'branches' ? 'active' : ''} onClick={() => setView('branches')}>Branches</button>
          <button className={view === 'staff' ? 'active' : ''} onClick={() => setView('staff')}>Merchant staff</button>
          <button className={view === 'drivers' ? 'active' : ''} onClick={() => setView('drivers')}>Driver controls</button>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user"><strong>{sessionUser ? displayName(sessionUser) : 'Platform admin'}</strong><br />{sessionUser?.email}</div>
          <a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div><h1>{titles[view][0]}</h1><p>{titles[view][1]}</p></div>
          <div className="actions">
            <a className="btn" href="/" style={{ textDecoration: 'none' }}>Main admin</a>
            <button className="btn" disabled={busy} onClick={() => void loadOperations()}>{busy ? 'Refreshing…' : 'Refresh'}</button>
          </div>
        </header>
        {error && <div className="error">{error}</div>}

        {view === 'summary' && <SummaryView summary={summary} />}
        {view === 'branches' && (
          <BranchesView
            branches={filteredBranches}
            tenants={tenants}
            tenantId={tenantId}
            setTenantId={setTenantId}
            state={branchState}
            setState={setBranchState}
            busy={busy}
            patchBranch={patchBranch}
          />
        )}
        {view === 'staff' && (
          <StaffView
            memberships={filteredMemberships}
            branches={branches}
            tenants={tenants}
            tenantId={tenantId}
            setTenantId={setTenantId}
            query={staffQuery}
            setQuery={setStaffQuery}
            busy={busy}
            patchMembership={patchMembership}
          />
        )}
        {view === 'drivers' && <DriversView drivers={drivers} busy={busy} patchDriver={patchDriver} />}
      </main>
    </div>
  );
}

function SummaryView({ summary }: { summary: OperationsSummary | null }) {
  const cards = [
    ['Active branches', summary?.activeBranches ?? '—', `${summary?.pausedBranches ?? 0} paused`],
    ['Active products', summary?.activeProducts ?? '—', `${summary?.unavailableProducts ?? 0} unavailable`],
    ['Orders in progress', summary?.activeOrders ?? '—', 'Across all merchants'],
    ['Completed orders', summary?.completedOrders ?? '—', 'Marketplace lifetime'],
    ['Merchant staff', summary?.merchantStaff ?? '—', 'Membership assignments'],
    ['Pending cash', summary?.pendingCashOrders ?? '—', summary ? formatMoney(summary.pendingCashValue) : '—'],
  ];
  return <>
    <section className="cards">
      {cards.map(([label, value, note]) => <article className="card stat" key={label}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}
    </section>
    <section className="panel">
      <div className="panel-head"><div><h2>Settlement snapshot</h2><p>Paid value from completed orders and cash still awaiting settlement.</p></div></div>
      <div className="panel-body">
        <div className="settings-summary">
          <article className="detail-card"><div className="detail-label">Completed paid value</div><div className="detail-value">{summary ? formatMoney(summary.completedRevenue) : '—'}</div></article>
          <article className="detail-card"><div className="detail-label">Pending cash orders</div><div className="detail-value">{summary?.pendingCashOrders ?? '—'}</div></article>
          <article className="detail-card"><div className="detail-label">Pending cash value</div><div className="detail-value">{summary ? formatMoney(summary.pendingCashValue) : '—'}</div></article>
        </div>
      </div>
    </section>
  </>;
}

function BranchesView({ branches, tenants, tenantId, setTenantId, state, setState, busy, patchBranch }: {
  branches: Branch[];
  tenants: Tenant[];
  tenantId: string;
  setTenantId: (value: string) => void;
  state: string;
  setState: (value: string) => void;
  busy: boolean;
  patchBranch: (branch: Branch, patch: { isActive?: boolean; isAcceptingOrders?: boolean }) => Promise<void>;
}) {
  return <section className="panel">
    <div className="panel-head"><div><h2>Merchant branches</h2><p>{branches.length} shown</p></div><div className="toolbar"><select className="select" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="ALL">All merchants</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><select className="select" value={state} onChange={(e) => setState(e.target.value)}><option value="ALL">All states</option><option value="ACTIVE">Active</option><option value="PAUSED">Orders paused</option><option value="INACTIVE">Inactive</option></select></div></div>
    {branches.length === 0 ? <div className="empty">No branches match these filters.</div> : <div className="table-wrap"><table><thead><tr><th>Branch</th><th>Merchant</th><th>Location</th><th>State</th><th>Staff</th><th>Orders</th><th>Actions</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id}><td><div className="cell-title">{branch.name}</div><div className="cell-sub">{branch.code || 'No code'}</div></td><td><div className="cell-title">{branch.tenant.name}</div><div className="cell-sub">{humanize(branch.tenant.status)}</div></td><td><div className="cell-title">{branch.city || '—'}</div><div className="cell-sub">{branch.addressLine || 'No address'}</div></td><td><span className={statusClass(branch.isActive ? 'active' : 'inactive')}>{branch.isActive ? 'active' : 'inactive'}</span> <span className={statusClass(branch.isAcceptingOrders ? 'available' : 'suspended')}>{branch.isAcceptingOrders ? 'accepting orders' : 'orders paused'}</span></td><td>{branch._count?.memberships ?? 0}</td><td>{branch._count?.orders ?? 0}</td><td><div className="actions">{branch.isActive ? <><button className="btn small" disabled={busy} onClick={() => void patchBranch(branch, { isAcceptingOrders: !branch.isAcceptingOrders })}>{branch.isAcceptingOrders ? 'Pause orders' : 'Resume orders'}</button><button className="btn danger small" disabled={busy} onClick={() => void patchBranch(branch, { isActive: false })}>Disable branch</button></> : <button className="btn primary small" disabled={busy} onClick={() => void patchBranch(branch, { isActive: true })}>Enable branch</button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}

function StaffView({ memberships, branches, tenants, tenantId, setTenantId, query, setQuery, busy, patchMembership }: {
  memberships: Membership[];
  branches: Branch[];
  tenants: Tenant[];
  tenantId: string;
  setTenantId: (value: string) => void;
  query: string;
  setQuery: (value: string) => void;
  busy: boolean;
  patchMembership: (membership: Membership, patch: { role?: string; branchId?: string | null }) => Promise<void>;
}) {
  const roles = ['OWNER', 'ADMIN', 'MANAGER', 'STAFF'];
  return <section className="panel">
    <div className="panel-head"><div><h2>Merchant staff assignments</h2><p>{memberships.length} shown · the last owner of a merchant cannot be demoted.</p></div><div className="toolbar"><input className="input" placeholder="Name, email, phone or merchant" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="select" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="ALL">All merchants</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></div></div>
    {memberships.length === 0 ? <div className="empty">No merchant staff match these filters.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Merchant</th><th>Account</th><th>Role</th><th>Branch assignment</th><th>Last login</th></tr></thead><tbody>{memberships.map((membership) => { const tenantBranches = branches.filter((branch) => branch.tenant.id === membership.tenant.id); return <tr key={membership.id}><td><div className="cell-title">{displayName(membership.user)}</div><div className="cell-sub">{membership.user.email || membership.user.phone || membership.user.id}</div></td><td><div className="cell-title">{membership.tenant.name}</div><div className="cell-sub">{humanize(membership.tenant.status)}</div></td><td><span className={statusClass(membership.user.isActive ? 'active' : 'inactive')}>{membership.user.isActive ? 'active' : 'inactive'}</span></td><td><select className="select" disabled={busy} value={membership.role} onChange={(e) => void patchMembership(membership, { role: e.target.value })}>{roles.map((role) => <option key={role} value={role}>{humanize(role)}</option>)}</select></td><td><select className="select" disabled={busy} value={membership.branchId || ''} onChange={(e) => void patchMembership(membership, { branchId: e.target.value || null })}><option value="">All branches</option>{tenantBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.isActive ? '' : ' (inactive)'}</option>)}</select></td><td>{formatDate(membership.user.lastLoginAt)}</td></tr>; })}</tbody></table></div>}
  </section>;
}

function DriversView({ drivers, busy, patchDriver }: { drivers: Driver[]; busy: boolean; patchDriver: (driver: Driver, patch: { isOnline?: boolean; isAvailable?: boolean }) => Promise<void> }) {
  return <section className="panel">
    <div className="panel-head"><div><h2>Driver operations</h2><p>{drivers.length} approved delivery partners</p></div></div>
    {drivers.length === 0 ? <div className="empty">No drivers approved yet.</div> : <div className="table-wrap"><table><thead><tr><th>Driver</th><th>Account</th><th>Status</th><th>Availability</th><th>Deliveries</th><th>Last seen</th><th>Actions</th></tr></thead><tbody>{drivers.map((driver) => <tr key={driver.id}><td><div className="cell-title">{displayName(driver.user)}</div><div className="cell-sub">{driver.user.email || driver.user.phone}</div></td><td><span className={statusClass(driver.user.isActive ? 'active' : 'inactive')}>{driver.user.isActive ? 'active' : 'disabled'}</span></td><td><span className={statusClass(driver.isOnline ? 'active' : 'pending')}>{driver.isOnline ? 'online' : 'offline'}</span></td><td><span className={statusClass(driver.isAvailable ? 'available' : 'unavailable')}>{driver.isAvailable ? 'available' : 'unavailable'}</span></td><td>{driver._count?.deliveries ?? 0}</td><td>{formatDate(driver.lastSeenAt)}</td><td><div className="actions">{driver.isOnline && <button className="btn small" disabled={busy} onClick={() => void patchDriver(driver, { isAvailable: !driver.isAvailable })}>{driver.isAvailable ? 'Make unavailable' : 'Mark available'}</button>}{driver.isOnline && <button className="btn danger small" disabled={busy} onClick={() => void patchDriver(driver, { isOnline: false })}>Force offline</button>}</div></td></tr>)}</tbody></table></div>}
  </section>;
}
