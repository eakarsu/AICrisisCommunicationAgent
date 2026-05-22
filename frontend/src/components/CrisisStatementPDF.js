import React, { useState } from 'react';

// NON-VIZ: crisis statement / press-release generator — preview + PDF download.
function CrisisStatementPDF() {
  const [form, setForm] = useState({
    org: 'Acme Corporation',
    headline: 'Statement Regarding Recent Service Disruption',
    spokesperson: 'Jane Smith, Chief Communications Officer',
    severity: 'SEV-2',
    audience: 'Customers, partners, and the public',
    incident_ref: `INC-${new Date().getFullYear()}-1042`,
    dateline: new Date().toUTCString().split(' ').slice(1, 4).join(' '),
  });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const buildQS = (extra = {}) => {
    const all = { ...form, ...extra };
    return Object.entries(all)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  };

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`/api/custom-views/crisis-statement-pdf?${buildQS()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const downloadPdf = () => {
    const token = localStorage.getItem('token');
    const url = `/api/custom-views/crisis-statement-pdf?${buildQS({ format: 'pdf' })}`;
    fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = `crisis-statement-${form.incident_ref}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      })
      .catch((e) => setError(e.message));
  };

  return (
    <div className="ai-studio-card" data-testid="crisis-statement-pdf" style={{ maxWidth: 1000, background: 'white', borderRadius: 10, padding: 18, border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Crisis Statement / Press Release (PDF)</h3>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>
        Generate an official crisis statement for distribution. Preview as JSON, then download a formatted PDF.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Field label="Organization">
          <input value={form.org} onChange={(e) => set('org', e.target.value)} />
        </Field>
        <Field label="Severity Tier">
          <select value={form.severity} onChange={(e) => set('severity', e.target.value)}>
            {['SEV-1', 'SEV-2', 'SEV-3', 'SEV-4', 'SEV-5'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Headline" full>
          <input value={form.headline} onChange={(e) => set('headline', e.target.value)} />
        </Field>
        <Field label="Spokesperson">
          <input value={form.spokesperson} onChange={(e) => set('spokesperson', e.target.value)} />
        </Field>
        <Field label="Incident Reference">
          <input value={form.incident_ref} onChange={(e) => set('incident_ref', e.target.value)} />
        </Field>
        <Field label="Target Audience" full>
          <input value={form.audience} onChange={(e) => set('audience', e.target.value)} />
        </Field>
        <Field label="Dateline">
          <input value={form.dateline} onChange={(e) => set('dateline', e.target.value)} />
        </Field>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button
          onClick={generate} disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}
        >
          {loading ? 'Generating...' : 'Preview Statement'}
        </button>
        <button
          onClick={downloadPdf} disabled={loading}
          style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', color: '#0f172a', cursor: 'pointer', fontWeight: 600 }}
        >
          Download PDF
        </button>
      </div>

      {error && <div style={{ padding: 8, color: '#dc2626' }}>Error: {error}</div>}

      {data && (
        <div style={{
          border: '2px solid #b91c1c', borderRadius: 10, padding: 22, background: '#fef2f2',
          fontFamily: 'Georgia, serif',
        }}>
          <div style={{ textAlign: 'center', borderBottom: '1px solid #fecaca', paddingBottom: 10, marginBottom: 12 }}>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#7f1d1d' }}>OFFICIAL CRISIS COMMUNICATION</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#7f1d1d' }}>{data.organization}</div>
            <div style={{ fontSize: 12, color: '#991b1b' }}>{data.severity_tier} • {data.statement_id}</div>
          </div>

          <h4 style={{ color: '#0f172a', margin: '6px 0', fontFamily: 'system-ui' }}>{data.headline}</h4>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10, fontFamily: 'system-ui' }}>
            {data.dateline} — {data.organization}
          </div>

          <Row k="Issued"         v={new Date(data.issued_at).toLocaleString()} />
          <Row k="Incident Ref"   v={data.incident_ref} />
          <Row k="Spokesperson"   v={data.spokesperson} />
          <Row k="Target Audience" v={data.target_audience} />
          <Row k="Next Update"    v={new Date(data.next_update).toLocaleString()} />

          <div style={{
            marginTop: 14, padding: 12, background: 'white', borderLeft: '3px solid #b91c1c',
            borderRadius: 4, fontSize: 13, lineHeight: 1.55, color: '#0f172a', fontFamily: 'system-ui',
          }}>
            <p style={{ marginTop: 0, fontWeight: 600 }}>{data.lead}</p>
            {data.body.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
            <p style={{ fontStyle: 'italic', color: '#7f1d1d' }}>{data.quote}</p>
          </div>

          <div style={{ marginTop: 12, padding: 10, background: '#fee2e2', borderRadius: 6, fontSize: 12, fontFamily: 'system-ui' }}>
            <strong>Media Contacts:</strong><br />
            Media: {data.contacts.media} | IR: {data.contacts.investor_relations} | Support: {data.contacts.customer_support}
          </div>

          <div style={{ marginTop: 12, fontSize: 11, color: '#7f1d1d', fontFamily: 'system-ui' }}>
            {data.boilerplate}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{label}</span>
      <span style={{ display: 'block' }}>
        {React.Children.map(children, (c) =>
          React.cloneElement(c, {
            style: {
              padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6,
              fontSize: 13, width: '100%', boxSizing: 'border-box', ...(c.props.style || {}),
            },
          })
        )}
      </span>
    </label>
  );
}

function Row({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 13, borderBottom: '1px dashed #fecaca', fontFamily: 'system-ui' }}>
      <span style={{ color: '#7f1d1d', fontWeight: 600 }}>{k}</span>
      <span style={{ color: '#0f172a' }}>{v}</span>
    </div>
  );
}

export default CrisisStatementPDF;
