import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createTrendService } from '../src/services/trends.js';
import { configureTrends, sanitizeTrendLists, trendFreshness, trendSets } from '../src/shared/trends.js';
import { trendBonus } from '../src/engine/stylist.js';
import { normalizePrefs } from '../src/engine/scoring.js';
import { PALETTE } from '../src/shared/color.js';
import { TYPE_IDS, PATTERNS, ARCHETYPE_IDS } from '../src/shared/taxonomy.js';

const VOCAB = { colors: PALETTE.map((p) => p.name), types: TYPE_IDS, patterns: PATTERNS, archetypes: ARCHETYPE_IDS };
const trend = (i, over = {}) => ({ id: `t${i}`, label: `trend ${i}`, labels: { es: `tendencia ${i}`, fr: `tendance ${i}` }, weight: 0.03, archetypes: ['classic'], match: { types: ['sweater'] }, ...over });
const lists = (n = 8) => ({ fw: Array.from({ length: n }, (_, i) => trend(i)), ss: Array.from({ length: n }, (_, i) => trend(i, { match: { colors: ['yellow'] } })), sources: ['https://example.com/report', 'http://insecure.example'] });
const silent = { info() {}, warn() {}, error() {} };
const replyWith = (text, stop = 'end_turn') => async () => ({ stop_reason: stop, content: [{ type: 'text', text }] });

describe('trend lists', () => {
  afterEach(() => configureTrends(null));

  test('only words this app understands survive validation, and weights are capped', () => {
    const dirty = lists();
    dirty.fw.push(trend(50, { match: { colors: ['neon-green'] } }), trend(51, { match: { types: ['spaceship'] } }), trend(52, { weight: 9 }), trend(53, { label: '' }), trend(54, { match: { all: [{ types: ['blazer'] }] } }), trend(55, { match: { all: [{ types: ['blazer'] }, { colors: ['burgundy'] }] } }));
    const out = sanitizeTrendLists(dirty, VOCAB);
    const ids = out.fw.map((t) => t.id);
    assert.ok(!ids.some((id) => ['t50', 't51', 't53', 't54'].includes(id)), 'unknown colour/type, empty label, one-clause "all" are dropped');
    assert.equal(out.fw.find((t) => t.id === 't52').weight, 0.05, 'weight capped');
    assert.ok(ids.includes('t55'));
    assert.equal(sanitizeTrendLists({ fw: [trend(1)], ss: [] }, VOCAB), null, 'too little survives: refuse the whole answer');
    assert.equal(sanitizeTrendLists('nonsense', VOCAB), null);
  });

  test('a refresh researches, validates, saves, applies, and keeps the previous list', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-trends-'));
    const calls = [];
    const ai = { raw: { messages: { create: async (req) => (calls.push(req), { stop_reason: 'end_turn', content: [{ type: 'text', text: `Here you go:\n${JSON.stringify(lists())}` }] }) } } };
    const svc = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai, log: silent, now: () => new Date('2027-03-01T10:00:00Z') });
    const r = await svc.refresh();
    assert.deepEqual([r.ok, r.fw, r.ss], [true, 8, 8]);
    assert.ok(calls[0].tools.some((t) => t.type === 'web_search_20260209'), 'it searches the web');
    const saved = JSON.parse(fs.readFileSync(path.join(dataDir, 'trends.json'), 'utf8'));
    assert.equal(saved.source, 'auto');
    assert.deepEqual(saved.sources, ['https://example.com/report'], 'only https sources are kept');
    assert.equal(trendSets().updated, '2027-03');
    // applied: the new lists drive the engine
    const prefs = normalizePrefs({ style: { archetypes: { classic: 1 } } });
    const parts = { upper: [{ type: 'sweater', category: 'top', color: '#1f2f54', pattern: 'solid' }], bottom: { type: 'jeans', category: 'bottom', color: '#2b3a55', pattern: 'solid' }, dress: null, outer: null, shoes: null, accessories: [] };
    const bonus = trendBonus(parts, { date: '2027-03-02', avgFeels: 8, minFeels: 4 }, normalizePrefs({ style: { archetypes: { classic: 1 } }, location: { lat: -34 } }), 0.9);
    assert.ok(bonus.bonus > 0);
    // a second refresh keeps the first as trends.previous.json
    await svc.refresh();
    assert.ok(fs.existsSync(path.join(dataDir, 'trends.previous.json')));
    // restoring the built-in lists
    svc.restoreBuiltIn();
    assert.equal(trendSets().custom, false);
  });

  test('a bad answer changes nothing', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-trends-'));
    for (const text of ['no json here', '{"fw": [], "ss": []}', '{ not json }']) {
      const svc = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai: { raw: { messages: { create: replyWith(text) } } }, log: silent });
      const r = await svc.refresh();
      assert.equal(r.ok, false, text);
      assert.equal(fs.existsSync(path.join(dataDir, 'trends.json')), false);
    }
    const none = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai: null, log: silent });
    assert.match((await none.refresh()).why, /not switched on/);
    const cut = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai: { raw: { messages: { create: replyWith(JSON.stringify(lists()), 'max_tokens') } } }, log: silent });
    assert.equal((await cut.refresh()).ok, false, 'a cut-off answer is not trusted');
  });

  test('a paused web search is continued', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-trends-'));
    let n = 0;
    const create = async () => (++n === 1 ? { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', id: 'x', name: 'web_search', input: {} }] } : { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(lists()) }] });
    const svc = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai: { raw: { messages: { create } } }, log: silent });
    assert.equal((await svc.refresh()).ok, true);
    assert.equal(n, 2);
  });

  test('it only refreshes when the saved lists are a month old', async () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mw-trends-'));
    let calls = 0;
    const create = async () => (calls++, { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(lists()) }] });
    let clock = new Date('2027-01-01T00:00:00Z');
    const svc = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: true } }, ai: { raw: { messages: { create } } }, log: silent, now: () => clock });
    assert.equal(svc.due(), true);
    await svc.refreshIfDue();
    assert.equal(calls, 1);
    clock = new Date('2027-01-20T00:00:00Z');
    await svc.refreshIfDue();
    assert.equal(calls, 1, 'not yet');
    clock = new Date('2027-02-05T00:00:00Z');
    await svc.refreshIfDue();
    assert.equal(calls, 2);
    const off = createTrendService({ config: { dataDir, ai: { model: 'm' }, trends: { autoRefresh: false } }, ai: { raw: { messages: { create } } }, log: silent, now: () => new Date('2030-01-01') });
    await off.refreshIfDue();
    assert.equal(calls, 2, 'switched off');
  });

  test('lists nobody refreshes fade out instead of steering people to last year’s looks', () => {
    assert.equal(trendFreshness(new Date('2027-02-01T00:00:00Z')), 1);
    assert.ok(trendFreshness(new Date('2027-10-01T00:00:00Z')) < 1);
    assert.equal(trendFreshness(new Date('2030-01-01T00:00:00Z')), 0.25);
    const prefs = normalizePrefs({ style: { archetypes: { classic: 1 } } });
    const parts = { upper: [{ type: 'sweater', category: 'top', color: '#6d1f35', pattern: 'solid' }], bottom: { type: 'jeans', category: 'bottom', color: '#2b3a55', pattern: 'solid' }, dress: null, outer: null, shoes: null, accessories: [] };
    const fresh = trendBonus(parts, { date: '2026-12-01', avgFeels: 8, minFeels: 4 }, prefs, 0.9).bonus;
    const old = trendBonus(parts, { date: '2028-06-01', avgFeels: 8, minFeels: 4 }, prefs, 0.9).bonus;
    assert.ok(old < fresh / 2, `${old} vs ${fresh}`);
  });
});

describe('trends in the admin area', () => {
  test('only an admin can refresh or restore them, and the System check reports their age', async () => {
    const { startTestServer, registerUser } = await import('./helpers.js');
    const reply = { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(lists()) }] };
    const t = await startTestServer({ env: { ADMIN_EMAILS: 'boss@example.com' }, overrides: { aiClient: { messages: { create: async () => reply } } } });
    try {
      const nobody = t.client();
      await registerUser(nobody);
      for (const u of ['/api/admin/trends/refresh', '/api/admin/trends/restore']) assert.equal((await nobody.post(u, {})).status, 403, u);
      const admin = t.client();
      await registerUser(admin, { email: 'boss@example.com' });
      const before = (await admin.get('/api/admin/system')).json.trends;
      assert.equal(before.custom, false);
      const r = (await admin.post('/api/admin/trends/refresh', {})).json;
      assert.equal(r.result.ok, true);
      assert.equal(r.status.custom, true);
      assert.equal((await admin.post('/api/admin/trends/restore', {})).json.status.custom, false);
    } finally {
      configureTrends(null);
      await t.close();
    }
  });
});
