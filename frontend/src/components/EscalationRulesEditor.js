import React, { useEffect, useState } from 'react';

// NON-VIZ: escalation rules (severity tiers) CRUD editor.
const EMPTY = {
  tier: 'SEV-X', name: '',
  threshold_reach: 100000, threshold_negative_pct: 40,
  notify_roles: 'PR Manager,Social Lead',
  response_sla_minutes: 60, war_room: false,
  auto_press_release: false, auto_holding_statement: false,
  channels: 'email,slack',
  status: 'draft', description: '',
};

const STATUSES = ['active', 'draft', 'archived'];

function EscalationRulesEditor() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const token = () => localStorage.getItem('token');
  const authHeaders = (extra = {}) => {
    const t = token();
    return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...extra };
  };

  const load = () => {
    setLoading(true);
    fetch('/api/custom-views/escalation-rules', { headers: authHeaders() })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const method = editing.id ? 'PUT' : 'POST';
      const url = editing.id
        ? `/api/custom-views/escalation-rules/${editing.id}`
        : '/api/custom-views/escalation-rules';
      const r = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(editing) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setEditing(null);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this escalation tier?')) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/custom-views/escalation-rules/${id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading escalation rules...</div>;
  if (error && !data) return <div style={{ padding: 24, color: '#dc2626' }}>Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="ai-studio-card" data-testid="escalation-rules" style={{ maxWidth: 1200, background: 'white', borderRadius: 10, padding: 18, border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Escalation Rules — Severity Tier Editor</h3>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>{data.summary}</p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(data.by_status || {}).map(([k, v]) => (
            <span key={k} style={{
              fontSize: 11, padding: '4px 10px', background: k === 'active' ? '#dcfce7' : k === 'draft' ? '#fef3c7' : '#fee2e2',
              color: k === 'active' ? '#166534' : k === 'draft' ? '#92400e' : '#991b1b',
              borderRadius: 999, fontWeight: 600,
            }}>{k}: {v}</span>
          ))}
          <span style={{ fontSize: 11, padding: '4px 10px', background: '#dbeafe', color: '#1e40af', borderRadius: 999, fontWeight: 600 }}>
            war-room: {data.war_room_tiers}
          </span>
        </div>
        <button
          onClick={() => setEditing({ ...EMPTY })} disabled={busy}
          style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}
        >
          + New Tier
        </button>
      </div>

      {error && <div style={{ padding: 8, color: '#dc2626' }}>Error: {error}</div>}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <Th>Tier</Th><Th>Name</Th><Th>Reach ≥</Th><Th>Neg %</Th>
              <Th>SLA (min)</Th><Th>War Room</Th><Th>Auto PR</Th>
              <Th>Channels</Th><Th>Notify</Th><Th>Status</Th><Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {data.rules.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <Td><code style={{ fontWeight: 700, color: r.tier.includes('1') ? '#b91c1c' : r.tier.includes('2') ? '#c2410c' : '#0f172a' }}>{r.tier}</code></Td>
                <Td>{r.name}</Td>
                <Td>{r.threshold_reach >= 1e6 ? `${(r.threshold_reach / 1e6).toFixed(1)}M` : `${(r.threshold_reach / 1e3).toFixed(0)}k`}</Td>
                <Td>{r.threshold_negative_pct}%</Td>
                <Td>{r.response_sla_minutes}</Td>
                <Td>{r.war_room ? <span style={{ color: '#b91c1c', fontWeight: 700 }}>YES</span> : 'no'}</Td>
                <Td>{r.auto_press_release ? <span style={{ color: '#1d4ed8', fontWeight: 700 }}>YES</span> : 'no'}</Td>
                <Td><span style={{ fontSize: 11 }}>{r.channels}</span></Td>
                <Td><span style={{ fontSize: 11 }}>{r.notify_roles}</span></Td>
                <Td>
                  <span style={{
                    padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    background: r.status === 'active' ? '#dcfce7' : r.status === 'draft' ? '#fef3c7' : '#fee2e2',
                    color: r.status === 'active' ? '#166534' : r.status === 'draft' ? '#92400e' : '#991b1b',
                    textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>{r.status}</span>
                </Td>
                <Td>
                  <button
                    onClick={() => setEditing({ ...r })}
                    style={{ padding: '3px 10px', marginRight: 4, border: '1px solid #cbd5e1', background: '#f8fafc', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >Edit</button>
                  <button
                    onClick={() => remove(r.id)} disabled={busy}
                    style={{ padding: '3px 10px', border: '1px solid #fecaca', background: '#fef2f2', color: '#991b1b', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}
                  >Delete</button>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div style={{
          marginTop: 16, padding: 16, border: '2px solid #2563eb', borderRadius: 10, background: '#eff6ff',
        }}>
          <h4 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>{editing.id ? `Edit Tier #${editing.id}` : 'New Severity Tier'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <F label="Tier Code"><input value={editing.tier} onChange={(e) => setEditing({ ...editing, tier: e.target.value })} /></F>
            <F label="Name"><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></F>
            <F label="Reach Threshold"><input type="number" value={editing.threshold_reach} onChange={(e) => setEditing({ ...editing, threshold_reach: Number(e.target.value) })} /></F>
            <F label="Negative % Threshold"><input type="number" value={editing.threshold_negative_pct} onChange={(e) => setEditing({ ...editing, threshold_negative_pct: Number(e.target.value) })} /></F>
            <F label="Response SLA (minutes)"><input type="number" value={editing.response_sla_minutes} onChange={(e) => setEditing({ ...editing, response_sla_minutes: Number(e.target.value) })} /></F>
            <F label="Status">
              <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </F>
            <F label="War Room">
              <select value={String(editing.war_room)} onChange={(e) => setEditing({ ...editing, war_room: e.target.value === 'true' })}>
                <option value="true">yes</option><option value="false">no</option>
              </select>
            </F>
            <F label="Auto Press Release">
              <select value={String(editing.auto_press_release)} onChange={(e) => setEditing({ ...editing, auto_press_release: e.target.value === 'true' })}>
                <option value="true">yes</option><option value="false">no</option>
              </select>
            </F>
            <F label="Auto Holding Statement">
              <select value={String(editing.auto_holding_statement)} onChange={(e) => setEditing({ ...editing, auto_holding_statement: e.target.value === 'true' })}>
                <option value="true">yes</option><option value="false">no</option>
              </select>
            </F>
            <F label="Channels (csv)"><input value={editing.channels} onChange={(e) => setEditing({ ...editing, channels: e.target.value })} /></F>
            <F label="Notify Roles (csv)" full><input value={editing.notify_roles} onChange={(e) => setEditing({ ...editing, notify_roles: e.target.value })} /></F>
            <F label="Description" full>
              <textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </F>
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={save} disabled={busy || !editing.tier || !editing.name}
              style={{ padding: '8px 14px', borderRadius: 6, border: 'none', background: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}
            >
              {busy ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(null)} disabled={busy}
              style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', fontWeight: 600 }}
            >Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }) {
  return <th style={{ padding: '8px 10px', fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>{children}</th>;
}
function Td({ children }) {
  return <td style={{ padding: '6px 10px', verticalAlign: 'middle' }}>{children}</td>;
}
function F({ label, children, full }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gridColumn: full ? '1 / -1' : undefined }}>
      <span style={{ fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>{label}</span>
      {React.Children.map(children, (c) => React.cloneElement(c, {
        style: { padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', ...(c.props.style || {}) },
      }))}
    </label>
  );
}

export default EscalationRulesEditor;
