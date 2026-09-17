'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type Tenant = { id: string; name: string; status: string; currency: string };
type Branch = { id: string; name: string; code?: string | null; city?: string | null; addressLine?: string | null; isActive: boolean; isAcceptingOrders: boolean; tenant: Tenant; _count?: { memberships: number; orders: number } };
type User = { id: string; email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null; isActive: boolean; isPlatformAdmin: boolean };
type Membership = { id: string; role: string; tenant: { id: string; name: string }; branch?: { id: string; name: string } | null; user: User };

const displayName = (user: User) => [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.phone || 'Unnamed user';
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;

export default function ProvisioningPage() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  const [branchTenantId, setBranchTenantId] = useState('');
  const [branchName, setBranchName] = useState('');
  const [branchCode, setBranchCode] = useState('');
  const [branchCity, setBranchCity] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [branchAccepting, setBranchAccepting] = useState(true);

  const [staffTenantId, setStaffTenantId] = useState('');
  const [staffUserId, setStaffUserId] = useState('');
  const [staffRole, setStaffRole] = useState('STAFF');
  const [staffBranchId, setStaffBranchId] = useState('');
  const [userQuery, setUserQuery] = useState('');

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/admin/${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
    if (response.status === 401 || response.status === 403) {
      window.location.href = '/';
      throw new Error('Admin session expired.');
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message ?? payload.error ?? `Request failed (${response.status})`);
    return payload;
  }, []);

  const loadData = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const [tenantRows, branchRows, userRows, membershipRows] = await Promise.all([
        adminFetch('tenants'),
        adminFetch('branches'),
        adminFetch('users'),
        adminFetch('memberships'),
      ]);
      const normalizedTenants = (tenantRows as Tenant[]).map((tenant) => ({ id: tenant.id, name: tenant.name, status: tenant.status, currency: tenant.currency }));
      setTenants(normalizedTenants);
      setBranches(branchRows as Branch[]);
      setUsers(userRows as User[]);
      setMemberships(membershipRows as Membership[]);
      if (!branchTenantId && normalizedTenants[0]) setBranchTenantId(normalizedTenants[0].id);
      if (!staffTenantId && normalizedTenants[0]) setStaffTenantId(normalizedTenants[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load provisioning data.');
    } finally {
      setBusy(false);
    }
  }, [adminFetch, branchTenantId, staffTenantId]);

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/session/me', { cache: 'no-store' });
      if (!response.ok) {
        window.location.href = '/';
        return;
      }
      await loadData();
      setChecking(false);
    })();
  }, [loadData]);

  const staffBranches = useMemo(() => branches.filter((branch) => branch.tenant.id === staffTenantId), [branches, staffTenantId]);
  const filteredUsers = useMemo(() => users.filter((user) => {
    if (!user.isActive || user.isPlatformAdmin) return false;
    if (memberships.some((membership) => membership.tenant.id === staffTenantId && membership.user.id === user.id)) return false;
    if (!userQuery.trim()) return true;
    const haystack = [user.firstName, user.lastName, user.email, user.phone].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(userQuery.trim().toLowerCase());
  }), [memberships, staffTenantId, userQuery, users]);

  async function createBranch(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await adminFetch('branches', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: branchTenantId,
          name: branchName,
          code: branchCode,
          city: branchCity,
          addressLine: branchAddress,
          isAcceptingOrders: branchAccepting,
        }),
      });
      setBranchName('');
      setBranchCode('');
      setBranchCity('');
      setBranchAddress('');
      setSuccess('Branch created successfully.');
      const rows = await adminFetch('branches');
      setBranches(rows as Branch[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create branch.');
    } finally {
      setBusy(false);
    }
  }

  async function assignStaff(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await adminFetch('memberships', {
        method: 'POST',
        body: JSON.stringify({
          tenantId: staffTenantId,
          userId: staffUserId,
          role: staffRole,
          branchId: staffBranchId || null,
        }),
      });
      setStaffUserId('');
      setStaffBranchId('');
      setSuccess('Merchant staff assignment created.');
      const rows = await adminFetch('memberships');
      setMemberships(rows as Membership[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to assign merchant staff.');
    } finally {
      setBusy(false);
    }
  }

  if (checking) return <div className="loading">Checking admin session…</div>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Provisioning Center</div></div></div>
      <nav className="nav"><a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a><a className="btn" href="/operations" style={{ textDecoration: 'none', textAlign: 'center' }}>Operations</a><a className="btn" href="/finance" style={{ textDecoration: 'none', textAlign: 'center' }}>Finance</a></nav>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>Provisioning</h1><p>Create merchant branches and assign existing users to merchant teams.</p></div><button className="btn" disabled={busy} onClick={() => void loadData()}>{busy ? 'Refreshing…' : 'Refresh'}</button></header>
      {error && <div className="error">{error}</div>}
      {success && <div className="settings-note">{success}</div>}

      <section className="panel">
        <div className="panel-head"><div><h2>Create merchant branch</h2><p>Add a new operating location without changing the merchant account.</p></div></div>
        <form className="panel-body" onSubmit={(e) => void createBranch(e)}>
          <div className="settings-grid">
            <div className="field"><label>Merchant</label><select className="select" required value={branchTenantId} onChange={(e) => setBranchTenantId(e.target.value)}>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {humanize(tenant.status)}</option>)}</select></div>
            <div className="field"><label>Branch name</label><input className="input" required minLength={2} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="Kigali Main" /></div>
            <div className="field"><label>Branch code</label><input className="input" value={branchCode} onChange={(e) => setBranchCode(e.target.value)} placeholder="KG01" /></div>
            <div className="field"><label>City</label><input className="input" value={branchCity} onChange={(e) => setBranchCity(e.target.value)} placeholder="Kigali" /></div>
            <div className="field"><label>Address</label><input className="input" value={branchAddress} onChange={(e) => setBranchAddress(e.target.value)} placeholder="Street / building" /></div>
            <label className="toggle-row"><div><strong>Accept orders immediately</strong><span>Leave off if the branch is not yet ready for customer orders.</span></div><input type="checkbox" checked={branchAccepting} onChange={(e) => setBranchAccepting(e.target.checked)} /></label>
          </div>
          <div className="settings-actions"><button className="btn primary" disabled={busy || !branchTenantId || branchName.trim().length < 2}>{busy ? 'Creating…' : 'Create branch'}</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><div><h2>Assign merchant staff</h2><p>Assign an existing active Fida user to a merchant role.</p></div></div>
        <form className="panel-body" onSubmit={(e) => void assignStaff(e)}>
          <div className="settings-grid">
            <div className="field"><label>Merchant</label><select className="select" required value={staffTenantId} onChange={(e) => { setStaffTenantId(e.target.value); setStaffUserId(''); setStaffBranchId(''); }}>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></div>
            <div className="field"><label>Find user</label><input className="input" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Name, email or phone" /></div>
            <div className="field"><label>User</label><select className="select" required value={staffUserId} onChange={(e) => setStaffUserId(e.target.value)}><option value="">Select user</option>{filteredUsers.map((user) => <option key={user.id} value={user.id}>{displayName(user)} · {user.email || user.phone || user.id}</option>)}</select></div>
            <div className="field"><label>Role</label><select className="select" value={staffRole} onChange={(e) => setStaffRole(e.target.value)}><option value="OWNER">owner</option><option value="ADMIN">admin</option><option value="MANAGER">manager</option><option value="STAFF">staff</option></select></div>
            <div className="field"><label>Branch scope</label><select className="select" value={staffBranchId} onChange={(e) => setStaffBranchId(e.target.value)}><option value="">All branches</option>{staffBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}{branch.isActive ? '' : ' (inactive)'}</option>)}</select></div>
          </div>
          <div className="settings-actions"><button className="btn primary" disabled={busy || !staffTenantId || !staffUserId}>{busy ? 'Assigning…' : 'Assign staff'}</button></div>
        </form>
      </section>

      <section className="panel"><div className="panel-head"><div><h2>Current branch inventory</h2><p>{branches.length} branches across {tenants.length} merchants</p></div></div>{branches.length === 0 ? <div className="empty">No branches found.</div> : <div className="table-wrap"><table><thead><tr><th>Branch</th><th>Merchant</th><th>Location</th><th>Status</th><th>Staff</th><th>Orders</th></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id}><td><div className="cell-title">{branch.name}</div><div className="cell-sub">{branch.code || 'No code'}</div></td><td>{branch.tenant.name}</td><td><div className="cell-title">{branch.city || '—'}</div><div className="cell-sub">{branch.addressLine || 'No address'}</div></td><td><span className={statusClass(branch.isActive ? 'active' : 'inactive')}>{branch.isActive ? 'active' : 'inactive'}</span></td><td>{branch._count?.memberships ?? 0}</td><td>{branch._count?.orders ?? 0}</td></tr>)}</tbody></table></div>}</section>
    </main>
  </div>;
}
