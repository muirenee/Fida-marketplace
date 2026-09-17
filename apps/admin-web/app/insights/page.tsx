'use client';

import { useCallback, useEffect, useState } from 'react';

type TenantListItem = { id: string; name: string; status: string; currency: string; merchantType: string };
type DriverListItem = {
  id: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeenAt?: string | null;
  operator?: { id: string; name: string; type: string; tenantId?: string | null } | null;
  user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; isActive: boolean };
  _count?: { deliveries: number };
};
type StatusRow = { status: string; total: number; orderValue?: string | number };
type DeliveryZone = { id: string; minDistanceKm: string | number; maxDistanceKm: string | number; fee: string | number };
type MerchantInsight = {
  tenant: {
    id: string;
    name: string;
    slug: string;
    status: string;
    merchantType: string;
    currency: string;
    timezone: string;
    isAcceptingOrders: boolean;
    minimumOrder: string | number;
    platformCommissionPercent: string | number;
    activatedAt?: string | null;
    createdAt: string;
    branches: Array<{
      id: string;
      name: string;
      code?: string | null;
      city?: string | null;
      addressLine?: string | null;
      latitude?: string | number | null;
      longitude?: string | number | null;
      isActive: boolean;
      isAcceptingOrders: boolean;
      pickupEnabled: boolean;
      deliveryEnabled: boolean;
      logisticsMode: string;
      deliveryZones: DeliveryZone[];
      _count?: { memberships: number; orders: number; drivers: number };
    }>;
    memberships: Array<{ id: string; role: string; createdAt: string; branch?: { id: string; name: string; city?: string | null } | null; user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; isActive: boolean; lastLoginAt?: string | null } }>;
    categories: Array<{ id: string; name: string; slug: string; sortOrder: number; isActive: boolean; _count?: { products: number } }>;
    orders: Array<{
      id: string;
      orderNumber: string;
      status: string;
      fulfillmentType: string;
      paymentMethod: string;
      paymentStatus: string;
      subtotal: string | number;
      deliveryFee: string | number;
      total: string | number;
      platformCommissionAmount: string | number;
      deliveryDistanceKm?: string | number | null;
      createdAt: string;
      branch: { id: string; name: string; city?: string | null };
      customer: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null };
      delivery?: { status: string; deliveredAt?: string | null; operator?: { id: string; name: string; type: string } | null; driver?: { id: string; user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } } | null } | null;
    }>;
    _count: { products: number; orders: number; memberships: number; branches: number };
  };
  metrics: {
    activeProducts: number;
    availableProducts: number;
    activeDrivers: number;
    paidOrders: number;
    paidValue: string | number;
    paidMerchandiseSales: string | number;
    paidPlatformCommission: string | number;
    paidDeliveryValue: string | number;
  };
  orderStatuses: StatusRow[];
  paymentStatuses: StatusRow[];
};
type DriverInsight = {
  driver: {
    id: string;
    isActive: boolean;
    isOnline: boolean;
    isAvailable: boolean;
    lastSeenAt?: string | null;
    operator?: { id: string; name: string; type: string; tenant?: { id: string; name: string } | null } | null;
    branch?: { id: string; name: string; city?: string | null } | null;
    user: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null; isActive: boolean; createdAt: string; lastLoginAt?: string | null };
    deliveries: Array<{ id: string; status: string; assignedAt?: string | null; pickedUpAt?: string | null; deliveredAt?: string | null; order: { id: string; orderNumber: string; status: string; fulfillmentType: string; paymentStatus: string; total: string | number; createdAt: string; tenant: { id: string; name: string; currency: string }; branch: { id: string; name: string; city?: string | null }; customer: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null } } }>;
    _count?: { deliveries: number };
  };
  deliveryStatuses: StatusRow[];
};
type View = 'merchant' | 'driver';

const displayName = (user: { firstName?: string | null; lastName?: string | null; email?: string | null; phone?: string | null }) => [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email || user.phone || 'Unnamed user';
const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase();
const statusClass = (status: string) => `badge ${status.toLowerCase()}`;
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';
const formatMoney = (value: string | number, currency = 'RWF') => new Intl.NumberFormat('en-RW', { style: 'currency', currency, maximumFractionDigits: currency === 'RWF' ? 0 : 2 }).format(Number(value ?? 0));

export default function InsightsPage() {
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('merchant');
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [drivers, setDrivers] = useState<DriverListItem[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [merchant, setMerchant] = useState<MerchantInsight | null>(null);
  const [driver, setDriver] = useState<DriverInsight | null>(null);

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

  const loadMerchant = useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try { setMerchant(await adminFetch(`insights/merchants/${id}`) as MerchantInsight); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load merchant insight.'); }
    finally { setBusy(false); }
  }, [adminFetch]);

  const loadDriver = useCallback(async (id: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try { setDriver(await adminFetch(`insights/drivers/${id}`) as DriverInsight); }
    catch (e) { setError(e instanceof Error ? e.message : 'Unable to load driver insight.'); }
    finally { setBusy(false); }
  }, [adminFetch]);

  useEffect(() => {
    void (async () => {
      const session = await fetch('/api/session/me', { cache: 'no-store' });
      if (!session.ok) { window.location.href = '/'; return; }
      try {
        const [tenantRows, driverRows] = await Promise.all([adminFetch('tenants'), adminFetch('drivers')]);
        const nextTenants = tenantRows as TenantListItem[];
        const nextDrivers = driverRows as DriverListItem[];
        setTenants(nextTenants);
        setDrivers(nextDrivers);
        if (nextTenants[0]) { setTenantId(nextTenants[0].id); await loadMerchant(nextTenants[0].id); }
        if (nextDrivers[0]) setDriverId(nextDrivers[0].id);
      } finally { setChecking(false); }
    })();
  }, [adminFetch, loadMerchant]);

  if (checking) return <div className="loading">Checking admin session…</div>;

  return <div className="admin-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">F</div><div><div className="brand-title">Fida Marketplace</div><div className="brand-sub">Insights Center</div></div></div>
      <nav className="nav"><button className={view === 'merchant' ? 'active' : ''} onClick={() => setView('merchant')}>Merchant insights</button><button className={view === 'driver' ? 'active' : ''} onClick={() => { setView('driver'); if (driverId && !driver) void loadDriver(driverId); }}>Driver oversight</button></nav>
      <div className="sidebar-footer"><a className="btn" href="/" style={{ textDecoration: 'none', textAlign: 'center' }}>Control Center</a><a className="btn" href="/reports" style={{ textDecoration: 'none', textAlign: 'center' }}>Reports</a><a className="btn" href="/support" style={{ textDecoration: 'none', textAlign: 'center' }}>Support</a></div>
    </aside>
    <main className="content">
      <header className="topbar"><div><h1>{view === 'merchant' ? 'Merchant insights' : 'Driver oversight'}</h1><p>{view === 'merchant' ? 'Commercial, catalog and merchant-managed logistics context.' : 'Read-only support visibility for merchant-enrolled drivers.'}</p></div></header>
      {error && <div className="error">{error}</div>}

      {view === 'merchant' && <>
        <section className="panel"><div className="panel-head"><div><h2>Select merchant</h2><p>{tenants.length} marketplace merchants</p></div><div className="toolbar"><select className="select" value={tenantId} onChange={(e) => { setTenantId(e.target.value); void loadMerchant(e.target.value); }}>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name} · {humanize(tenant.status)}</option>)}</select><button className="btn" disabled={busy || !tenantId} onClick={() => void loadMerchant(tenantId)}>{busy ? 'Loading…' : 'Refresh'}</button></div></div></section>
        {merchant && <MerchantView insight={merchant} />}
      </>}

      {view === 'driver' && <>
        <section className="panel"><div className="panel-head"><div><h2>Select merchant driver</h2><p>{drivers.length} drivers visible for platform support; merchants control enrollment and availability.</p></div><div className="toolbar"><select className="select" value={driverId} onChange={(e) => { setDriverId(e.target.value); void loadDriver(e.target.value); }}><option value="">Select driver</option>{drivers.map((row) => <option key={row.id} value={row.id}>{displayName(row.user)} · {row.operator?.name ?? 'unassigned operator'} · {row.isOnline ? 'online' : 'offline'}</option>)}</select><button className="btn" disabled={busy || !driverId} onClick={() => void loadDriver(driverId)}>{busy ? 'Loading…' : 'Refresh'}</button></div></div></section>
        {driver ? <DriverView insight={driver} /> : <div className="empty">Select a driver to view delivery insights.</div>}
      </>}
    </main>
  </div>;
}

function MerchantView({ insight }: { insight: MerchantInsight }) {
  const { tenant, metrics } = insight;
  return <>
    <section className="cards">
      <article className="card stat"><div className="stat-label">Orders</div><div className="stat-value">{tenant._count.orders}</div><div className="stat-note">{metrics.paidOrders} paid</div></article>
      <article className="card stat"><div className="stat-label">Products</div><div className="stat-value">{tenant._count.products}</div><div className="stat-note">{metrics.activeProducts} active · {metrics.availableProducts} available</div></article>
      <article className="card stat"><div className="stat-label">Merchant drivers</div><div className="stat-value">{metrics.activeDrivers}</div><div className="stat-note">Enrolled and managed by merchant</div></article>
      <article className="card stat"><div className="stat-label">Fida commission</div><div className="stat-value">{formatMoney(metrics.paidPlatformCommission, tenant.currency)}</div><div className="stat-note">From {formatMoney(metrics.paidMerchandiseSales, tenant.currency)} paid merchandise sales</div></article>
    </section>

    <section className="panel"><div className="panel-head"><div><h2>{tenant.name}</h2><p>{humanize(tenant.merchantType)} · {tenant.slug}</p></div><div className="modal-statuses"><span className={statusClass(tenant.status)}>{humanize(tenant.status)}</span><span className={statusClass(tenant.isAcceptingOrders ? 'active' : 'suspended')}>{tenant.isAcceptingOrders ? 'accepting orders' : 'orders paused'}</span></div></div><div className="detail-grid"><article className="detail-card"><div className="detail-label">Minimum order</div><div className="detail-value">{formatMoney(tenant.minimumOrder, tenant.currency)}</div></article><article className="detail-card"><div className="detail-label">Fida commission</div><div className="detail-value">{Number(tenant.platformCommissionPercent)}%</div><div className="cell-sub">Merchandise sales only</div></article><article className="detail-card"><div className="detail-label">Merchant delivery value</div><div className="detail-value">{formatMoney(metrics.paidDeliveryValue, tenant.currency)}</div><div className="cell-sub">Excluded from Fida commission</div></article><article className="detail-card"><div className="detail-label">Timezone</div><div className="detail-value">{tenant.timezone}</div></article></div><div style={{ height: 20 }} /></section>

    <div className="detail-grid two" style={{ padding: 0 }}>
      <section className="panel"><div className="panel-head"><div><h2>Order statuses</h2></div></div><div className="table-wrap"><table><thead><tr><th>Status</th><th>Orders</th></tr></thead><tbody>{insight.orderStatuses.map((row) => <tr key={row.status}><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.total}</td></tr>)}</tbody></table></div></section>
      <section className="panel"><div className="panel-head"><div><h2>Payment statuses</h2></div></div><div className="table-wrap"><table><thead><tr><th>Status</th><th>Orders</th><th>Order value</th></tr></thead><tbody>{insight.paymentStatuses.map((row) => <tr key={row.status}><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.total}</td><td>{formatMoney(row.orderValue ?? 0, tenant.currency)}</td></tr>)}</tbody></table></div></section>
    </div>

    <section className="panel"><div className="panel-head"><div><h2>Branches & fulfillment</h2><p>{tenant.branches.length} configured</p></div></div><div className="table-wrap"><table><thead><tr><th>Branch</th><th>Location</th><th>Fulfillment</th><th>Logistics</th><th>Delivery bands</th><th>Drivers</th><th>Orders</th></tr></thead><tbody>{tenant.branches.map((branch) => <tr key={branch.id}><td><div className="cell-title">{branch.name}</div><div className="cell-sub">{branch.code || 'No code'} · {branch.isActive ? 'active' : 'inactive'}</div></td><td><div className="cell-title">{branch.city || '—'}</div><div className="cell-sub">{branch.latitude != null && branch.longitude != null ? 'Location pinned' : 'Location pin missing'}</div></td><td><div className="cell-title">{[branch.pickupEnabled ? 'Pickup' : null, branch.deliveryEnabled ? 'Delivery' : null].filter(Boolean).join(' + ') || 'None'}</div><div className="cell-sub">{branch.isAcceptingOrders ? 'orders on' : 'orders paused'}</div></td><td>{humanize(branch.logisticsMode)}</td><td>{branch.deliveryZones.length === 0 ? 'No bands' : branch.deliveryZones.map((zone) => `${Number(zone.minDistanceKm)}–${Number(zone.maxDistanceKm)} km: ${Number(zone.fee) === 0 ? 'Free' : formatMoney(zone.fee, tenant.currency)}`).join(' · ')}</td><td>{branch._count?.drivers ?? 0}</td><td>{branch._count?.orders ?? 0}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-head"><div><h2>Merchant team</h2><p>{tenant.memberships.length} members</p></div></div><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Branch</th><th>Account</th><th>Last login</th></tr></thead><tbody>{tenant.memberships.map((membership) => <tr key={membership.id}><td><div className="cell-title">{displayName(membership.user)}</div><div className="cell-sub">{membership.user.email || membership.user.phone}</div></td><td>{humanize(membership.role)}</td><td>{membership.branch?.name || 'All branches'}</td><td><span className={statusClass(membership.user.isActive ? 'active' : 'inactive')}>{membership.user.isActive ? 'active' : 'disabled'}</span></td><td>{formatDate(membership.user.lastLoginAt)}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-head"><div><h2>Categories</h2><p>{tenant.categories.length} configured</p></div></div><div className="table-wrap"><table><thead><tr><th>Category</th><th>Status</th><th>Products</th><th>Sort order</th></tr></thead><tbody>{tenant.categories.map((category) => <tr key={category.id}><td><div className="cell-title">{category.name}</div><div className="cell-sub">{category.slug}</div></td><td><span className={statusClass(category.isActive ? 'active' : 'inactive')}>{category.isActive ? 'active' : 'inactive'}</span></td><td>{category._count?.products ?? 0}</td><td>{category.sortOrder}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-head"><div><h2>Recent orders</h2><p>Latest {tenant.orders.length} orders</p></div></div>{tenant.orders.length === 0 ? <div className="empty">No orders yet.</div> : <div className="table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Fulfillment</th><th>Merchandise</th><th>Delivery</th><th>Fida commission</th><th>Total</th><th>Status</th><th>Created</th></tr></thead><tbody>{tenant.orders.map((order) => <tr key={order.id}><td><div className="cell-title">{order.orderNumber}</div><div className="cell-sub">{order.branch.city || order.branch.name}</div></td><td><div className="cell-title">{displayName(order.customer)}</div><div className="cell-sub">{order.customer.email || order.customer.phone}</div></td><td><span className={statusClass(order.fulfillmentType === 'PICKUP' ? 'active' : 'available')}>{humanize(order.fulfillmentType)}</span>{order.deliveryDistanceKm != null && <div className="cell-sub">{Number(order.deliveryDistanceKm).toFixed(1)} km</div>}</td><td>{formatMoney(order.subtotal, tenant.currency)}</td><td>{order.fulfillmentType === 'PICKUP' ? '—' : formatMoney(order.deliveryFee, tenant.currency)}</td><td><strong>{formatMoney(order.platformCommissionAmount, tenant.currency)}</strong></td><td><strong>{formatMoney(order.total, tenant.currency)}</strong></td><td><span className={statusClass(order.status)}>{humanize(order.status)}</span><div className="cell-sub">{humanize(order.paymentStatus)}</div></td><td>{formatDate(order.createdAt)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}

function DriverView({ insight }: { insight: DriverInsight }) {
  const { driver } = insight;
  const operatorName = driver.operator?.tenant?.name ?? driver.operator?.name ?? 'No operator';
  return <>
    <section className="cards">
      <article className="card stat"><div className="stat-label">Deliveries</div><div className="stat-value">{driver._count?.deliveries ?? 0}</div><div className="stat-note">All assigned deliveries</div></article>
      <article className="card stat"><div className="stat-label">Connection</div><div className="stat-value">{driver.isOnline ? 'Online' : 'Offline'}</div><div className="stat-note">Last seen {formatDate(driver.lastSeenAt)}</div></article>
      <article className="card stat"><div className="stat-label">Availability</div><div className="stat-value">{driver.isAvailable ? 'Available' : 'Unavailable'}</div><div className="stat-note">Merchant enrollment {driver.isActive ? 'active' : 'disabled'}</div></article>
      <article className="card stat"><div className="stat-label">Delivery operator</div><div className="stat-value" style={{ fontSize: 18 }}>{operatorName}</div><div className="stat-note">{driver.operator ? humanize(driver.operator.type) : 'not enrolled'}</div></article>
    </section>

    <section className="panel"><div className="panel-head"><div><h2>{displayName(driver.user)}</h2><p>{driver.user.email || driver.user.phone || driver.user.id}</p></div><div className="modal-statuses"><span className={statusClass(driver.user.isActive ? 'active' : 'inactive')}>{driver.user.isActive ? 'active account' : 'disabled account'}</span><span className={statusClass(driver.isOnline ? 'active' : 'pending')}>{driver.isOnline ? 'online' : 'offline'}</span></div></div><div className="detail-grid"><article className="detail-card"><div className="detail-label">Merchant / fleet</div><div className="detail-value compact">{operatorName}</div></article><article className="detail-card"><div className="detail-label">Branch scope</div><div className="detail-value compact">{driver.branch?.name || 'All merchant branches'}</div></article><article className="detail-card"><div className="detail-label">Joined Fida</div><div className="detail-value compact">{formatDate(driver.user.createdAt)}</div></article><article className="detail-card"><div className="detail-label">Last location update</div><div className="detail-value compact">{formatDate(driver.lastSeenAt)}</div></article></div><div style={{ height: 20 }} /></section>

    <section className="panel"><div className="panel-head"><div><h2>Delivery status history</h2></div></div><div className="table-wrap"><table><thead><tr><th>Status</th><th>Deliveries</th></tr></thead><tbody>{insight.deliveryStatuses.map((row) => <tr key={row.status}><td><span className={statusClass(row.status)}>{humanize(row.status)}</span></td><td>{row.total}</td></tr>)}</tbody></table></div></section>

    <section className="panel"><div className="panel-head"><div><h2>Recent deliveries</h2><p>Latest {driver.deliveries.length} assignments</p></div></div>{driver.deliveries.length === 0 ? <div className="empty">No deliveries assigned to this driver.</div> : <div className="table-wrap"><table className="orders-table"><thead><tr><th>Order</th><th>Merchant</th><th>Customer</th><th>Total</th><th>Delivery</th><th>Order status</th><th>Assigned</th><th>Delivered</th></tr></thead><tbody>{driver.deliveries.map((delivery) => <tr key={delivery.id}><td><div className="cell-title">{delivery.order.orderNumber}</div></td><td><div className="cell-title">{delivery.order.tenant.name}</div><div className="cell-sub">{delivery.order.branch.city || delivery.order.branch.name}</div></td><td>{displayName(delivery.order.customer)}</td><td><strong>{formatMoney(delivery.order.total, delivery.order.tenant.currency)}</strong></td><td><span className={statusClass(delivery.status)}>{humanize(delivery.status)}</span></td><td><span className={statusClass(delivery.order.status)}>{humanize(delivery.order.status)}</span></td><td>{formatDate(delivery.assignedAt)}</td><td>{formatDate(delivery.deliveredAt)}</td></tr>)}</tbody></table></div>}</section>
  </>;
}
