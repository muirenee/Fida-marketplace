'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

type DriverOperator = { id: string; name: string; type: string; tenantId?: string | null; tenant?: { id: string; name: string } | null };
type AdminUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  isActive: boolean;
  isPlatformAdmin: boolean;
  createdAt?: string;
  driver?: {
    id: string;
    isActive?: boolean;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeenAt?: string | null;
    operator?: DriverOperator | null;
  } | null;
};

type Tenant = {
  id: string;
  name: string;
  slug: string;
  status: string;
  merchantType: string;
  currency: string;
  timezone?: string;
  isAcceptingOrders: boolean;
  minimumOrder: string | number;
  platformCommissionPercent: string | number;
  createdAt?: string;
  branches?: Array<{ id: string; name: string; city?: string | null; isActive: boolean }>;
  _count?: { memberships: number; products: number; orders: number };
};

type Driver = {
  id: string;
  isActive: boolean;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeenAt?: string | null;
  user: AdminUser;
  operator?: DriverOperator | null;
  branch?: { id: string; name: string; city?: string | null } | null;
  _count?: { deliveries: number };
};

type OrderDelivery = {
  id: string;
  status: string;
  assignedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  operator?: DriverOperator | null;
  driver?: { id: string; isOnline?: boolean; user: Partial<AdminUser> } | null;
} | null;

type Order = {
  id: string;
  orderNumber: string;
  status: string;
  fulfillmentType: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotal: string | number;
  deliveryFee: string | number;
  serviceFee: string | number;
  discount: string | number;
  total: string | number;
  platformCommissionPercent: string | number;
  platformCommissionAmount: string | number;
  deliveryDistanceKm?: string | number | null;
  deliveryAddress?: string | null;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; name: string; currency: string };
  branch: { id: string; name: string; city?: string | null; addressLine?: string | null };
  customer: Partial<AdminUser>;
  delivery: OrderDelivery;
  _count?: { items: number };
};

type OrderDetail = Order & {
  deliveryLatitude?: string | number | null;
  deliveryLongitude?: string | number | null;
  deliveryInstructions?: string | null;
  items: Array<{ id: string; productId?: string | null; productName: string; quantity: number; unitPrice: string | number; totalPrice: string | number }>;
};

type CatalogProduct = {
  id: string;
  name: string;
  description?: string | null;
  sku?: string | null;
  price: string | number;
  isActive: boolean;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; name: string; currency: string; status: string };
  category?: { id: string; name: string; isActive: boolean } | null;
};

type CatalogCategory = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  tenant: { id: string; name: string; currency: string; status: string };
  _count?: { products: number };
};

type Overview = { tenants: number; pendingTenants: number; users: number; drivers: number; onlineDrivers: number; orders: number };
type MerchantSettingsPayload = { isAcceptingOrders: boolean; minimumOrder: number; platformCommissionPercent: number };
type Tab = 'overview' | 'merchants' | 'catalog' | 'orders' | 'users' | 'drivers';

const displayName = (user: Partial<AdminUser>) => [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.phone || 'Unnamed user';
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const humanizeStatus = (status: string) => status.replaceAll('_', ' ').toLowerCase();
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const formatMoney = (value: string | number, currency = 'RWF') => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;
  return new Intl.NumberFormat('en-RW', { style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2 }).format(amount);
};

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AdminUser | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogCategories, setCatalogCategories] = useState<CatalogCategory[]>([]);
  const [busy, setBusy] = useState(false);
  const [detailBusy, setDetailBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [tenantFilter, setTenantFilter] = useState('ALL');
  const [orderQuery, setOrderQuery] = useState('');
  const [orderStatus, setOrderStatus] = useState('ALL');
  const [orderPaymentStatus, setOrderPaymentStatus] = useState('ALL');
  const [orderDeliveryStatus, setOrderDeliveryStatus] = useState('ALL');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogTenantId, setCatalogTenantId] = useState('ALL');
  const [catalogState, setCatalogState] = useState('ALL');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<Tenant | null>(null);

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const response = await fetch(`/api/admin/${path}`, {
      ...init,
      headers: { accept: 'application/json', ...(init?.body ? { 'content-type': 'application/json' } : {}), ...(init?.headers ?? {}) },
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
      const [summary, tenantRows, orderRows, userRows, driverRows, productRows, categoryRows] = await Promise.all([
        adminFetch('overview'), adminFetch('tenants'), adminFetch('orders'), adminFetch('users'), adminFetch('drivers'), adminFetch('catalog/products'), adminFetch('catalog/categories'),
      ]);
      setOverview(summary as Overview);
      setTenants(tenantRows as Tenant[]);
      setOrders(orderRows as Order[]);
      setUsers(userRows as AdminUser[]);
      setDrivers(driverRows as Driver[]);
      setCatalogProducts(productRows as CatalogProduct[]);
      setCatalogCategories(categoryRows as CatalogCategory[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load admin data.');
    } finally { setBusy(false); }
  }, [adminFetch]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/session/me', { cache: 'no-store' });
        if (response.ok) setUser((await response.json()).user);
      } finally { setChecking(false); }
    })();
  }, []);

  useEffect(() => { if (user) void loadData(); }, [user, loadData]);

  async function login(email: string, password: string) {
    setBusy(true); setError(null);
    try {
      const response = await fetch('/api/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message ?? payload.error ?? 'Sign in failed.');
      setUser(payload.user);
    } catch (e) { setError(e instanceof Error ? e.message : 'Sign in failed.'); }
    finally { setBusy(false); }
  }

  async function logout() {
    await fetch('/api/session/logout', { method: 'POST' });
    setUser(null); setOverview(null); setSelectedOrder(null); setSelectedMerchant(null);
  }

  async function setTenantStatus(tenant: Tenant, status: string) {
    setBusy(true); setError(null);
    try { await adminFetch(`tenants/${tenant.id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update merchant.'); setBusy(false); }
  }

  async function saveMerchantSettings(tenant: Tenant, payload: MerchantSettingsPayload) {
    setBusy(true); setError(null);
    try { await adminFetch(`tenants/${tenant.id}/settings`, { method: 'PATCH', body: JSON.stringify(payload) }); setSelectedMerchant(null); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update merchant settings.'); setBusy(false); throw e; }
  }

  async function setUserActive(target: AdminUser, isActive: boolean) {
    setBusy(true); setError(null);
    try { await adminFetch(`users/${target.id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }); await loadData(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update user.'); setBusy(false); }
  }

  async function searchUsers(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError(null);
    try { setUsers(await adminFetch(`users${userQuery.trim() ? `?q=${encodeURIComponent(userQuery.trim())}` : ''}`) as AdminUser[]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to search users.'); }
    finally { setBusy(false); }
  }

  async function searchOrders(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (orderQuery.trim()) params.set('q', orderQuery.trim());
      if (orderStatus !== 'ALL') params.set('status', orderStatus);
      if (orderPaymentStatus !== 'ALL') params.set('paymentStatus', orderPaymentStatus);
      if (orderDeliveryStatus !== 'ALL') params.set('deliveryStatus', orderDeliveryStatus);
      setOrders(await adminFetch(`orders${params.size ? `?${params}` : ''}`) as Order[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to search orders.'); }
    finally { setBusy(false); }
  }

  async function clearOrderFilters() {
    setOrderQuery(''); setOrderStatus('ALL'); setOrderPaymentStatus('ALL'); setOrderDeliveryStatus('ALL'); setBusy(true); setError(null);
    try { setOrders(await adminFetch('orders') as Order[]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load orders.'); }
    finally { setBusy(false); }
  }

  async function openOrder(order: Order) {
    setDetailBusy(true); setError(null);
    try { setSelectedOrder(await adminFetch(`orders/${order.id}`) as OrderDetail); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load order details.'); }
    finally { setDetailBusy(false); }
  }

  async function searchCatalog(event?: FormEvent) {
    event?.preventDefault(); setBusy(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (catalogQuery.trim()) params.set('q', catalogQuery.trim());
      if (catalogTenantId !== 'ALL') params.set('tenantId', catalogTenantId);
      if (catalogState !== 'ALL') params.set('state', catalogState);
      const categoryParams = new URLSearchParams();
      if (catalogTenantId !== 'ALL') categoryParams.set('tenantId', catalogTenantId);
      const [productRows, categoryRows] = await Promise.all([
        adminFetch(`catalog/products${params.size ? `?${params}` : ''}`),
        adminFetch(`catalog/categories${categoryParams.size ? `?${categoryParams}` : ''}`),
      ]);
      setCatalogProducts(productRows as CatalogProduct[]); setCatalogCategories(categoryRows as CatalogCategory[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to search catalog.'); }
    finally { setBusy(false); }
  }

  async function clearCatalogFilters() {
    setCatalogQuery(''); setCatalogTenantId('ALL'); setCatalogState('ALL'); setBusy(true); setError(null);
    try {
      const [productRows, categoryRows] = await Promise.all([adminFetch('catalog/products'), adminFetch('catalog/categories')]);
      setCatalogProducts(productRows as CatalogProduct[]); setCatalogCategories(categoryRows as CatalogCategory[]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load catalog.'); }
    finally { setBusy(false); }
  }

  async function updateProduct(product: CatalogProduct, patch: { isActive?: boolean; isAvailable?: boolean }) {
    setBusy(true); setError(null);
    try { await adminFetch(`catalog/products/${product.id}`, { method: 'PATCH', body: JSON.stringify(patch) }); await searchCatalog(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update product.'); setBusy(false); }
  }

  async function updateCategory(category: CatalogCategory, isActive: boolean) {
    setBusy(true); setError(null);
    try { await adminFetch(`catalog/categories/${category.id}/active`, { method: 'PATCH', body: JSON.stringify({ isActive }) }); await searchCatalog(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to update category.'); setBusy(false); }
  }

  const filteredTenants = useMemo(() => tenantFilter === 'ALL' ? tenants : tenants.filter((tenant) => tenant.status === tenantFilter), [tenants, tenantFilter]);

  if (checking) return <div className="loading">Checking admin session…</div>;
  if (!user) return <Login busy={busy} error={error} onLogin={login} />;

  const titles: Record<Tab, [string, string]> = {
    overview: ['Overview', 'Marketplace health and pending work.'],
    merchants: ['Merchants', 'Approve merchants and control order intake, minimum order and Fida commission.'],
    catalog: ['Catalog', 'Review merchant categories, listings, prices and availability.'],
    orders: ['Orders', 'Search marketplace orders and review pickup, delivery and commission details.'],
    users: ['Users', 'Customer and staff accounts. Driver enrollment is merchant-managed.'],
    drivers: ['Drivers', 'Read-only oversight of merchant-managed delivery partners.'],
  };
  const navItems = ['overview', 'merchants', 'catalog', 'orders', 'users', 'drivers'] as Tab[];

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Control Center</div></div></div>
      <nav className="nav">{navItems.map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'overview' ? 'Overview' : value[0].toUpperCase() + value.slice(1)}</button>)}</nav>
      <div className="sidebar-footer"><div className="sidebar-user"><strong>{displayName(user)}</strong><br />{user.email}</div><button className="btn" onClick={logout}>Sign out</button></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>{titles[tab][0]}</h1><p>{titles[tab][1]}</p></div><div className="actions"><button className="btn" disabled={busy} onClick={() => void loadData()}>{busy ? 'Refreshing…' : 'Refresh'}</button></div></header>
      {error && <div className="error">{error}</div>}
      {tab === 'overview' && <OverviewView overview={overview} tenants={tenants} onOpenMerchants={() => setTab('merchants')} onOpenOrders={() => setTab('orders')} />}
      {tab === 'merchants' && <MerchantsView tenants={filteredTenants} filter={tenantFilter} setFilter={setTenantFilter} busy={busy} setStatus={setTenantStatus} openSettings={setSelectedMerchant} openCatalog={(tenant) => { setCatalogTenantId(tenant.id); setTab('catalog'); void (async () => { const [p, c] = await Promise.all([adminFetch(`catalog/products?tenantId=${encodeURIComponent(tenant.id)}`), adminFetch(`catalog/categories?tenantId=${encodeURIComponent(tenant.id)}`)]); setCatalogProducts(p as CatalogProduct[]); setCatalogCategories(c as CatalogCategory[]); })(); }} />}
      {tab === 'catalog' && <CatalogView products={catalogProducts} categories={catalogCategories} tenants={tenants} query={catalogQuery} setQuery={setCatalogQuery} tenantId={catalogTenantId} setTenantId={setCatalogTenantId} state={catalogState} setState={setCatalogState} busy={busy} search={searchCatalog} clear={clearCatalogFilters} updateProduct={updateProduct} updateCategory={updateCategory} />}
      {tab === 'orders' && <OrdersView orders={orders} query={orderQuery} setQuery={setOrderQuery} status={orderStatus} setStatus={setOrderStatus} paymentStatus={orderPaymentStatus} setPaymentStatus={setOrderPaymentStatus} deliveryStatus={orderDeliveryStatus} setDeliveryStatus={setOrderDeliveryStatus} busy={busy || detailBusy} search={searchOrders} clear={clearOrderFilters} openOrder={openOrder} />}
      {tab === 'users' && <UsersView users={users} query={userQuery} setQuery={setUserQuery} busy={busy} search={searchUsers} setActive={setUserActive} />}
      {tab === 'drivers' && <DriversView drivers={drivers} />}
    </main>
    <nav className="mobile-nav">{navItems.map((value) => <button key={value} className={tab === value ? 'active' : ''} onClick={() => setTab(value)}>{value === 'overview' ? 'Home' : value}</button>)}</nav>
    {selectedOrder && <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    {selectedMerchant && <MerchantSettingsModal tenant={selectedMerchant} busy={busy} onClose={() => setSelectedMerchant(null)} onSave={saveMerchantSettings} />}
  </div>;
}

function Login({ busy, error, onLogin }: { busy: boolean; error: string | null; onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  return <main className="login-page"><form className="login-card" onSubmit={(e) => { e.preventDefault(); void onLogin(email, password); }}><div className="login-logo">F</div><h1>Fida Marketplace</h1><p>Platform administrator sign in</p>{error && <div className="error">{error}</div>}<div className="field"><label>Email</label><input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div><div className="field"><label>Password</label><input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div><button className="btn primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form></main>;
}

function OverviewView({ overview, tenants, onOpenMerchants, onOpenOrders }: { overview: Overview | null; tenants: Tenant[]; onOpenMerchants: () => void; onOpenOrders: () => void }) {
  const cards = [
    ['Merchants', overview?.tenants ?? '—', `${overview?.pendingTenants ?? 0} pending approval`],
    ['Orders', overview?.orders ?? '—', 'All marketplace orders'],
    ['Users', overview?.users ?? '—', 'Registered accounts'],
    ['Merchant drivers', overview?.drivers ?? '—', `${overview?.onlineDrivers ?? 0} online`],
    ['Pending merchants', overview?.pendingTenants ?? '—', 'Require platform review'],
    ['Online drivers', overview?.onlineDrivers ?? '—', 'Merchant-managed availability'],
  ];
  const pending = tenants.filter((tenant) => ['PENDING','PENDING_APPROVAL'].includes(tenant.status));
  return <><section className="cards">{cards.map(([label, value, note]) => <article className={`card stat ${label === 'Orders' ? 'clickable' : ''}`} key={label} onClick={label === 'Orders' ? onOpenOrders : undefined} role={label === 'Orders' ? 'button' : undefined} tabIndex={label === 'Orders' ? 0 : undefined}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></article>)}</section><section className="panel"><div className="panel-head"><div><h2>Pending merchant approvals</h2><p>New businesses stay hidden from customers until activated.</p></div><button className="btn small" onClick={onOpenMerchants}>Open merchants</button></div>{pending.length === 0 ? <div className="empty">No merchants are waiting for approval.</div> : <div className="table-wrap"><table><thead><tr><th>Merchant</th><th>Type</th><th>Branches</th><th>Products</th></tr></thead><tbody>{pending.slice(0, 6).map((tenant) => <tr key={tenant.id}><td><div className="cell-title">{tenant.name}</div><div className="cell-sub">{tenant.slug}</div></td><td>{tenant.merchantType}</td><td>{tenant.branches?.length ?? 0}</td><td>{tenant._count?.products ?? 0}</td></tr>)}</tbody></table></div>}</section></>;
}

function MerchantsView({ tenants, filter, setFilter, busy, setStatus, openSettings, openCatalog }: { tenants: Tenant[]; filter: string; setFilter: (v: string) => void; busy: boolean; setStatus: (t: Tenant, s: string) => Promise<void>; openSettings: (t: Tenant) => void; openCatalog: (t: Tenant) => void }) {
  return <section className="panel"><div className="panel-head"><div><h2>Marketplace merchants</h2><p>{tenants.length} shown</p></div><div className="toolbar"><select className="select" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="ALL">All statuses</option><option>PENDING</option><option>PENDING_APPROVAL</option><option>REJECTED</option><option>ACTIVE</option><option>SUSPENDED</option><option>CLOSED</option></select></div></div>{tenants.length === 0 ? <div className="empty">No merchants match this filter.</div> : <div className="table-wrap"><table className="merchants-table"><thead><tr><th>Merchant</th><th>Status</th><th>Orders</th><th>Commercial settings</th><th>Catalog</th><th>Actions</th></tr></thead><tbody>{tenants.map((tenant) => <tr key={tenant.id}><td><div className="cell-title">{tenant.name}</div><div className="cell-sub">{tenant.merchantType.toLowerCase()} · {tenant.currency} · {tenant.branches?.map((b) => b.city || b.name).join(', ') || 'No branch'}</div></td><td><span className={statusClass(tenant.status)}>{humanizeStatus(tenant.status)}</span></td><td>{tenant._count?.orders ?? 0}</td><td><span className={statusClass(tenant.isAcceptingOrders ? 'active' : 'suspended')}>{tenant.isAcceptingOrders ? 'accepting orders' : 'orders paused'}</span><div className="cell-sub">Min {formatMoney(tenant.minimumOrder, tenant.currency)} · Fida commission {Number(tenant.platformCommissionPercent ?? 0)}%</div></td><td><button className="btn small" disabled={busy} onClick={() => openCatalog(tenant)}>{tenant._count?.products ?? 0} product{(tenant._count?.products ?? 0) === 1 ? '' : 's'}</button></td><td><div className="actions"><button className="btn small" disabled={busy} onClick={() => openSettings(tenant)}>Settings</button>{!['ACTIVE','CLOSED','PENDING_APPROVAL','REJECTED'].includes(tenant.status) && <button className="btn primary small" disabled={busy} onClick={() => void setStatus(tenant, 'ACTIVE')}>Activate</button>}{['PENDING_APPROVAL','REJECTED'].includes(tenant.status)&&<a className="btn small" href="/business-operations">Review application</a>}{tenant.status === 'ACTIVE' && <button className="btn small" disabled={busy} onClick={() => void setStatus(tenant, 'SUSPENDED')}>Suspend</button>}{tenant.status !== 'CLOSED' && <button className="btn danger small" disabled={busy} onClick={() => void setStatus(tenant, 'CLOSED')}>Close</button>}</div></td></tr>)}</tbody></table></div>}</section>;
}

function CatalogView({ products, categories, tenants, query, setQuery, tenantId, setTenantId, state, setState, busy, search, clear, updateProduct, updateCategory }: { products: CatalogProduct[]; categories: CatalogCategory[]; tenants: Tenant[]; query: string; setQuery: (v: string) => void; tenantId: string; setTenantId: (v: string) => void; state: string; setState: (v: string) => void; busy: boolean; search: (e?: FormEvent) => Promise<void>; clear: () => Promise<void>; updateProduct: (p: CatalogProduct, patch: { isActive?: boolean; isAvailable?: boolean }) => Promise<void>; updateCategory: (c: CatalogCategory, active: boolean) => Promise<void> }) {
  return <><section className="panel"><div className="panel-head catalog-head"><div><h2>Product listings</h2><p>{products.length} shown · platform visibility controls affect the customer marketplace immediately.</p></div><form className="catalog-filters" onSubmit={(e) => void search(e)}><input className="input" placeholder="Product, SKU, category or merchant" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="select" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="ALL">All merchants</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select><select className="select" value={state} onChange={(e) => setState(e.target.value)}><option value="ALL">All listing states</option><option value="AVAILABLE">Available</option><option value="ACTIVE">Active listings</option><option value="INACTIVE">Disabled listings</option><option value="UNAVAILABLE">Unavailable products</option></select><button className="btn primary" disabled={busy}>Apply</button><button className="btn" type="button" disabled={busy} onClick={() => void clear()}>Clear</button></form></div>{products.length === 0 ? <div className="empty">No products match these filters.</div> : <div className="table-wrap"><table className="catalog-table"><thead><tr><th>Product</th><th>Merchant</th><th>Category</th><th>Price</th><th>Listing</th><th>Availability</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{products.map((product) => <tr key={product.id}><td><div className="cell-title">{product.name}</div><div className="cell-sub">{product.sku || 'No SKU'}{product.description ? ` · ${product.description}` : ''}</div></td><td><div className="cell-title">{product.tenant.name}</div><div className="cell-sub">{humanizeStatus(product.tenant.status)}</div></td><td>{product.category ? <><div className="cell-title">{product.category.name}</div><div className="cell-sub">{product.category.isActive ? 'category active' : 'category disabled'}</div></> : 'Uncategorized'}</td><td><strong>{formatMoney(product.price, product.tenant.currency)}</strong></td><td><span className={statusClass(product.isActive ? 'active' : 'inactive')}>{product.isActive ? 'active' : 'disabled'}</span></td><td><span className={statusClass(product.isAvailable ? 'available' : 'unavailable')}>{product.isAvailable ? 'available' : 'unavailable'}</span></td><td>{formatDate(product.updatedAt)}</td><td><div className="actions"><button className={`btn small ${product.isActive ? 'danger' : 'primary'}`} disabled={busy} onClick={() => void updateProduct(product, { isActive: !product.isActive })}>{product.isActive ? 'Disable listing' : 'Enable listing'}</button><button className="btn small" disabled={busy} onClick={() => void updateProduct(product, { isAvailable: !product.isAvailable })}>{product.isAvailable ? 'Mark unavailable' : 'Make available'}</button></div></td></tr>)}</tbody></table></div>}</section><section className="panel"><div className="panel-head"><div><h2>Categories</h2><p>{categories.length} shown · disabling a category hides all of its products from customers without deleting data.</p></div></div>{categories.length === 0 ? <div className="empty">No categories found for this merchant filter.</div> : <div className="table-wrap"><table><thead><tr><th>Category</th><th>Merchant</th><th>Products</th><th>Sort order</th><th>Status</th><th>Action</th></tr></thead><tbody>{categories.map((category) => <tr key={category.id}><td><div className="cell-title">{category.name}</div><div className="cell-sub">{category.slug}</div></td><td>{category.tenant.name}</td><td>{category._count?.products ?? 0}</td><td>{category.sortOrder}</td><td><span className={statusClass(category.isActive ? 'active' : 'inactive')}>{category.isActive ? 'active' : 'disabled'}</span></td><td><button className={`btn small ${category.isActive ? 'danger' : 'primary'}`} disabled={busy} onClick={() => void updateCategory(category, !category.isActive)}>{category.isActive ? 'Disable category' : 'Enable category'}</button></td></tr>)}</tbody></table></div>}</section></>;
}

function OrdersView({ orders, query, setQuery, status, setStatus, paymentStatus, setPaymentStatus, deliveryStatus, setDeliveryStatus, busy, search, clear, openOrder }: { orders: Order[]; query: string; setQuery: (v: string) => void; status: string; setStatus: (v: string) => void; paymentStatus: string; setPaymentStatus: (v: string) => void; deliveryStatus: string; setDeliveryStatus: (v: string) => void; busy: boolean; search: (e?: FormEvent) => Promise<void>; clear: () => Promise<void>; openOrder: (order: Order) => Promise<void> }) {
  const orderStatuses = ['PENDING', 'ACCEPTED', 'PREPARING', 'READY_FOR_PICKUP', 'PICKED_UP', 'DELIVERING', 'COMPLETED', 'CANCELLED', 'REJECTED'];
  const paymentStatuses = ['PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED'];
  const deliveryStatuses = ['UNASSIGNED', 'OFFERED', 'ASSIGNED', 'AT_PICKUP', 'PICKED_UP', 'AT_DROPOFF', 'DELIVERED', 'CANCELLED'];
  return <section className="panel"><div className="panel-head orders-head"><div><h2>Marketplace orders</h2><p>{orders.length} shown · newest first</p></div><form className="order-filters" onSubmit={(e) => void search(e)}><input className="input" placeholder="Order, merchant or customer" value={query} onChange={(e) => setQuery(e.target.value)} /><select className="select" value={status} onChange={(e) => setStatus(e.target.value)}><option value="ALL">All order statuses</option>{orderStatuses.map((value) => <option key={value}>{value}</option>)}</select><select className="select" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}><option value="ALL">All payment statuses</option>{paymentStatuses.map((value) => <option key={value}>{value}</option>)}</select><select className="select" value={deliveryStatus} onChange={(e) => setDeliveryStatus(e.target.value)}><option value="ALL">All delivery statuses</option>{deliveryStatuses.map((value) => <option key={value}>{value}</option>)}</select><button className="btn primary" disabled={busy}>Apply</button><button className="btn" type="button" disabled={busy} onClick={() => void clear()}>Clear</button></form></div>{orders.length === 0 ? <div className="empty">No orders match these filters.</div> : <div className="table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Merchant</th><th>Customer</th><th>Total</th><th>Payment</th><th>Order status</th><th>Fulfillment</th><th>Created</th><th></th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><div className="cell-title">{order.orderNumber}</div><div className="cell-sub">{order._count?.items ?? 0} item{(order._count?.items ?? 0) === 1 ? '' : 's'}</div></td><td><div className="cell-title">{order.tenant.name}</div><div className="cell-sub">{order.branch.city || order.branch.name}</div></td><td><div className="cell-title">{displayName(order.customer)}</div><div className="cell-sub">{order.customer.email || order.customer.phone || '—'}</div></td><td><div className="cell-title">{formatMoney(order.total, order.tenant.currency)}</div><div className="cell-sub">commission {formatMoney(order.platformCommissionAmount ?? 0, order.tenant.currency)}</div></td><td><span className={statusClass(order.paymentStatus)}>{humanizeStatus(order.paymentStatus)}</span><div className="cell-sub">{humanizeStatus(order.paymentMethod)}</div></td><td><span className={statusClass(order.status)}>{humanizeStatus(order.status)}</span></td><td>{order.fulfillmentType === 'PICKUP' ? <><span className={statusClass('available')}>pickup</span><div className="cell-sub">customer pickup</div></> : order.delivery ? <><span className={statusClass(order.delivery.status)}>{humanizeStatus(order.delivery.status)}</span><div className="cell-sub">{order.delivery.driver ? displayName(order.delivery.driver.user) : order.delivery.operator?.name || 'No driver'}</div></> : <span className={statusClass('unassigned')}>delivery</span>}</td><td>{formatDate(order.createdAt)}</td><td><button className="btn small" disabled={busy} onClick={() => void openOrder(order)}>View</button></td></tr>)}</tbody></table></div>}</section>;
}

function UsersView({ users, query, setQuery, busy, search, setActive }: { users: AdminUser[]; query: string; setQuery: (v: string) => void; busy: boolean; search: (e?: FormEvent) => Promise<void>; setActive: (u: AdminUser, active: boolean) => Promise<void> }) {
  return <section className="panel"><div className="panel-head"><div><h2>User directory</h2><p>Search accounts. Merchants enroll and manage their own drivers.</p></div><form className="toolbar" onSubmit={(e) => void search(e)}><input className="input" placeholder="Email, phone or name" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn" disabled={busy}>Search</button></form></div>{users.length === 0 ? <div className="empty">No users found.</div> : <div className="table-wrap"><table><thead><tr><th>User</th><th>Account</th><th>Driver enrollment</th><th>Actions</th></tr></thead><tbody>{users.map((row) => <tr key={row.id}><td><div className="cell-title">{displayName(row)}</div><div className="cell-sub">{row.email || row.phone || row.id}</div></td><td><span className={statusClass(row.isActive ? 'active' : 'inactive')}>{row.isPlatformAdmin ? 'platform admin' : row.isActive ? 'active' : 'inactive'}</span></td><td>{row.driver ? <><span className={statusClass(row.driver.isOnline ? 'active' : 'pending')}>{row.driver.isOnline ? 'online' : 'enrolled'}</span><div className="cell-sub">{row.driver.operator?.name || 'Merchant-managed driver'} · {row.driver.isAvailable ? 'available' : 'not available'}</div></> : <span className="cell-sub">Not enrolled</span>}</td><td>{!row.isPlatformAdmin && <button className={`btn small ${row.isActive ? 'danger' : ''}`} disabled={busy} onClick={() => void setActive(row, !row.isActive)}>{row.isActive ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody></table></div>}</section>;
}

function DriversView({ drivers }: { drivers: Driver[] }) {
  return <section className="panel"><div className="panel-head"><div><h2>Delivery partner oversight</h2><p>{drivers.length} enrolled drivers · enrollment and branch assignment are merchant-managed.</p></div><a className="btn small" href="/insights" style={{ textDecoration: 'none' }}>Open driver insights</a></div>{drivers.length === 0 ? <div className="empty">No merchant drivers are enrolled yet.</div> : <div className="table-wrap"><table><thead><tr><th>Driver</th><th>Operator</th><th>Branch</th><th>Account</th><th>Status</th><th>Availability</th><th>Deliveries</th><th>Last seen</th></tr></thead><tbody>{drivers.map((driver) => <tr key={driver.id}><td><div className="cell-title">{displayName(driver.user)}</div><div className="cell-sub">{driver.user.email || driver.user.phone}</div></td><td><div className="cell-title">{driver.operator?.tenant?.name || driver.operator?.name || 'Unassigned'}</div><div className="cell-sub">{driver.operator ? humanizeStatus(driver.operator.type) : 'no operator'}</div></td><td>{driver.branch ? <><div className="cell-title">{driver.branch.name}</div><div className="cell-sub">{driver.branch.city || '—'}</div></> : 'All branches'}</td><td><span className={statusClass(driver.user.isActive && driver.isActive ? 'active' : 'inactive')}>{driver.user.isActive && driver.isActive ? 'active' : 'disabled'}</span></td><td><span className={statusClass(driver.isOnline ? 'active' : 'pending')}>{driver.isOnline ? 'online' : 'offline'}</span></td><td>{driver.isAvailable ? 'Available' : 'Unavailable'}</td><td>{driver._count?.deliveries ?? 0}</td><td>{formatDate(driver.lastSeenAt)}</td></tr>)}</tbody></table></div>}</section>;
}

function MerchantSettingsModal({ tenant, busy, onClose, onSave }: { tenant: Tenant; busy: boolean; onClose: () => void; onSave: (tenant: Tenant, payload: MerchantSettingsPayload) => Promise<void> }) {
  const [acceptingOrders, setAcceptingOrders] = useState(tenant.isAcceptingOrders);
  const [minimumOrder, setMinimumOrder] = useState(String(tenant.minimumOrder ?? 0));
  const [commissionPercent, setCommissionPercent] = useState(String(tenant.platformCommissionPercent ?? 0));
  const [localError, setLocalError] = useState<string | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const minimum = Number(minimumOrder); const commission = Number(commissionPercent);
    if (!Number.isFinite(minimum) || minimum < 0 || !Number.isFinite(commission) || commission < 0 || commission > 100) { setLocalError('Enter a valid minimum order and a Fida commission between 0 and 100%.'); return; }
    setLocalError(null);
    try { await onSave(tenant, { isAcceptingOrders: acceptingOrders, minimumOrder: minimum, platformCommissionPercent: commission }); } catch { /* parent shows API error */ }
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (!busy && event.currentTarget === event.target) onClose(); }}><form className="modal-card settings-modal" role="dialog" aria-modal="true" aria-label={`Settings for ${tenant.name}`} onSubmit={(e) => void submit(e)}><div className="modal-head"><div><div className="eyebrow">Merchant commercial settings</div><h2>{tenant.name}</h2><div className="modal-statuses"><span className={statusClass(tenant.status)}>{humanizeStatus(tenant.status)}</span><span className={statusClass(acceptingOrders ? 'active' : 'suspended')}>{acceptingOrders ? 'accepting orders' : 'orders paused'}</span></div></div><button className="btn" type="button" disabled={busy} onClick={onClose}>Close</button></div><div className="settings-body">{localError && <div className="error">{localError}</div>}<div className="settings-summary"><article className="detail-card"><div className="detail-label">Currency</div><div className="detail-value">{tenant.currency}</div></article><article className="detail-card"><div className="detail-label">Timezone</div><div className="detail-value">{tenant.timezone || 'Africa/Kigali'}</div></article><article className="detail-card"><div className="detail-label">Merchant type</div><div className="detail-value">{humanizeStatus(tenant.merchantType)}</div></article></div><label className="toggle-row"><div><strong>Accept new orders</strong><span>Turn this off to pause checkout without suspending the merchant account.</span></div><input type="checkbox" checked={acceptingOrders} onChange={(e) => setAcceptingOrders(e.target.checked)} /></label><div className="settings-grid"><div className="field"><label>Minimum order ({tenant.currency})</label><input className="input" type="number" min="0" step={tenant.currency === 'RWF' ? '1' : '0.01'} required value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} /><span className="field-help">Customer merchandise subtotal must reach this amount before checkout.</span></div><div className="field"><label>Fida commission on merchandise (%)</label><input className="input" type="number" min="0" max="100" step="0.01" required value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} /><span className="field-help">Deducted from merchandise sales only. Merchant delivery revenue is excluded.</span></div></div><div className="settings-note">Delivery pricing is configured by the merchant per branch and distance band. These settings apply to new orders only; existing order snapshots remain unchanged.</div></div><div className="settings-actions"><button className="btn" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div></form></div>;
}

function OrderDetailModal({ order, onClose }: { order: OrderDetail; onClose: () => void }) {
  const currency = order.tenant.currency;
  const driver = order.delivery?.driver?.user;
  const commission = Number(order.platformCommissionAmount ?? 0);
  const merchandiseNet = Math.max(0, Number(order.subtotal ?? 0) - commission);
  const pickup = order.fulfillmentType === 'PICKUP';
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={`Order ${order.orderNumber}`}><div className="modal-head"><div><div className="eyebrow">Order detail</div><h2>{order.orderNumber}</h2><div className="modal-statuses"><span className={statusClass(order.status)}>{humanizeStatus(order.status)}</span><span className={statusClass(order.paymentStatus)}>{humanizeStatus(order.paymentStatus)}</span><span className={statusClass(pickup ? 'available' : 'active')}>{humanizeStatus(order.fulfillmentType)}</span>{order.delivery && <span className={statusClass(order.delivery.status)}>{humanizeStatus(order.delivery.status)}</span>}</div></div><button className="btn" onClick={onClose}>Close</button></div><div className="detail-grid"><article className="detail-card"><div className="detail-label">Merchant</div><div className="detail-value">{order.tenant.name}</div><div className="cell-sub">{order.branch.name}{order.branch.city ? ` · ${order.branch.city}` : ''}</div></article><article className="detail-card"><div className="detail-label">Customer</div><div className="detail-value">{displayName(order.customer)}</div><div className="cell-sub">{order.customer.email || order.customer.phone || 'No contact'}</div></article><article className="detail-card"><div className="detail-label">Payment</div><div className="detail-value">{humanizeStatus(order.paymentMethod)}</div><div className="cell-sub">{humanizeStatus(order.paymentStatus)}</div></article><article className="detail-card"><div className="detail-label">Fulfillment</div><div className="detail-value">{pickup ? 'Customer pickup' : 'Merchant delivery'}</div><div className="cell-sub">{pickup ? order.branch.name : driver ? displayName(driver) : order.delivery?.operator?.name || 'Driver not assigned'}</div></article></div>{!pickup && <div className="detail-section"><h3>Delivery</h3><div className="detail-grid two"><article className="detail-card"><div className="detail-label">Address</div><div className="detail-value compact">{order.deliveryAddress || 'No delivery address'}</div>{order.deliveryDistanceKm != null && <div className="cell-sub">Distance: {Number(order.deliveryDistanceKm).toFixed(1)} km</div>}{order.deliveryInstructions && <div className="cell-sub">Instructions: {order.deliveryInstructions}</div>}</article><article className="detail-card"><div className="detail-label">Timeline</div><div className="timeline"><span>Created <strong>{formatDate(order.createdAt)}</strong></span><span>Assigned <strong>{formatDate(order.delivery?.assignedAt)}</strong></span><span>Picked up <strong>{formatDate(order.delivery?.pickedUpAt)}</strong></span><span>Delivered <strong>{formatDate(order.delivery?.deliveredAt)}</strong></span></div></article></div></div>}<div className="detail-section"><h3>Items</h3><div className="table-wrap"><table className="detail-items"><thead><tr><th>Product</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td><div className="cell-title">{item.productName}</div></td><td>{item.quantity}</td><td>{formatMoney(item.unitPrice, currency)}</td><td>{formatMoney(item.totalPrice, currency)}</td></tr>)}</tbody></table></div></div><div className="order-totals"><div><span>Merchandise subtotal</span><strong>{formatMoney(order.subtotal, currency)}</strong></div>{Number(order.deliveryFee) > 0 && <div><span>Merchant delivery</span><strong>{formatMoney(order.deliveryFee, currency)}</strong></div>}{Number(order.serviceFee) > 0 && <div><span>Legacy service fee</span><strong>{formatMoney(order.serviceFee, currency)}</strong></div>}{Number(order.discount) > 0 && <div><span>Discount</span><strong>-{formatMoney(order.discount, currency)}</strong></div>}<div className="grand-total"><span>Customer total</span><strong>{formatMoney(order.total, currency)}</strong></div><div><span>Fida commission ({Number(order.platformCommissionPercent ?? 0)}%)</span><strong>{formatMoney(commission, currency)}</strong></div><div><span>Merchant merchandise net</span><strong>{formatMoney(merchandiseNet, currency)}</strong></div></div></section></div>;
}
