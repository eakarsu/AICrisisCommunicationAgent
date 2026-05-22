import React, { useEffect, useState } from 'react';

// VIZ: message reach + velocity over time (dual-axis area + bar overlay).
function MessageReachVelocityChart() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(48);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('token');
    fetch(`/api/custom-views/message-reach-velocity?hours=${hours}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [hours]);

  if (loading) return <div style={{ padding: 24 }}>Loading reach + velocity...</div>;
  if (error)   return <div style={{ padding: 24, color: '#dc2626' }}>Error: {error}</div>;
  if (!data)   return null;

  const W = 800, H = 340, PAD_L = 64, PAD_R = 64, PAD_T = 18, PAD_B = 50;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const series = data.series || [];
  const maxReach = Math.max(1, ...series.map((s) => s.reach));
  const maxVel = Math.max(1, ...series.map((s) => s.velocity));

  const x = (i) => PAD_L + (i / Math.max(1, series.length - 1)) * innerW;
  const yR = (v) => PAD_T + (1 - v / maxReach) * innerH;
  const yV = (v) => PAD_T + (1 - v / maxVel) * innerH;

  const reachPath = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yR(s.reach)}`).join(' ');
  const reachFill = reachPath + ` L ${x(series.length - 1)} ${PAD_T + innerH} L ${x(0)} ${PAD_T + innerH} Z`;
  const velPath  = series.map((s, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yV(s.velocity)}`).join(' ');

  return (
    <div className="ai-studio-card" data-testid="reach-velocity" style={{ maxWidth: 1000, background: 'white', borderRadius: 10, padding: 18, border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Message Reach &amp; Velocity</h3>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>{data.summary}</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: '#475569' }}>Window (hours):</label>
        {[24, 48, 72, 168].map((m) => (
          <button
            key={m}
            onClick={() => setHours(m)}
            style={{
              padding: '6px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
              background: m === hours ? '#2563eb' : '#f8fafc',
              color: m === hours ? 'white' : '#0f172a',
              fontSize: 12, cursor: 'pointer', fontWeight: 600,
            }}
          >
            {m === 168 ? '7d' : `${m}h`}
          </button>
        ))}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} role="img" aria-label="Message reach and velocity over time" style={{ background: '#fafafa', borderRadius: 8 }}>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
            const yy = PAD_T + innerH * (1 - t);
            return (
              <g key={i}>
                <line x1={PAD_L} x2={W - PAD_R} y1={yy} y2={yy} stroke="#e5e7eb" strokeDasharray="3 3" />
                <text x={PAD_L - 8} y={yy + 4} fontSize="10" textAnchor="end" fill="#64748b">
                  {(maxReach * t / 1e6).toFixed(1)}M
                </text>
                <text x={W - PAD_R + 8} y={yy + 4} fontSize="10" textAnchor="start" fill="#b45309">
                  {Math.round(maxVel * t / 1000)}k/h
                </text>
              </g>
            );
          })}

          <path d={reachFill} fill="#3b82f6" opacity="0.18" />
          <path d={reachPath} fill="none" stroke="#1d4ed8" strokeWidth="2.4" />
          <path d={velPath} fill="none" stroke="#d97706" strokeWidth="2" strokeDasharray="5 3" />

          {series.map((s, i) => {
            if (i % Math.ceil(series.length / 8) !== 0) return null;
            return (
              <text key={i} x={x(i)} y={H - PAD_B + 16} fontSize="9" textAnchor="middle" fill="#475569">
                {s.label}
              </text>
            );
          })}

          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + innerH} y2={PAD_T + innerH} stroke="#9ca3af" />
          <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={PAD_T + innerH} stroke="#9ca3af" />
          <line x1={W - PAD_R} x2={W - PAD_R} y1={PAD_T} y2={PAD_T + innerH} stroke="#fcd34d" strokeDasharray="2 2" />
        </svg>
      </div>

      <div style={{ display: 'flex', gap: 18, fontSize: 12, marginTop: 8, flexWrap: 'wrap' }}>
        <Legend color="#1d4ed8" label="Reach (impressions)" swatchOpacity={1} />
        <Legend color="#d97706" label="Velocity (reach/hr)" dashed />
      </div>

      <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        <Stat label="Total Reach" value={(data.totals.total_reach / 1e6).toFixed(2) + 'M'} />
        <Stat label="Total Mentions" value={data.totals.total_mentions.toLocaleString()} />
        <Stat label="Peak Reach" value={(data.totals.peak_reach / 1e6).toFixed(2) + 'M'} />
        <Stat label="Peak At" value={data.totals.peak_label} />
        <Stat label="Avg Velocity" value={data.totals.avg_velocity.toLocaleString() + '/h'} />
        <Stat label="Source" value={data.source} />
      </div>
    </div>
  );
}

function Legend({ color, label, dashed, swatchOpacity }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        display: 'inline-block', width: 22, height: 4,
        background: dashed ? 'transparent' : color, borderRadius: 2,
        opacity: swatchOpacity ?? 1,
        borderTop: dashed ? `3px dashed ${color}` : undefined,
      }} />
      <span>{label}</span>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{value}</div>
    </div>
  );
}

export default MessageReachVelocityChart;
