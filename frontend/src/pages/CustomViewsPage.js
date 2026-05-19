import React, { useState } from 'react';
import MessageReachVelocityChart from '../components/MessageReachVelocityChart';
import SentimentChannelHeatmap from '../components/SentimentChannelHeatmap';
import CrisisStatementPDF from '../components/CrisisStatementPDF';
import EscalationRulesEditor from '../components/EscalationRulesEditor';

const TABS = [
  { key: 'reach',     label: 'Reach & Velocity',         kind: 'viz'     },
  { key: 'heatmap',   label: 'Sentiment Heatmap',        kind: 'viz'     },
  { key: 'statement', label: 'Crisis Statement (PDF)',   kind: 'non-viz' },
  { key: 'rules',     label: 'Escalation Rules',         kind: 'non-viz' },
];

function CustomViewsPage() {
  const [tab, setTab] = useState('reach');

  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>Crisis Views</h2>
        <p style={{ marginTop: 4, color: '#475569', fontSize: 14 }}>
          Custom crisis-communication views — 2 visualizations + 2 document/CRUD tools.
        </p>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: tab === t.key ? '#2563eb' : '#f8fafc',
              color: tab === t.key ? 'white' : '#0f172a',
              fontSize: 13,
              cursor: 'pointer',
              fontWeight: 600,
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {t.label}
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 10,
              background: t.kind === 'viz' ? (tab === t.key ? 'rgba(255,255,255,0.25)' : '#dbeafe') : (tab === t.key ? 'rgba(255,255,255,0.25)' : '#fef3c7'),
              color: tab === t.key ? 'white' : (t.kind === 'viz' ? '#1e40af' : '#92400e'),
              textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700,
            }}>{t.kind}</span>
          </button>
        ))}
      </div>

      {tab === 'reach'     && <MessageReachVelocityChart />}
      {tab === 'heatmap'   && <SentimentChannelHeatmap />}
      {tab === 'statement' && <CrisisStatementPDF />}
      {tab === 'rules'     && <EscalationRulesEditor />}
    </div>
  );
}

export default CustomViewsPage;
