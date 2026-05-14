import React, { useState, useEffect } from 'react';
import {
  getCrisisIncidents,
  mediaAlert,
  notificationCascade,
  severityScore,
  consistencyCheck,
  templateRecommender,
  impactForecast,
  competitorMentions,
  draftPressRelease,
  predictEscalation,
  autoGenerateTalkingPoints,
  recommendTactics,
  getSentimentTrend,
  getAIResults,
} from '../services/api';

const TOOLS = [
  { id: 'severity-score',       label: 'Crisis Severity Scorer',     desc: 'AI rates severity 0-10; auto-escalates if >=8.', fields: ['incident_id'] },
  { id: 'consistency-check',    label: 'Message Consistency Checker', desc: 'Check talking points / press / social for contradictions.', fields: ['incident_id'] },
  { id: 'template-recommender', label: 'Template Recommender',        desc: 'Pick best response template for crisis.',          fields: ['incident_id'] },
  { id: 'impact-forecast',      label: 'Impact Forecaster',          desc: 'Predict duration, financial & reputation impact.', fields: ['incident_id'] },
  { id: 'media-alert',          label: 'Automated Media Alert',      desc: 'Classify a new media mention.',                    fields: ['incident_id', 'mention_text'] },
  { id: 'notification-cascade', label: 'Notification Cascade',       desc: 'Personalize and tier-route stakeholder messages.',  fields: ['incident_id', 'message_template'] },
  { id: 'competitor-mentions',  label: 'Competitor Mention Tracker', desc: 'Find opportunistic competitor messaging.',          fields: ['incident_id', 'competitor_names'] },
  { id: 'draft-press-release',          label: 'Draft Press Release',          desc: 'Auto-draft a publication-ready press release for an incident.',  fields: ['incident_id', 'audience'] },
  { id: 'predict-escalation',           label: 'Predict Escalation',           desc: 'Forecast 24/48/72h escalation probability and proactive actions.', fields: ['incident_id'] },
  { id: 'auto-generate-talking-points', label: 'Auto Talking Points',          desc: 'Generate audience-tailored talking points across channels.',       fields: ['incident_id', 'audiences'] },
  { id: 'recommend-tactics',            label: 'Tactical Playbook',            desc: 'Build a sequenced tactical playbook with channels and owners.',    fields: ['incident_id', 'stakeholder_ids'] },
];

const callMap = {
  'severity-score': severityScore,
  'consistency-check': consistencyCheck,
  'template-recommender': templateRecommender,
  'impact-forecast': impactForecast,
  'media-alert': mediaAlert,
  'notification-cascade': notificationCascade,
  'competitor-mentions': competitorMentions,
  'draft-press-release': draftPressRelease,
  'predict-escalation': predictEscalation,
  'auto-generate-talking-points': autoGenerateTalkingPoints,
  'recommend-tactics': recommendTactics,
};

export default function AIAdvanced() {
  const [tool, setTool] = useState(TOOLS[0]);
  const [incidents, setIncidents] = useState([]);
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [trend, setTrend] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await getCrisisIncidents();
        setIncidents(r.data?.data || r.data || []);
      } catch {}
      reloadHistory();
      reloadTrend();
    })();
  }, []);

  const reloadHistory = async () => {
    try {
      const r = await getAIResults({ limit: 20 });
      setHistory(r.data?.data || []);
    } catch {}
  };
  const reloadTrend = async () => {
    try {
      const r = await getSentimentTrend({ hours: 24 });
      setTrend(r.data);
    } catch {}
  };

  const submit = async () => {
    setLoading(true); setResult(null);
    try {
      const body = { ...form };
      if (body.incident_id) body.incident_id = parseInt(body.incident_id);
      if (tool.id === 'competitor-mentions' && typeof body.competitor_names === 'string') {
        body.competitor_names = body.competitor_names.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (tool.id === 'auto-generate-talking-points' && typeof body.audiences === 'string') {
        body.audiences = body.audiences.split(',').map((s) => s.trim()).filter(Boolean);
        if (body.audiences.length === 0) delete body.audiences;
      }
      if (tool.id === 'recommend-tactics' && typeof body.stakeholder_ids === 'string') {
        body.stakeholder_ids = body.stakeholder_ids.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
        if (body.stakeholder_ids.length === 0) delete body.stakeholder_ids;
      }
      if (tool.id === 'draft-press-release' && body.audience === '') delete body.audience;
      const r = await callMap[tool.id](body);
      setResult(r.data);
      reloadHistory();
    } catch (err) {
      setResult({ error: err.response?.data?.error || err.message });
    }
    setLoading(false);
  };

  const renderField = (f) => {
    if (f === 'incident_id') {
      return (
        <select value={form.incident_id || ''} onChange={(e) => setForm({ ...form, incident_id: e.target.value })}>
          <option value="">— Select incident —</option>
          {incidents.map((i) => <option key={i.id} value={i.id}>#{i.id} {i.title} ({i.severity})</option>)}
        </select>
      );
    }
    if (f === 'mention_text' || f === 'message_template') {
      return <textarea rows={4} value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} placeholder={f} />;
    }
    if (f === 'competitor_names') {
      return <input value={form[f] || ''} placeholder="Comma-separated competitor names" onChange={(e) => setForm({ ...form, [f]: e.target.value })} />;
    }
    if (f === 'audiences') {
      return <input value={form[f] || ''} placeholder="Comma-separated audiences (default: employees,media,customers,investors)" onChange={(e) => setForm({ ...form, [f]: e.target.value })} />;
    }
    if (f === 'stakeholder_ids') {
      return <input value={form[f] || ''} placeholder="Comma-separated stakeholder IDs (optional)" onChange={(e) => setForm({ ...form, [f]: e.target.value })} />;
    }
    if (f === 'audience') {
      return <input value={form[f] || ''} placeholder="Audience (e.g. media, investors, employees) — optional" onChange={(e) => setForm({ ...form, [f]: e.target.value })} />;
    }
    return <input value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} placeholder={f} />;
  };

  return (
    <div style={{ padding: 24 }}>
      <h1>AI Advanced</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>Specialized crisis analytics & automation</p>

      {trend && (
        <div style={{ padding: 16, background: '#f8f9fb', borderRadius: 8, marginBottom: 24, border: '1px solid #e5e7eb' }}>
          <strong>24h Sentiment Trend</strong>
          {' — '} buckets: {trend.summary?.bucket_count || 0}
          {' | avg: '} {trend.summary?.avg_sentiment || 0}
          {' | alert: '} <span style={{
            padding: '2px 8px', borderRadius: 4, fontWeight: 600,
            background: trend.alert_level === 'red' ? '#fee2e2' : trend.alert_level === 'amber' ? '#fef3c7' : '#dcfce7',
            color: trend.alert_level === 'red' ? '#b91c1c' : trend.alert_level === 'amber' ? '#92400e' : '#166534',
          }}>{trend.alert_level}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTool(t); setForm({}); setResult(null); }}
            style={{
              textAlign: 'left',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid ' + (tool.id === t.id ? '#3b82f6' : '#e5e7eb'),
              background: tool.id === t.id ? '#eff6ff' : '#fff',
              cursor: 'pointer',
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.label}</div>
            <div style={{ fontSize: 12, color: '#666' }}>{t.desc}</div>
          </button>
        ))}
      </div>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 24 }}>
        <h3>{tool.label}</h3>
        {tool.fields.map((f) => (
          <div key={f} style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600 }}>{f}</label>
            {renderField(f)}
          </div>
        ))}
        <button
          onClick={submit}
          disabled={loading}
          style={{ padding: '10px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
        >
          {loading ? 'Running…' : 'Run AI'}
        </button>
      </div>

      {result && (
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 24 }}>
          <h3>Result</h3>
          <pre style={{ overflow: 'auto', background: '#0f172a', color: '#e2e8f0', padding: 16, borderRadius: 6, fontSize: 12 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      {history.length > 0 && (
        <div style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #e5e7eb' }}>
          <h3>Recent AI Runs</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: 8 }}>Endpoint</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Entity</th>
                <th style={{ textAlign: 'left', padding: 8 }}>Model</th>
                <th style={{ textAlign: 'left', padding: 8 }}>When</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: 8 }}>{h.endpoint}</td>
                  <td style={{ padding: 8 }}>{h.entity_type ? `${h.entity_type} #${h.entity_id}` : '—'}</td>
                  <td style={{ padding: 8 }}>{h.model || '—'}</td>
                  <td style={{ padding: 8 }}>{new Date(h.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
