'use strict';
const express=require('express');
const {toCsv,providerConfigured,incidentTriage,commsReadiness,escalationOutlook}=require('../fp32');
const FN={'incident-triage':incidentTriage,'comms-readiness':commsReadiness,'escalation-outlook':escalationOutlook};
module.exports=function({pool,auth}){
 const router=express.Router(); router.use(auth);
 let ready=null; function ensure(){ if(!ready) ready=pool.query("CREATE TABLE IF NOT EXISTS fp32_tasks (id SERIAL PRIMARY KEY, user_id TEXT, title TEXT NOT NULL, description TEXT DEFAULT '', status TEXT DEFAULT 'open', priority TEXT DEFAULT 'normal', due_date DATE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())").catch(e=>{ready=null;throw e;}); return ready; }
 router.get('/tasks',async(req,res)=>{ try{ await ensure(); const p=[];const c=[]; if(req.query.status){p.push(req.query.status);c.push('status=$'+p.length);} if(req.query.search){p.push('%'+req.query.search+'%');c.push('(title ILIKE $'+p.length+' OR description ILIKE $'+p.length+')');} const r=await pool.query('SELECT * FROM fp32_tasks'+(c.length?' WHERE '+c.join(' AND '):'')+' ORDER BY id DESC LIMIT 200',p); res.json({data:r.rows,total:r.rows.length}); }catch(e){res.status(500).json({error:e.message});} });
 router.post('/tasks',async(req,res)=>{ try{ const title=String((req.body||{}).title||'').trim(); if(!title) return res.status(400).json({error:'title is required'}); await ensure(); const b=req.body; const uid=String((req.user&&(req.user.id||req.user.userId))||''); const r=await pool.query('INSERT INTO fp32_tasks (user_id,title,description,status,priority,due_date) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',[uid,title,String(b.description||''),String(b.status||'open'),String(b.priority||'normal'),b.due_date||null]); res.status(201).json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} });
 async function upd(req,res){ try{ await ensure(); const b=req.body||{}; const r=await pool.query('UPDATE fp32_tasks SET title=COALESCE($1,title),description=COALESCE($2,description),status=COALESCE($3,status),priority=COALESCE($4,priority),due_date=COALESCE($5,due_date),updated_at=NOW() WHERE id=$6 RETURNING *',[b.title??null,b.description??null,b.status??null,b.priority??null,b.due_date??null,req.params.id]); if(!r.rows.length) return res.status(404).json({error:'Task not found'}); res.json(r.rows[0]); }catch(e){res.status(500).json({error:e.message});} }
 router.put('/tasks/:id',upd); router.patch('/tasks/:id',upd);
 function filters(req){ const p=[];const c=[]; if(req.query.search){p.push('%'+req.query.search+'%');const i=p.length;c.push('(title ILIKE $'+i+' OR description ILIKE $'+i+')');} if(req.query.status){p.push(req.query.status);c.push('status=$'+p.length);} if(req.query.severity){p.push(req.query.severity);c.push('severity=$'+p.length);} return {p,w:c.length?' WHERE '+c.join(' AND '):''}; }
 async function fetchIncidents(req){ const f=filters(req); const r=await pool.query('SELECT * FROM crisis_incidents'+f.w+' ORDER BY created_at DESC LIMIT 200',f.p); return r.rows; }
 router.get('/incidents/export',async(req,res)=>{ try{ const rows=await fetchIncidents(req); if(String(req.query.format||'json').toLowerCase()==='csv'){ res.setHeader('Content-Type','text/csv'); return res.send(toCsv(rows)); } return res.json({data:rows,total:rows.length}); }catch(e){res.status(500).json({error:e.message});} });
 router.get('/incidents',async(req,res)=>{ try{ const rows=await fetchIncidents(req); res.json({data:rows,total:rows.length}); }catch(e){res.status(500).json({error:e.message});} });
 
 async function handleAi(req,res,fetchRecords){
   const fn=FN[req.params.feature]; if(!fn) return res.status(404).json({error:'unknown feature',features:Object.keys(FN)});
   let records=Array.isArray(req.body&&req.body.records)?req.body.records:null;
   if(!records){ try{ records=await fetchRecords(req); }catch(e){ return res.status(500).json({error:e.message}); } }
   const plain=records.map(r=>(r&&typeof r.toJSON==='function')?r.toJSON():(r&&r.dataValues?r.dataValues:r));
   const fb=fn(plain);
   if(!providerConfigured()) return res.json(fb);
   try{
     const key=process.env.OPENROUTER_API_KEY||process.env.OPENAI_API_KEY;
     const base=process.env.OPENROUTER_API_KEY?'https://openrouter.ai/api/v1':'https://api.openai.com/v1';
     const r=await fetch(base+'/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENROUTER_MODEL||'anthropic/claude-haiku-4.5',messages:[{role:'system',content:'Summarize supplied records only. Return JSON with sections array of {label,value}.'},{role:'user',content:JSON.stringify(fb.sections)}],temperature:0.2})});
     if(!r.ok) throw new Error('provider failed');
     const j=await r.json(); const txt=(j.choices&&j.choices[0]&&j.choices[0].message&&j.choices[0].message.content)||'';
     let sections; try{ sections=JSON.parse(txt).sections; }catch(_){ sections=[{label:'Summary',value:txt}]; }
     return res.json({feature:fb.feature,aiGenerated:true,source:'provider',sections});
   }catch(_){ return res.json(Object.assign({},fb,{providerError:'provider call failed; deterministic fallback shown'})); }
 }

 router.post('/ai/:feature',async(req,res)=>{ try{ await handleAi(req,res,fetchIncidents); }catch(e){res.status(500).json({error:e.message});} });
 return router;
};
