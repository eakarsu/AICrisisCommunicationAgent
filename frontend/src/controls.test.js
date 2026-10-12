import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { nativeAIPresets } from './components/nativeAIPresets';
import * as configs from './configs/featureConfigs';
import AIReport from './components/AIReport';
import { workspacePresets, workspaceFields } from './components/AIWorkspace';
import workspaceFeatures from './components/aiWorkspaceFeatures.json';
import FeaturePage from './pages/FeaturePage';
import LoginPage from './pages/LoginPage';
import AIAdvanced from './pages/AIAdvanced';
import { login, severityScore, getCrisisIncidents, getStakeholders, getAIResults, getSentimentTrend } from './services/api';

jest.mock('./services/api', () => ({ login: jest.fn(), getCrisisIncidents: jest.fn(async () => ({ data: { data: [{ id: 42, title: 'Existing incident', severity: 'high' }] } })), getStakeholders: jest.fn(async () => ({ data: { data: [{ id: 73, name: 'Existing stakeholder' }] } })), getAIResults: jest.fn(async () => ({ data: { data: [{ id: 8, endpoint: 'severity-score', created_at: '2026-01-01T00:00:00Z', result: { risk: { urgent: false, score: 0, note: '' }, actions: ['Notify owner'] } }] } })), getSentimentTrend: jest.fn(async () => ({ data: null })), severityScore: jest.fn() }));
global.IS_REACT_ACT_ENVIRONMENT = true;

const config = { title: 'Press Releases', isAI: true, aiGenerate: jest.fn(), aiFields: [
  { key: 'crisis_title', label: 'Crisis Title', type: 'text', required: true },
  { key: 'crisis_details', label: 'Crisis Details', type: 'textarea', required: true },
  { key: 'company_name', label: 'Company Name', type: 'text' },
  { key: 'tone', label: 'Tone', type: 'select', options: ['empathetic', 'factual'] },
], fields: [], columns: [], apiGetAll: jest.fn(async () => ({ data: [] })) };

let node; let root;
beforeEach(() => { config.apiGetAll.mockImplementation(async () => ({ data: [] })); getCrisisIncidents.mockImplementation(async () => ({ data: { data: [{ id: 42, title: 'Existing incident', severity: 'high' }] } })); getStakeholders.mockImplementation(async () => ({ data: { data: [{ id: 73, name: 'Existing stakeholder' }] } })); getAIResults.mockImplementation(async () => ({ data: { data: [{ id: 8, endpoint: 'severity-score', created_at: '2026-01-01T00:00:00Z', result: { risk: { urgent: false, score: 0, note: '' }, actions: ['Notify owner'] } }] } })); getSentimentTrend.mockImplementation(async () => ({ data: null })); node = document.createElement('div'); document.body.appendChild(node); root = createRoot(node); });
afterEach(async () => { await act(async () => root.unmount()); node.remove(); jest.clearAllMocks(); });

test('native examples cover required and optional fields and only fill', async () => {
  Object.values(configs).filter((item) => item.aiFields).forEach((item) => {
    nativeAIPresets(item).forEach(({ values }) => {
      expect(Object.keys(values).sort()).toEqual(item.aiFields.map((field) => field.key).sort());
      Object.values(values).forEach((value) => expect(value).not.toBe(''));
    });
  });
  const presets = nativeAIPresets(config);
  expect(presets).toHaveLength(3);
  presets.forEach(({ values }) => expect(Object.keys(values).sort()).toEqual(config.aiFields.map((f) => f.key).sort()));
  await act(async () => root.render(<FeaturePage config={config} />));
  const preset = [...node.querySelectorAll('button')].find((b) => b.textContent === 'Service outage');
  expect(preset.type).toBe('button');
  await act(async () => preset.click());
  expect(node.querySelector('input[placeholder="Enter crisis title..."]').value).toBe('Regional service outage');
  expect(node.querySelector('textarea').value).toContain('Customers in the northeast');
  expect(node.querySelector('input[placeholder="Enter company name..."]').value).toBe('Northstar Services');
  expect(node.querySelector('select').value).toBe('empathetic');
  expect(config.aiGenerate).not.toHaveBeenCalled();
});

test('returned and saved structured values render labels, facts, list, table, false, zero, empty string', () => {
  const data = { summary: 'Incident under review', facts: { verified: false, affected_count: 0, note: '' }, actions: ['Notify incident lead'], records: [{ channel: 'email', delivered: false }] };
  for (const response of [data, { result: data, id: 12 }]) {
    const markup = renderToStaticMarkup(<AIReport response={response} />);
    expect(markup).toContain('Affected count');
    expect(markup).toContain('No');
    expect(markup).toContain('0');
    expect(markup).toContain('Empty string');
    expect(markup).toContain('<table');
    expect(markup).toContain('<li>');
    expect(markup).not.toContain('{&quot;');
  }
});

test('demo control fills configured credentials without submitting', async () => {
  process.env.REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL = 'true';
  process.env.REACT_APP_DEMO_EMAIL = 'demo@example.invalid';
  process.env.REACT_APP_DEMO_PASSWORD = 'fixture-only';
  await act(async () => root.render(<LoginPage onLogin={jest.fn()} />));
  const button = [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Fill demo credentials'));
  expect(button.type).toBe('button');
  await act(async () => button.click());
  expect(node.querySelector('input[type="email"]').value).toBe('demo@example.invalid');
  expect(node.querySelector('input[type="password"]').value).toBe('fixture-only');
  expect(login).not.toHaveBeenCalled();
  delete process.env.REACT_APP_DEMO_EMAIL;
  delete process.env.REACT_APP_DEMO_PASSWORD;
  delete process.env.REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL;
});

test('AI Advanced preset retains genuine references and saved history is formatted', async () => {
  await act(async () => root.render(<AIAdvanced />));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  const preset = [...node.querySelectorAll('button')].find((b) => b.textContent === 'Service outage');
  await act(async () => preset.click());
  expect(getCrisisIncidents).toHaveBeenCalled();
  expect([...node.querySelector('select').options].map((o) => o.value)).toContain('42');
  expect(node.querySelector('select').value).toBe('42');
  expect(severityScore).not.toHaveBeenCalled();
  await act(async () => [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Tactical Playbook')).click());
  await act(async () => [...node.querySelectorAll('button')].find((b) => b.textContent === 'Product recall').click());
  expect([...node.querySelectorAll('input')].find((input) => input.placeholder.includes('stakeholder IDs'))?.value).toBe('73');
  expect(severityScore).not.toHaveBeenCalled();
  const history = [...node.querySelectorAll('details')].find((item) => item.textContent.includes('severity-score'));
  expect(history).toBeTruthy();
  expect(history.innerHTML).toContain('Urgent');
  expect(history.innerHTML).toContain('Empty string');
});

test('missing demo configuration is explicit and does not submit', async () => {
  delete process.env.REACT_APP_DEMO_EMAIL;
  delete process.env.REACT_APP_DEMO_PASSWORD;
  delete process.env.REACT_APP_ENABLE_DEMO_CREDENTIAL_AUTOFILL;
  await act(async () => root.render(<LoginPage onLogin={jest.fn()} />));
  await act(async () => [...node.querySelectorAll('button')].find((b) => b.textContent.includes('Fill demo credentials')).click());
  expect(node.textContent).toContain('Demo credentials are not configured');
  expect(login).not.toHaveBeenCalled();
});

test('workspace examples fill every editable field', () => {
  workspaceFeatures.forEach((feature) => {
    const presets = workspacePresets(feature);
    expect(presets.length).toBeGreaterThan(1);
    presets.forEach(({ values }) => {
      expect(Object.keys(values).sort()).toEqual(workspaceFields.map((field) => field.key).sort());
      Object.values(values).forEach((value) => expect(value).not.toBe(''));
    });
  });
});

test('saved AI detail uses structured report sections', async () => {
  const saved = { id: 9, title: 'Saved assessment', ai_analysis: JSON.stringify({ verified: false, impact_count: 0, note: '', actions: ['Review facts'] }) };
  const detailConfig = { ...config, title: 'Risk Assessments', aiGenerate: undefined, fields: [{ key: 'title', label: 'Title', type: 'text' }, { key: 'ai_analysis', label: 'AI Analysis', type: 'textarea' }], columns: [{ key: 'title', label: 'Title' }], apiGetAll: jest.fn(async () => ({ data: [saved] })), apiGetOne: jest.fn(async () => ({ data: saved })) };
  await act(async () => root.render(<FeaturePage config={detailConfig} />));
  await act(async () => node.querySelector('tbody tr').click());
  expect(node.querySelector('.detail-panel .ai-report')).toBeTruthy();
  expect(node.querySelector('.detail-panel').textContent).toContain('Impact count');
  expect(node.querySelector('.detail-panel').textContent).toContain('Empty string');
});
