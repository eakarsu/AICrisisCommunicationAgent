import React, { useEffect, useState } from 'react';

// VIZ: sentiment heatmap (channel x time-of-day, red-yellow-green ramp).
function SentimentChannelHeatmap() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch('/api/custom-views/sentiment-channel-heatmap', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading sentiment heatmap...</div>;
  if (error)   return <div style={{ padding: 24, color: '#dc2626' }}>Error: {error}</div>;
  if (!data)   return null;

  const { channels, slots, matrix, min_sentiment, max_sentiment } = data;

  // Map sentiment in [-1, +1] to red→yellow→green
  const colorFor = (s) => {
    const t = Math.max(0, Math.min(1, (s + 1) / 2));
    const stops = [
      [220, 38, 38],   // red (very negative)
      [248, 113, 113],
      [251, 191, 36],  // amber
      [250, 204, 21],  // yellow
      [163, 230, 53],
      [34, 197, 94],   // green (very positive)
      [22, 163, 74],
    ];
    const idx = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
    const f = (t * (stops.length - 1)) - idx;
    const a = stops[idx], b = stops[idx + 1];
    const mix = a.map((ch, i) => Math.round(ch + (b[i] - ch) * f));
    return `rgb(${mix[0]}, ${mix[1]}, ${mix[2]})`;
  };

  const fmtPct = (v) => `${(v * 100).toFixed(0)}`;

  return (
    <div className="ai-studio-card" data-testid="sentiment-heatmap" style={{ maxWidth: 1100, background: 'white', borderRadius: 10, padding: 18, border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 6px 0', color: '#0f172a' }}>Sentiment Heatmap — Channel × Time</h3>
      <p style={{ fontSize: 13, color: '#475569', marginTop: 0 }}>{data.summary}</p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: 4, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 10px', color: '#64748b', fontWeight: 600 }}>Channel \\ Slot (UTC)</th>
              {slots.map((s) => (
                <th key={s} style={{ textAlign: 'center', padding: '6px 4px', color: '#475569', fontWeight: 600, minWidth: 64 }}>
                  {s}
                </th>
              ))}
              <th style={{ textAlign: 'center', padding: '6px 8px', color: '#0f172a' }}>Avg</th>
            </tr>
          </thead>
          <tbody>
            {channels.map((c) => {
              const avg = slots.reduce((s, sl) => s + matrix[c][sl].sentiment, 0) / slots.length;
              return (
                <tr key={c}>
                  <td style={{ padding: '4px 10px', fontWeight: 600, color: '#0f172a' }}>{c}</td>
                  {slots.map((s) => {
                    const cell = matrix[c][s];
                    const v = cell.sentiment;
                    return (
                      <td
                        key={s}
                        title={`${c} • ${s}: sentiment ${v.toFixed(2)}, volume ${cell.volume.toLocaleString()}`}
                        style={{
                          background: colorFor(v),
                          color: Math.abs(v) > 0.5 ? 'white' : '#0f172a',
                          padding: '10px 6px',
                          textAlign: 'center',
                          borderRadius: 6,
                          fontWeight: 700,
                          fontSize: 11,
                          minWidth: 56,
                        }}
                      >
                        {fmtPct(v)}
                      </td>
                    );
                  })}
                  <td style={{ padding: '8px 10px', fontWeight: 700, color: avg < 0 ? '#dc2626' : '#16a34a' }}>{fmtPct(avg)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 11, color: '#475569' }}>
        <span>Negative</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[-1, -0.66, -0.33, 0, 0.33, 0.66, 1].map((s, i) => (
            <span key={i} style={{ width: 22, height: 12, background: colorFor(s), borderRadius: 2 }} />
          ))}
        </div>
        <span>Positive</span>
        <span style={{ marginLeft: 12 }}>Values are sentiment × 100 ({min_sentiment.toFixed(2)} … {max_sentiment.toFixed(2)})</span>
      </div>

      <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <Stat label="Channels" value={channels.length} />
        <Stat label="Time Slots" value={slots.length} />
        <Stat label="Worst Channel" value={Object.entries(data.totals_by_channel).sort((a, b) => a[1] - b[1])[0][0]} />
        <Stat label="Best Channel"  value={Object.entries(data.totals_by_channel).sort((a, b) => b[1] - a[1])[0][0]} />
        <Stat label="Source" value={data.source} />
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{value}</div>
    </div>
  );
}

export default SentimentChannelHeatmap;
