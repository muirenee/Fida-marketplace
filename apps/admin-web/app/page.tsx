const cards = [
  ['Tenants', '0'],
  ['Orders today', '0'],
  ['Active drivers', '0'],
  ['Gross marketplace value', 'RWF 0'],
];

export default function Home() {
  return (
    <main style={{ padding: 32, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 14, opacity: .6 }}>FIDA</div>
        <h1 style={{ margin: '4px 0 8px' }}>Marketplace Control Center</h1>
        <p style={{ margin: 0, opacity: .7 }}>Multi-tenant commerce and delivery operations.</p>
      </div>
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 16 }}>
        {cards.map(([label, value]) => (
          <article key={label} style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 6px 24px rgba(0,0,0,.05)' }}>
            <div style={{ fontSize: 13, opacity: .6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, marginTop: 8 }}>{value}</div>
          </article>
        ))}
      </section>
    </main>
  );
}
