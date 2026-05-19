// Custom Crisis Comm Views — 4 feature endpoints aligned with spec.
//   VIZ:     /message-reach-velocity   — message reach + velocity over time
//            /sentiment-channel-heatmap — sentiment heatmap (channel x time)
//   NON-VIZ: /crisis-statement-pdf      — crisis statement / press-release (PDF)
//            /escalation-rules          — escalation rules editor (CRUD severity tiers)
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ─── helpers ─────────────────────────────────────────────────────────────────
function seededRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

async function safeQuery(sql, params = []) {
  try {
    const r = await pool.query(sql, params);
    return r.rows;
  } catch (_) {
    return null;
  }
}

// In-memory store for escalation rules (CRUD). Survives until process restart.
let RULE_SEQ = 6;
const RULES = [
  {
    id: 1, tier: 'SEV-1', name: 'Catastrophic / Existential',
    threshold_reach: 5000000, threshold_negative_pct: 70,
    notify_roles: 'CEO,CCO,General Counsel,Board',
    response_sla_minutes: 15, war_room: true,
    auto_press_release: true, auto_holding_statement: true,
    channels: 'phone,sms,email,slack,pager',
    status: 'active',
    description: 'Brand-defining event: loss of life, regulator action, mass data breach. Activate full crisis war room within 15 minutes.',
    updated_at: new Date().toISOString(),
  },
  {
    id: 2, tier: 'SEV-2', name: 'Major / Multi-Region Impact',
    threshold_reach: 1000000, threshold_negative_pct: 55,
    notify_roles: 'CCO,VP Comms,VP Legal,Head of PR',
    response_sla_minutes: 30, war_room: true,
    auto_press_release: true, auto_holding_statement: true,
    channels: 'sms,email,slack',
    status: 'active',
    description: 'Major news cycle event: viral negative coverage, executive misconduct, large-scale outage. 30-minute SLA, draft press release auto-queued.',
    updated_at: new Date().toISOString(),
  },
  {
    id: 3, tier: 'SEV-3', name: 'Significant / Regional',
    threshold_reach: 250000, threshold_negative_pct: 40,
    notify_roles: 'VP Comms,PR Manager,Social Lead',
    response_sla_minutes: 60, war_room: false,
    auto_press_release: false, auto_holding_statement: true,
    channels: 'email,slack',
    status: 'active',
    description: 'Trending negative coverage in a single market or vertical. Holding statement within 1 hour; monitor for escalation.',
    updated_at: new Date().toISOString(),
  },
  {
    id: 4, tier: 'SEV-4', name: 'Moderate / Localized',
    threshold_reach: 50000, threshold_negative_pct: 30,
    notify_roles: 'PR Manager,Social Lead,Community Manager',
    response_sla_minutes: 120, war_room: false,
    auto_press_release: false, auto_holding_statement: false,
    channels: 'email,slack',
    status: 'active',
    description: 'Customer complaint cluster, single-channel incident. Respond within 2 hours via social/customer support.',
    updated_at: new Date().toISOString(),
  },
  {
    id: 5, tier: 'SEV-5', name: 'Minor / Watch',
    threshold_reach: 5000, threshold_negative_pct: 20,
    notify_roles: 'Social Lead,Community Manager',
    response_sla_minutes: 240, war_room: false,
    auto_press_release: false, auto_holding_statement: false,
    channels: 'slack',
    status: 'active',
    description: 'Isolated negative posts or chatter below escalation threshold. Log + observe; respond if velocity climbs.',
    updated_at: new Date().toISOString(),
  },
  {
    id: 6, tier: 'SEV-1H', name: 'High-Risk Health & Safety (Draft)',
    threshold_reach: 100000, threshold_negative_pct: 50,
    notify_roles: 'CEO,Chief Medical Officer,General Counsel,VP Safety',
    response_sla_minutes: 10, war_room: true,
    auto_press_release: true, auto_holding_statement: true,
    channels: 'phone,sms,email,pager',
    status: 'draft',
    description: 'Health/safety variant of SEV-1 for regulated industries (pharma, food, aviation). Awaiting Legal sign-off.',
    updated_at: new Date().toISOString(),
  },
];

// ─── 1. VIZ: Message Reach + Velocity over time ─────────────────────────────
router.get('/message-reach-velocity', async (req, res) => {
  try {
    const hours = Math.min(Math.max(Number(req.query.hours) || 48, 12), 168);
    const bucketMinutes = hours <= 24 ? 60 : hours <= 72 ? 120 : 240;
    const buckets = Math.ceil((hours * 60) / bucketMinutes);
    const rand = seededRand(20260518);

    // Try live: aggregate media_monitoring reach per time bucket
    const live = await safeQuery(`
      SELECT
        date_trunc('hour', COALESCE(published_at, created_at)) AS bucket,
        COALESCE(SUM(reach), 0)::bigint AS reach,
        COUNT(*)::int AS mentions
      FROM media_monitoring
      WHERE COALESCE(published_at, created_at) >= NOW() - ($1::int || ' hours')::interval
      GROUP BY bucket
      ORDER BY bucket
    `, [hours]);

    const now = Date.now();
    const series = [];
    // Synthesize a viral-curve: ramp up, peak, decay
    const peakBucket = Math.floor(buckets * 0.4);
    const peakReach = 2_400_000;
    for (let i = 0; i < buckets; i++) {
      const ts = new Date(now - (buckets - 1 - i) * bucketMinutes * 60 * 1000);
      const label = `${String(ts.getHours()).padStart(2, '0')}:00 ${ts.getMonth() + 1}/${ts.getDate()}`;
      const dist = Math.abs(i - peakBucket);
      const decay = Math.exp(-Math.pow(dist / (buckets * 0.25), 2));
      const reach = Math.round(peakReach * decay * (0.7 + rand() * 0.6));
      const mentions = Math.round(reach / 1800 * (0.7 + rand() * 0.6));
      series.push({
        bucket: ts.toISOString(),
        label,
        reach,
        mentions,
        velocity: 0, // filled below
      });
    }

    // Overlay live data where present
    if (live && live.length) {
      const liveMap = new Map(live.map((r) => [new Date(r.bucket).getTime(), { reach: Number(r.reach), mentions: Number(r.mentions) }]));
      for (const row of series) {
        const t = new Date(row.bucket).getTime();
        // Snap to closest hourly bucket
        const closest = [...liveMap.keys()].find((k) => Math.abs(k - t) < 60 * 60 * 1000);
        if (closest != null) {
          const lv = liveMap.get(closest);
          row.reach_live = lv.reach;
          row.mentions_live = lv.mentions;
        }
      }
    }

    // Velocity = first-derivative of cumulative reach (reach per hour)
    for (let i = 0; i < series.length; i++) {
      const prev = i > 0 ? series[i - 1].reach : 0;
      const dr = series[i].reach - prev;
      series[i].velocity = Math.max(0, Math.round(dr / (bucketMinutes / 60)));
    }

    const totalReach = series.reduce((s, r) => s + r.reach, 0);
    const totalMentions = series.reduce((s, r) => s + r.mentions, 0);
    const peakIdx = series.reduce((m, r, i) => (r.reach > series[m].reach ? i : m), 0);

    res.json({
      generated_at: new Date().toISOString(),
      hours,
      bucket_minutes: bucketMinutes,
      series,
      totals: {
        total_reach: totalReach,
        total_mentions: totalMentions,
        peak_reach: series[peakIdx].reach,
        peak_label: series[peakIdx].label,
        avg_velocity: Math.round(series.reduce((s, r) => s + r.velocity, 0) / series.length),
      },
      source: live && live.length ? 'live+synthesized' : 'synthesized',
      summary:
        `Message reach & velocity across ${hours} hours (${buckets} buckets). ` +
        `Total reach ${(totalReach / 1e6).toFixed(2)}M impressions across ${totalMentions} mentions. ` +
        `Peak at ${series[peakIdx].label} (${(series[peakIdx].reach / 1e6).toFixed(2)}M reach).`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. VIZ: Sentiment heatmap (channel x time) ─────────────────────────────
router.get('/sentiment-channel-heatmap', async (req, res) => {
  try {
    const channels = ['Twitter/X', 'Facebook', 'Instagram', 'LinkedIn', 'TikTok', 'Reddit', 'YouTube', 'News Wire'];
    const slots = ['00-03', '03-06', '06-09', '09-12', '12-15', '15-18', '18-21', '21-24'];

    // Try live: average sentiment per channel/source per 3-hour window
    const live = await safeQuery(`
      SELECT
        COALESCE(NULLIF(platform, ''), source) AS channel,
        EXTRACT(HOUR FROM COALESCE(published_at, created_at))::int AS hr,
        AVG(CASE
          WHEN sentiment ILIKE 'positive' THEN 0.8
          WHEN sentiment ILIKE 'neutral'  THEN 0.0
          WHEN sentiment ILIKE 'negative' THEN -0.8
          ELSE 0.0
        END)::float AS s,
        COUNT(*)::int AS n
      FROM media_monitoring
      WHERE COALESCE(published_at, created_at) >= NOW() - INTERVAL '7 days'
      GROUP BY channel, hr
    `);

    // Build matrix[channel][slot] = {sentiment, volume}
    const matrix = {};
    for (const c of channels) {
      matrix[c] = {};
      for (const s of slots) matrix[c][s] = { sentiment: 0, volume: 0 };
    }

    // Channel sentiment-bias (synthesized)
    const CHANNEL_BIAS = {
      'Twitter/X':  -0.35, 'Facebook':  -0.10, 'Instagram': 0.20, 'LinkedIn': 0.30,
      'TikTok':     -0.20, 'Reddit':    -0.45, 'YouTube':   0.05, 'News Wire': -0.05,
    };
    // Hour-of-day amplification (12-21 is most volatile)
    const SLOT_VOLUME = { '00-03': 0.4, '03-06': 0.3, '06-09': 0.8, '09-12': 1.2, '12-15': 1.6, '15-18': 1.9, '18-21': 1.8, '21-24': 1.0 };

    const rand = seededRand(7717);
    for (const c of channels) {
      for (const s of slots) {
        const bias = CHANNEL_BIAS[c] || 0;
        const noise = (rand() - 0.5) * 0.5;
        const slotShift = s === '15-18' || s === '18-21' ? -0.15 : 0; // bad news cycle
        const sentiment = Math.max(-1, Math.min(1, bias + noise + slotShift));
        const vol = SLOT_VOLUME[s] || 1;
        const baseVol = (c === 'Twitter/X' ? 2200 : c === 'TikTok' ? 1800 : c === 'Reddit' ? 950 : 700);
        const volume = Math.round(baseVol * vol * (0.7 + rand() * 0.6));
        matrix[c][s] = { sentiment: +sentiment.toFixed(3), volume };
      }
    }

    if (live && live.length) {
      for (const row of live) {
        const c = channels.find((ch) => ch.toLowerCase().includes(String(row.channel || '').toLowerCase()))
          || (row.channel ? String(row.channel) : null);
        if (!c || !matrix[c]) continue;
        const slotIdx = Math.floor(Number(row.hr) / 3);
        const slot = slots[Math.max(0, Math.min(slots.length - 1, slotIdx))];
        // Blend live with synth (give live 60% weight when present)
        const prev = matrix[c][slot];
        matrix[c][slot] = {
          sentiment: +(prev.sentiment * 0.4 + Number(row.s) * 0.6).toFixed(3),
          volume: prev.volume + Number(row.n) * 30,
        };
      }
    }

    const cells = [];
    let minS = 1, maxS = -1;
    for (const c of channels) {
      for (const s of slots) {
        const v = matrix[c][s];
        cells.push({ channel: c, slot: s, sentiment: v.sentiment, volume: v.volume });
        if (v.sentiment < minS) minS = v.sentiment;
        if (v.sentiment > maxS) maxS = v.sentiment;
      }
    }

    const totalsByChannel = Object.fromEntries(
      channels.map((c) => [c, +(slots.reduce((sum, s) => sum + matrix[c][s].sentiment, 0) / slots.length).toFixed(3)])
    );
    const totalsBySlot = Object.fromEntries(
      slots.map((s) => [s, +(channels.reduce((sum, c) => sum + matrix[c][s].sentiment, 0) / channels.length).toFixed(3)])
    );

    res.json({
      generated_at: new Date().toISOString(),
      channels,
      slots,
      matrix,
      cells,
      min_sentiment: +minS.toFixed(3),
      max_sentiment: +maxS.toFixed(3),
      totals_by_channel: totalsByChannel,
      totals_by_slot: totalsBySlot,
      source: live && live.length ? 'live+synthesized' : 'synthesized',
      summary:
        `Sentiment heatmap across ${channels.length} channels × ${slots.length} 3-hour slots. ` +
        `Most negative channel: ${Object.entries(totalsByChannel).sort((a, b) => a[1] - b[1])[0][0]}. ` +
        `Cool spots = negative sentiment; hot spots = positive.`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. NON-VIZ: Crisis Statement / Press-Release (PDF) ─────────────────────
router.get('/crisis-statement-pdf', async (req, res) => {
  try {
    const org = req.query.org || 'Acme Corporation';
    const headline = req.query.headline || 'Statement Regarding Recent Service Disruption';
    const spokesperson = req.query.spokesperson || 'Jane Smith, Chief Communications Officer';
    const severity = req.query.severity || 'SEV-2';
    const audience = req.query.audience || 'Customers, partners, and the public';
    const incidentRef = req.query.incident_ref || `INC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const dateline = req.query.dateline || `${new Date().toUTCString().split(' ').slice(1, 4).join(' ')}`;
    const format = (req.query.format || 'json').toLowerCase();

    const statement = {
      statement_id: `STMT-${incidentRef}`,
      issued_at: new Date().toISOString(),
      organization: org,
      headline,
      dateline,
      severity_tier: severity,
      target_audience: audience,
      spokesperson,
      incident_ref: incidentRef,
      lead:
        `${org} is responding to an ongoing situation referenced as ${incidentRef}. ` +
        `We take this matter with the utmost seriousness and have activated our crisis ` +
        `response protocols. Customer and stakeholder safety remain our highest priority.`,
      body: [
        `At approximately ${new Date(Date.now() - 3 * 60 * 60 * 1000).toUTCString()}, our team became aware of the incident. ` +
          `We immediately convened our crisis management team and engaged appropriate technical, legal, and regulatory experts.`,
        `We are actively investigating the root cause and have implemented containment measures. ` +
          `We are working closely with relevant authorities and providing full cooperation as the investigation proceeds.`,
        `${org} sincerely regrets any inconvenience or concern this situation may have caused. ` +
          `We will provide a further update within 24 hours, and continuous status updates can be found at our official channels.`,
      ],
      quote:
        `"${spokesperson.split(',')[0]} stated: 'We are committed to transparency and to making this right. ` +
        `Every team member is focused on resolution and on the wellbeing of those affected.'"`,
      next_update: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      contacts: {
        media: 'press@example.com',
        investor_relations: 'ir@example.com',
        customer_support: '1-800-555-0199',
      },
      boilerplate:
        `About ${org}: A global organization committed to operational excellence, ` +
        `regulatory compliance, and the trust of our customers and communities.`,
      summary: `Official ${severity} crisis statement from ${org} re: ${incidentRef}.`,
    };

    if (format !== 'pdf') {
      return res.json(statement);
    }

    // ── Minimal PDF generation (no external deps): hand-rolled PDF 1.4 ──
    const lines = [
      'CRISIS COMMUNICATION STATEMENT',
      '',
      `Organization: ${statement.organization}`,
      `Statement ID: ${statement.statement_id}`,
      `Issued: ${statement.issued_at}`,
      `Severity Tier: ${statement.severity_tier}`,
      `Incident Ref: ${statement.incident_ref}`,
      `Dateline: ${statement.dateline}`,
      '',
      'HEADLINE:',
      ...wrap(statement.headline, 80),
      '',
      'LEAD:',
      ...wrap(statement.lead, 80),
      '',
      'BODY:',
      ...statement.body.flatMap((p) => [...wrap(p, 80), '']),
      'QUOTE:',
      ...wrap(statement.quote, 80),
      '',
      `Spokesperson: ${statement.spokesperson}`,
      `Target Audience: ${statement.target_audience}`,
      `Next Update: ${statement.next_update}`,
      '',
      'MEDIA CONTACTS:',
      `Media:    ${statement.contacts.media}`,
      `IR:       ${statement.contacts.investor_relations}`,
      `Support:  ${statement.contacts.customer_support}`,
      '',
      'BOILERPLATE:',
      ...wrap(statement.boilerplate, 80),
      '',
      '— END OF STATEMENT —',
    ];

    const pdfBuffer = buildSimplePdf(lines);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${statement.statement_id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. NON-VIZ: Escalation Rules Editor (CRUD severity tiers) ──────────────
// GET    /escalation-rules         list (and stats)
// POST   /escalation-rules         create
// PUT    /escalation-rules/:id     update
// DELETE /escalation-rules/:id     remove
router.get('/escalation-rules', (req, res) => {
  const byStatus = RULES.reduce((m, r) => { m[r.status] = (m[r.status] || 0) + 1; return m; }, {});
  const warRoomCount = RULES.filter((r) => r.war_room).length;
  res.json({
    generated_at: new Date().toISOString(),
    count: RULES.length,
    rules: RULES.slice().sort((a, b) => (a.threshold_reach > b.threshold_reach ? -1 : 1)),
    by_status: byStatus,
    war_room_tiers: warRoomCount,
    summary:
      `${RULES.length} escalation tiers configured (${Object.keys(byStatus).map(k => `${k}: ${byStatus[k]}`).join(', ')}). ` +
      `${warRoomCount} tiers trigger a war-room activation.`,
  });
});

router.post('/escalation-rules', express.json(), (req, res) => {
  const body = req.body || {};
  if (!body.tier || !body.name) {
    return res.status(400).json({ error: 'tier and name are required' });
  }
  const rule = {
    id: ++RULE_SEQ,
    tier: String(body.tier).slice(0, 32),
    name: String(body.name).slice(0, 256),
    threshold_reach: Number(body.threshold_reach) || 0,
    threshold_negative_pct: Number(body.threshold_negative_pct) || 0,
    notify_roles: String(body.notify_roles || '').slice(0, 512),
    response_sla_minutes: Number(body.response_sla_minutes) || 60,
    war_room: Boolean(body.war_room),
    auto_press_release: Boolean(body.auto_press_release),
    auto_holding_statement: Boolean(body.auto_holding_statement),
    channels: String(body.channels || 'email').slice(0, 256),
    status: ['active', 'draft', 'archived'].includes(body.status) ? body.status : 'draft',
    description: String(body.description || '').slice(0, 1024),
    updated_at: new Date().toISOString(),
  };
  RULES.push(rule);
  res.status(201).json(rule);
});

router.put('/escalation-rules/:id', express.json(), (req, res) => {
  const id = Number(req.params.id);
  const idx = RULES.findIndex((r) => r.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const body = req.body || {};
  const updated = { ...RULES[idx] };
  for (const k of ['tier', 'name', 'notify_roles', 'channels', 'description']) {
    if (body[k] !== undefined) updated[k] = String(body[k]);
  }
  for (const k of ['threshold_reach', 'threshold_negative_pct', 'response_sla_minutes']) {
    if (body[k] !== undefined) updated[k] = Number(body[k]);
  }
  for (const k of ['war_room', 'auto_press_release', 'auto_holding_statement']) {
    if (body[k] !== undefined) updated[k] = Boolean(body[k]);
  }
  if (body.status !== undefined && ['active', 'draft', 'archived'].includes(body.status)) {
    updated.status = body.status;
  }
  updated.updated_at = new Date().toISOString();
  RULES[idx] = updated;
  res.json(updated);
});

router.delete('/escalation-rules/:id', (req, res) => {
  const id = Number(req.params.id);
  const idx = RULES.findIndex((r) => r.id === id);
  if (idx < 0) return res.status(404).json({ error: 'not found' });
  const [removed] = RULES.splice(idx, 1);
  res.json({ deleted: true, rule: removed });
});

// ─── PDF helpers (no external deps) ─────────────────────────────────────────
function wrap(text, max) {
  const out = [];
  let line = '';
  for (const word of String(text).split(/\s+/)) {
    if ((line + ' ' + word).trim().length > max) {
      if (line) out.push(line);
      line = word;
    } else {
      line = (line ? line + ' ' : '') + word;
    }
  }
  if (line) out.push(line);
  return out;
}

function escapePdf(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function buildSimplePdf(lines) {
  const startX = 60;
  const startY = 770;
  const leading = 14;

  const contentParts = ['BT', '/F1 11 Tf', `${startX} ${startY} Td`, `${leading} TL`];
  lines.forEach((ln, i) => {
    if (i === 0) {
      contentParts.push('/F1 14 Tf');
      contentParts.push(`(${escapePdf(ln)}) Tj`);
      contentParts.push('/F1 11 Tf');
    } else {
      contentParts.push(`(${escapePdf(ln)}) Tj`);
    }
    contentParts.push('T*');
  });
  contentParts.push('ET');
  const stream = contentParts.join('\n');

  const objects = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Count 1 /Kids [3 0 R] >>');
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>');
  objects.push(`<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  let body = '';
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(header + body, 'binary'));
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefStart = Buffer.byteLength(header + body, 'binary');
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, 'binary');
}

module.exports = router;
