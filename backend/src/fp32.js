'use strict';
function csvCell(v){ if(v===null||v===undefined) return ''; const s=typeof v==='object'?JSON.stringify(v):String(v); return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s; }
function toCsv(rows, cols){ const c=cols||(rows[0]?Object.keys(rows[0]):[]); return [c.join(','), ...rows.map(r=>c.map(k=>csvCell(r[k])).join(','))].join('\n'); }
function providerConfigured(env){ env=env||process.env; const r=env.OPENROUTER_API_KEY, o=env.OPENAI_API_KEY; return Boolean((r&&r!=='your_openrouter_key_here'&&r!=='your-openrouter-key-here')||(o&&o!=='your_openai_key_here')); }

function incidentTriage(rows){ rows=rows||[]; const bySev={},byStatus={}; rows.forEach(r=>{ bySev[r.severity||'unknown']=(bySev[r.severity||'unknown']||0)+1; byStatus[r.status||'unknown']=(byStatus[r.status||'unknown']||0)+1; });
 return {feature:'incident-triage',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Incidents reviewed',value:rows.length},{label:'By severity',value:bySev},{label:'By status',value:byStatus},{label:'Critical count',value:bySev['critical']||0},{label:'Has incidents',value:rows.length>0},{label:'Notes',value:''}]}; }
function commsReadiness(rows){ rows=rows||[]; const open=rows.filter(r=>!['resolved','closed'].includes(String(r.status||'').toLowerCase()));
 return {feature:'comms-readiness',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Incidents reviewed',value:rows.length},{label:'Open count',value:open.length},{label:'Open detail',value:open.slice(0,50).map(r=>({title:r.title||'',severity:r.severity||'',status:r.status||''}))},{label:'Open share',value:rows.length?Math.round(open.length/rows.length*1000)/10:0}]}; }
function escalationOutlook(rows){ rows=rows||[]; const hi=rows.filter(r=>['high','critical'].includes(String(r.severity||'').toLowerCase()));
 return {feature:'escalation-outlook',aiGenerated:false,source:'deterministic-fallback',sections:[{label:'Incidents reviewed',value:rows.length},{label:'High severity count',value:hi.length},{label:'High severity share',value:rows.length?Math.round(hi.length/rows.length*1000)/10:0},{label:'Flagged',value:hi.length>0}]}; }

module.exports={toCsv,providerConfigured,incidentTriage,commsReadiness,escalationOutlook};
