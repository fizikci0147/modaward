import { html, useState, useEffect, useRef } from '/js/ui.js';
import { api } from '/js/api.js';
import { fail, toast } from '/js/store.js';

/** A section that failed to load says so and offers a retry, instead of showing a loading placeholder forever. */
const Failed = ({ error, onRetry }) => html`<div class="card card-pad stack center"><p>${error?.message || 'This could not be loaded.'}</p><div><button class="btn btn-outline" onClick=${onRetry}>Try again</button></div></div>`;

const Stat = ({ label, value, sub }) => html`<div class="card stat"><span class="eyebrow">${label}</span><b class="num">${value}</b>${sub ? html`<span class="small muted">${sub}</span>` : null}</div>`;

function Access() {
  const [codes, setCodes] = useState([]);
  const [form, setForm] = useState({ code: '', days: 30, maxUses: 1, note: '' });
  const [grant, setGrant] = useState({ email: '', days: 30 });
  const load = () => api.get('/admin/codes').then((r) => setCodes(r.codes)).catch(fail);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const create = async (e) => {
    e.preventDefault();
    try {
      const body = { days: Number(form.days), maxUses: Number(form.maxUses), note: form.note };
      if (form.code.trim()) body.code = form.code;
      const r = await api.post('/admin/codes', body);
      toast(`Code ${r.display} created`);
      setForm({ ...form, code: '', note: '' });
      load();
    } catch (err) { fail(err); }
  };
  const give = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post('/admin/grants', { email: grant.email, days: Number(grant.days) });
      toast(`${r.email} has Pro until ${new Date(r.until * 1000).toLocaleDateString()}`);
      setGrant({ ...grant, email: '' });
    } catch (err) { fail(err); }
  };
  const remove = async (code) => { try { await api.del(`/admin/codes/${code}`); load(); } catch (err) { fail(err); } };
  return html`<section class="card card-pad stack"><h2 class="display h-s">Pro access</h2>
    <form class="row" style=${{ flexWrap: 'wrap', gap: '8px' }} onSubmit=${give}>
      <input class="input grow" type="email" required aria-label="Email to give Pro" placeholder="Email of an existing account" value=${grant.email} onInput=${(e) => setGrant({ ...grant, email: e.target.value })} />
      <input class="input" style=${{ width: '90px' }} type="number" min="1" max="3660" aria-label="Days of Pro" title="Days of Pro" value=${grant.days} onInput=${(e) => setGrant({ ...grant, days: e.target.value })} />
      <button class="btn btn-primary">Give Pro</button>
    </form>
    <form class="row" style=${{ flexWrap: 'wrap', gap: '8px' }} onSubmit=${create}>
      <input class="input" style=${{ width: '170px' }} aria-label="Custom code" placeholder="Code (blank = random)" value=${form.code} onInput=${set('code')} />
      <input class="input" style=${{ width: '90px' }} type="number" min="1" max="3660" aria-label="Days of Pro" title="Days of Pro" value=${form.days} onInput=${set('days')} />
      <input class="input" style=${{ width: '90px' }} type="number" min="1" aria-label="Max uses" title="How many people can use it" value=${form.maxUses} onInput=${set('maxUses')} />
      <input class="input grow" aria-label="Note" placeholder="Note (who is it for?)" value=${form.note} onInput=${set('note')} />
      <button class="btn btn-primary">Create code</button>
    </form>
    ${codes.length ? html`<table class="table"><thead><tr><th>Code</th><th class="num">Days</th><th class="num">Used</th><th>Note</th><th></th></tr></thead><tbody>${codes.map((c) => html`<tr key=${c.code}><td><b>${c.code}</b></td><td class="num">${c.days}</td><td class="num">${c.uses}/${c.maxUses}</td><td>${c.note}</td><td><button class="btn btn-ghost" onClick=${() => remove(c.code)}>Delete</button></td></tr>`)}</tbody></table>` : html`<p class="muted">No codes yet.</p>`}
  </section>`;
}

const when = (ts) => (ts ? new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '–');
const ago = (ts) => {
  if (!ts) return 'never';
  const d = Math.floor((Date.now() / 1000 - ts) / 86400);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

/** A labelled list with proportional bars. */
function Bars({ title, rows, empty = 'No data yet.', total }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return html`<section class="card card-pad stack"><h2 class="display h-s">${title}</h2>
    ${rows.length ? html`<div class="stack" style=${{ gap: '8px' }}>${rows.map((r) => html`<div key=${r.label} class="row small"><span style=${{ width: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title=${r.label}>${r.label}</span><div class="meter grow"><i style=${{ width: `${(r.count / max) * 100}%` }}></i></div><span class="num" style=${{ width: '64px', textAlign: 'right' }}>${r.count}${total ? ` · ${Math.round((r.count / total) * 100)}%` : ''}</span></div>`)}</div>` : html`<p class="muted">${empty}</p>`}
  </section>`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

/** When people use the app: a weekday-by-hour heatmap plus the headline engagement numbers. */
function UsageTimes() {
  const [a, setA] = useState(null);
  const [err, setErr] = useState(null);
  const loadA = () => { setErr(null); api.get(`/admin/activity?tz=${-new Date().getTimezoneOffset()}`).then(setA).catch(setErr); };
  useEffect(() => { loadA(); }, []);
  if (err) return html`<${Failed} error=${err} onRetry=${loadA} />`;
  if (!a) return html`<div class="skel" style=${{ height: '220px' }}></div>`;
  const peak = Math.max(1, ...a.heat.flat());
  const maxHour = Math.max(1, ...a.byHour);
  const maxDay = Math.max(1, ...a.byWeekday);
  const maxDaily = Math.max(1, ...a.daily.map((d) => d.users));
  const busiest = a.byHour.indexOf(Math.max(...a.byHour));
  const empty = a.byHour.every((n) => n === 0);
  return html`<section class="card card-pad stack"><h2 class="display h-s">When people use ModaWard</h2>
    <p class="muted small">Times are in your own time zone. ${a.tracking ? `Tracking since ${a.tracking}.` : 'Counting starts with the first visit after this update.'} Each square counts people active in that hour over the last 90 days.</p>
    ${empty ? html`<p class="muted">No activity recorded yet.</p>` : html`
      <div class="grid wide">
        <${Stat} label="Busiest hour" value=${hourLabel(busiest)} />
        <${Stat} label="Average daily users" value=${a.avgDau} sub="last 7 days" />
        <${Stat} label="Stickiness" value=${`${a.stickiness}%`} sub="daily users ÷ monthly users" />
        <${Stat} label="Active days per person" value=${a.activeDaysPerUser} sub=${`of the last 30, among ${a.mau} active`} />
      </div>
      <div style=${{ overflowX: 'auto' }}>
        <div class="heat" role="img" aria-label="Activity by weekday and hour">
          <span></span>${Array.from({ length: 24 }, (_, h) => html`<span key=${h} class="heat-h">${h % 6 === 0 ? hourLabel(h) : ''}</span>`)}
          ${a.heat.map((row, d) => html`<span key=${`l${d}`} class="heat-d">${WEEKDAYS[d]}</span>${row.map((n, h) => html`<i key=${`${d}-${h}`} class="heat-c" title=${`${WEEKDAYS[d]} ${hourLabel(h)}: ${n}`} style=${{ opacity: n ? 0.18 + 0.82 * (n / peak) : 0.06 }}></i>`)}`)}
        </div>
      </div>
      <div class="grid wide" style=${{ alignItems: 'start' }}>
        <section class="stack"><h3 class="eyebrow">By hour of day</h3>
          <div class="cols" role="img" aria-label="Activity by hour of day">${a.byHour.map((n, h) => html`<div key=${h} class="col" title=${`${hourLabel(h)}: ${n}`}><i style=${{ height: `${Math.max(n ? 6 : 2, (n / maxHour) * 100)}%` }}></i></div>`)}</div>
          <div class="row small faint" style=${{ justifyContent: 'space-between' }}><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div></section>
        <section class="stack"><h3 class="eyebrow">By day of week</h3><div class="stack" style=${{ gap: '4px' }}>${a.byWeekday.map((n, d) => html`<div key=${d} class="row small"><span class="faint" style=${{ width: '44px' }}>${WEEKDAYS[d]}</span><div class="meter grow"><i style=${{ width: `${(n / maxDay) * 100}%` }}></i></div><span class="num" style=${{ width: '32px', textAlign: 'right' }}>${n}</span></div>`)}</div>
          <h3 class="eyebrow" style=${{ marginTop: '12px' }}>Daily users, last 30 days</h3><div class="stack" style=${{ gap: '4px' }}>${a.daily.slice(-14).map((d) => html`<div key=${d.day} class="row small"><span class="faint num" style=${{ width: '44px' }}>${d.day.slice(5)}</span><div class="meter grow"><i style=${{ width: `${(d.users / maxDaily) * 100}%` }}></i></div><span class="num" style=${{ width: '32px', textAlign: 'right' }}>${d.users}</span></div>`)}</div></section>
      </div>`}
  </section>`;
}

function Overview() {
  const [m, setM] = useState(null);
  const [err, setErr] = useState(null);
  const loadM = () => { setErr(null); api.get('/admin/metrics').then(setM).catch(setErr); };
  useEffect(() => { loadM(); }, []);
  if (err) return html`<${Failed} error=${err} onRetry=${loadM} />`;
  if (!m) return html`<div class="skel" style=${{ height: '300px' }}></div>`;
  const max = Math.max(1, ...m.clicks.byDay.map((d) => d.clicks));
  const maxSign = Math.max(1, ...m.signups.map((d) => d.n));
  const profiled = m.audience.profiled;
  const reactions = (kind) => m.reactions.filter((r) => r.label === kind).map((r) => `${r.count} ${r.signal}`).join(', ') || 'none yet';
  return html`<div class="stack-l">
    <div class="grid wide">
      <${Stat} label="Users" value=${m.users.total} sub=${`${m.users.new7} this week · ${m.users.new30} this month`} />
      <${Stat} label="Paying Pro" value=${m.plans.paid} sub=${`${m.plans.comped} comped · ${m.conversion}% of users`} />
      <${Stat} label="Active (30 days)" value=${m.users.mau} sub=${`${m.users.wau} this week · ${m.users.dau} today`} />
      <${Stat} label="Came back after a week" value=${`${m.retention.week1}%`} sub=${m.retention.cohort ? `of ${m.retention.cohort} who joined 1–8 weeks ago` : 'needs users older than a week'} />
      <${Stat} label="Store clicks (30 days)" value=${m.clicks.total30} />
      <${Stat} label="Closet pieces" value=${m.closet.pieces} sub=${`${m.closet.usersWithCloset} users · ${m.closet.withPhotos} with photos`} />
    </div>

    <${UsageTimes} />

    <section class="card card-pad stack"><h2 class="display h-s">Where people drop off</h2>
      <p class="muted small">Share of everyone who signed up. The biggest drop is where to improve the app first.</p>
      <div class="stack" style=${{ gap: '8px' }}>${m.funnel.map((f) => html`<div key=${f.label} class="row small"><span style=${{ width: '190px' }}>${f.label}</span><div class="meter grow"><i style=${{ width: `${f.percent}%` }}></i></div><span class="num" style=${{ width: '96px', textAlign: 'right' }}>${f.count} · ${f.percent}%</span></div>`)}</div>
    </section>

    <section class="card card-pad stack"><h2 class="display h-s">New sign-ups, last 14 days</h2>
      ${m.signups.length ? html`<div class="stack" style=${{ gap: '6px' }}>${m.signups.map((d) => html`<div key=${d.day} class="row small"><span class="faint num" style=${{ width: '84px' }}>${d.day.slice(5)}</span><div class="meter grow"><i style=${{ width: `${(d.n / maxSign) * 100}%` }}></i></div><span class="num" style=${{ width: '36px', textAlign: 'right' }}>${d.n}</span></div>`)}</div>` : html`<p class="muted">No sign-ups in the last 14 days.</p>`}
    </section>

    <div class="grid wide">
      <${Bars} title="Style archetypes" rows=${m.audience.styles} total=${profiled} empty="Shows once people take the style quiz." />
      <${Bars} title="Cities" rows=${m.audience.cities} total=${profiled} empty="Shows once people set a location." />
      <${Bars} title="Shopping for" rows=${m.audience.departments} total=${profiled} />
      <${Bars} title="Age range" rows=${m.audience.ages} total=${profiled} empty="People can add this in their profile." />
      <${Bars} title="Language chosen" rows=${m.audience.languages || []} total=${profiled} />
      <${Bars} title="What they dress for" rows=${m.audience.occasions} total=${profiled} />
      <${Bars} title="Closet by category" rows=${m.closetMix} />
      <${Bars} title="Brands in closets" rows=${m.topGarmentBrands} />
    </div>

    <section class="card card-pad stack"><h2 class="display h-s">Shopping</h2>
      <p class="muted">Looks, last 30 days: ${reactions('look')}. Daily outfits: ${reactions('outfit')}. Saved looks overall: ${m.engagement.savedLooks}.</p>
      ${m.clicks.last30.length ? html`<table class="table"><thead><tr><th>Retailer</th><th class="num">Clicks</th><th class="num">Product links</th></tr></thead><tbody>${m.clicks.last30.map((r) => html`<tr key=${r.retailer}><td>${r.retailer}</td><td class="num">${r.clicks}</td><td class="num">${r.product_clicks}</td></tr>`)}</tbody></table>` : html`<p class="muted">No store clicks yet.</p>`}
      ${m.clicks.byDay.length ? html`<div class="stack" style=${{ gap: '6px' }}>${m.clicks.byDay.map((d) => html`<div key=${d.day} class="row small"><span class="faint num" style=${{ width: '84px' }}>${d.day.slice(5)}</span><div class="meter grow"><i style=${{ width: `${(d.clicks / max) * 100}%` }}></i></div><span class="num" style=${{ width: '36px', textAlign: 'right' }}>${d.clicks}</span></div>`)}</div>` : null}
    </section>

    <section class="card card-pad stack"><h2 class="display h-s">Engagement, catalogue and AI</h2>
      <p class="muted">${m.engagement.quizCompleted} completed the style quiz · ${m.engagement.feedback30} like/skip signals (30d) · ${m.closet.wearLogs30} outfits worn (30d)</p>
      <p class="muted">${m.catalogue.products} real products loaded${m.catalogue.byRetailer.length ? `: ${m.catalogue.byRetailer.map((r) => `${r.retailer} ${r.n}`).join(', ')}` : '. Import an affiliate feed to show real product photos.'}</p>
      <p class="muted">AI calls today: ${m.ai.today.length ? m.ai.today.map((a) => `${a.kind} ${a.calls}`).join(', ') : 'none'}</p>
      <p class="faint small">Updated ${new Date(m.generatedAt).toLocaleString()}</p>
    </section>
  </div>`;
}

function Users() {
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [sort, setSort] = useState('joined');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [tick, setTick] = useState(0);
  const timer = useRef(0);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const qs = new URLSearchParams({ q, plan, sort, page: String(page) });
      setErr(null);
      api.get(`/admin/users?${qs}`).then(setData).catch(setErr);
    }, q ? 250 : 0);
    return () => clearTimeout(timer.current);
  }, [q, plan, sort, page, tick]);
  const pages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;
  return html`<section class="card card-pad stack">
    <div class="row" style=${{ flexWrap: 'wrap', gap: '8px' }}>
      <input class="input grow" type="search" aria-label="Search users" placeholder="Search by name or email" value=${q} onInput=${(e) => { setQ(e.target.value); setPage(0); }} />
      <select class="input" style=${{ width: '130px' }} aria-label="Plan" value=${plan} onChange=${(e) => { setPlan(e.target.value); setPage(0); }}><option value="">All plans</option><option value="pro">Pro</option><option value="free">Free</option></select>
      <select class="input" style=${{ width: '170px' }} aria-label="Sort" value=${sort} onChange=${(e) => { setSort(e.target.value); setPage(0); }}><option value="joined">Newest first</option><option value="active">Recently active</option><option value="closet">Biggest closet</option></select>
    </div>
    ${err ? html`<${Failed} error=${err} onRetry=${() => setTick((x) => x + 1)} />` : !data ? html`<div class="skel" style=${{ height: '240px' }}></div>` : html`
      <p class="muted small">${data.total} ${data.total === 1 ? 'person' : 'people'}</p>
      ${data.users.length ? html`<div style=${{ overflowX: 'auto' }}><table class="table"><thead><tr><th>Person</th><th>Plan</th><th>Joined</th><th>Last seen</th><th class="num">Pieces</th><th class="num">Worn</th><th class="num">Saved</th><th class="num">Clicks</th><th>Where</th></tr></thead><tbody>${data.users.map((u) => html`<tr key=${u.id}>
        <td><b>${u.name || '(no name)'}</b><br /><span class="small muted">${u.email}</span></td>
        <td>${u.plan === 'pro' ? (u.plan_status === 'granted' ? `Pro (comped to ${when(u.plan_renews_at)})` : 'Pro') : 'Free'}</td>
        <td>${when(u.created_at)}</td><td>${ago(u.last_seen_at)}</td>
        <td class="num">${u.pieces}</td><td class="num">${u.wears}</td><td class="num">${u.saved}</td><td class="num">${u.clicks}</td>
        <td class="small">${[u.city, u.department && u.department !== 'unisex' ? u.department : null].filter(Boolean).join(' · ') || html`<span class="faint">–</span>`}${u.quizDone ? ' · quiz ✓' : ''}</td>
      </tr>`)}</tbody></table></div>` : html`<p class="muted">Nobody matches.</p>`}
      <div class="row" style=${{ justifyContent: 'space-between' }}>
        <button class="btn btn-outline" disabled=${page === 0} onClick=${() => setPage(page - 1)}>Previous</button>
        <span class="muted small">Page ${page + 1} of ${pages}</span>
        <button class="btn btn-outline" disabled=${page + 1 >= pages} onClick=${() => setPage(page + 1)}>Next</button>
      </div>`}
  </section>`;
}

function System() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try { setS(await api.get('/admin/system')); } catch (e) { setErr(e); }
    setBusy(false);
  };
  useEffect(() => { run(); }, []);
  const Row = ({ label, ok, detail }) => html`<tr><td>${label}</td><td>${ok === null ? html`<span class="faint">–</span>` : ok ? '✓ OK' : '✕ Problem'}</td><td class="small muted">${detail}</td></tr>`;
  return html`<section class="card card-pad stack"><div class="spread"><h2 class="display h-s">System check</h2><button class="btn btn-outline btn-s" onClick=${run} disabled=${busy}>${busy ? 'Checking…' : 'Run again'}</button></div>
    ${err ? html`<${Failed} error=${err} onRetry=${run} />` : !s ? html`<div class="skel" style=${{ height: '160px' }}></div>` : html`
      <table class="table"><thead><tr><th>Check</th><th>Result</th><th>Details</th></tr></thead><tbody>
        <${Row} label="Weather service" ok=${s.weather.probe.ok} detail=${s.weather.probe.ok ? `${s.weather.provider} answered in ${s.weather.probe.ms} ms` : `${s.weather.probe.error}${s.weather.probe.status ? ` (HTTP ${s.weather.probe.status})` : ''}${s.weather.probe.reason ? `: ${s.weather.probe.reason}` : ''}`} />
        <${Row} label="Last weather error" ok=${s.weather.lastError ? false : null} detail=${s.weather.lastError ? `${s.weather.lastError.message} · ${new Date(s.weather.lastError.at).toLocaleString()}` : 'none since the app last started'} />
        <${Row} label="Web address (APP_URL)" ok=${Boolean(s.appUrl)} detail=${s.appUrl || 'Not set. Password-reset and payment links need it.'} />
        <${Row} label="Your address, as the app sees it" ok=${null} detail=${`${s.network.clientIp} (forwarded: ${s.network.forwardedFor || 'none'}). This should be your own address. If it looks like a hosting server, or is the same for everyone, set TRUST_PROXY to the number of proxies in front of the app.`} />
        <${Row} label="Email (SMTP)" ok=${s.integrations.email} detail=${s.integrations.email ? 'configured' : 'Not configured: password-reset emails only go to the server log.'} />
        <${Row} label="Notifications (push)" ok=${s.integrations.push} detail=${s.integrations.push ? 'on: reminders reach installed apps' : 'Off: the web-push package is missing (run npm install) or PUSH_ENABLED=false.'} />
        <${Row} label="Payments (Stripe)" ok=${s.integrations.stripe} detail=${s.integrations.stripe ? 'configured' : 'Not switched on yet.'} />
        <${Row} label="AI stylist" ok=${s.integrations.ai} detail=${s.integrations.ai ? 'configured' : 'Not switched on (no ANTHROPIC_API_KEY).'} />
        <${Row} label="Disk space" ok=${s.ops.freeDiskMb === null ? null : s.ops.freeDiskMb > 200} detail=${s.ops.freeDiskMb === null ? 'unknown on this host' : `${s.ops.freeDiskMb} MB free · database ${s.ops.dbMb ?? '?'} MB. When the disk fills, nothing can be saved.`} />
        <${Row} label="Backups" ok=${s.ops.lastBackupDaysAgo === null ? false : s.ops.lastBackupDaysAgo <= 2} detail=${s.ops.lastBackupDaysAgo === null ? 'No backup found in the data folder. Schedule "npm run backup" daily (see docs/DEPLOY-HOSTINGER.md) and copy the backups off the server.' : `newest backup is ${s.ops.lastBackupDaysAgo} day(s) old. Keep a copy somewhere other than this server.`} />
        <${Row} label="Payment webhook secret" ok=${s.ops.billingOn ? s.ops.webhookSecret : null} detail=${s.ops.billingOn ? (s.ops.webhookSecret ? 'set' : 'STRIPE_WEBHOOK_SECRET is missing: customers who pay will stay on the free plan.') : 'payments are off'} />
        <${Row} label="Reminders" ok=${s.ops.remindersOn} detail=${s.ops.remindersOn ? 'the scheduler is on' : 'REMINDERS_ENABLED is off: no reminders are sent.'} />
        <${Row} label="Admin accounts" ok=${s.ops.unclaimedAdmins.length === 0} detail=${s.ops.unclaimedAdmins.length ? `Nobody has registered ${s.ops.unclaimedAdmins.join(', ')} yet. Register it yourself now: whoever signs up with an admin address first becomes an admin.` : 'every ADMIN_EMAILS address has an account'} />
        <${Row} label="Version running" ok=${true} detail=${`${s.build?.id || 'unknown'}${s.build?.builtAt ? ` · built ${new Date(s.build.builtAt).toLocaleString()}` : ''}`} />
        <${Row} label="Server" ok=${true} detail=${`Node ${s.node} · database ${s.database} · up ${s.uptimeMinutes} min · ${s.production ? 'production' : 'development'}`} />
      </tbody></table>
      <p class="faint small">Checked ${new Date(s.checkedAt).toLocaleString()}.</p>`}
  </section>`;
}


const money = (cents, cur = 'USD') => (cents == null ? '–' : new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(cents / 100));
const EMPTY_PRODUCT = { retailer: '', title: '', brand: '', url: '', imageUrl: '', price: '', type: '', color: '', gender: 'unisex' };

/** The product catalogue: add hand-picked products, or import a whole affiliate feed. */
function Products() {
  const [data, setData] = useState(null);
  const [retailer, setRetailer] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [imp, setImp] = useState({ retailer: '', text: '', name: '', fullSync: false });
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState(false);
  const fileRef = useRef(null);

  const load = (p = page) => api.get(`/admin/products?retailer=${encodeURIComponent(retailer)}&q=${encodeURIComponent(q)}&page=${p}`).then(setData).catch(fail);
  useEffect(() => { load(); }, [retailer, page]);
  useEffect(() => { const id = setTimeout(() => (page ? setPage(0) : load(0)), 300); return () => clearTimeout(id); }, [q]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/admin/products', form);
      toast('Product saved');
      setForm({ ...EMPTY_PRODUCT, retailer: form.retailer, type: form.type, gender: form.gender });
      load(0);
    } catch (err) { fail(err); } finally { setSaving(false); }
  };
  const stock = async (p) => { try { await api.patch(`/admin/products/${encodeURIComponent(p.id)}`, { inStock: !p.inStock }); load(); } catch (err) { fail(err); } };
  const remove = async (p) => { if (!confirm(`Delete “${p.title}”?`)) return; try { await api.del(`/admin/products/${encodeURIComponent(p.id)}`); load(); } catch (err) { fail(err); } };

  const pickFile = async (file) => {
    if (!file) return;
    if (file.size > 10_000_000) return toast('That file is over 10 MB. Use the command line importer for files that large.', { kind: 'err' });
    setPreview(null);
    setImp((cur) => ({ ...cur, text: '', name: file.name }));
    const text = await file.text();
    setImp((cur) => ({ ...cur, text }));
  };
  const runImport = async (dryRun) => {
    if (!imp.retailer) return toast('Choose the store this feed is from.', { kind: 'err' });
    if (!imp.text) return toast('Choose a feed file first.', { kind: 'err' });
    setWorking(true);
    try {
      const r = await api.post('/admin/products/import', { retailer: imp.retailer, text: imp.text, dryRun, fullSync: imp.fullSync });
      setPreview(r);
      if (!dryRun) {
        toast(`${r.inserted} added, ${r.updated} updated${r.markedOutOfStock ? `, ${r.markedOutOfStock} marked out of stock` : ''}`);
        load(0);
      }
    } catch (err) { fail(err); } finally { setWorking(false); }
  };

  if (!data) return html`<div class="skel" style=${{ height: '300px', borderRadius: '20px' }}></div>`;
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const cats = data.types.reduce((m, t) => ((m[t.category] ||= []).push(t), m), {});

  return html`<div class="stack-l">
    <section class="card card-pad stack">
      <h2 class="display h-s">Add a product</h2>
      <p class="muted small" style=${{ maxWidth: '70ch' }}>Use the product page address (your affiliate link works) and the product photo address given by the store or the affiliate network. Shoppers see the photo and tap through to this link.</p>
      <form class="stack" onSubmit=${add}>
        <div class="prod-form">
          <label class="field"><span class="label">Store</span><select class="select" required value=${form.retailer} onChange=${set('retailer')}><option value="" disabled>Choose…</option>${data.retailers.map((r) => html`<option key=${r} value=${r}>${r}</option>`)}</select></label>
          <label class="field"><span class="label">Name</span><input class="input" required maxlength="200" placeholder="Slim navy chinos" value=${form.title} onInput=${set('title')} /></label>
          <label class="field"><span class="label">Brand</span><input class="input" maxlength="60" value=${form.brand} onInput=${set('brand')} /></label>
          <label class="field span2"><span class="label">Product link (https)</span><input class="input" required type="url" placeholder="https://…" value=${form.url} onInput=${set('url')} /></label>
          <label class="field span2"><span class="label">Photo address (https)</span><input class="input" required type="url" placeholder="https://…/photo.jpg" value=${form.imageUrl} onInput=${set('imageUrl')} /></label>
          <label class="field"><span class="label">Price</span><input class="input" inputmode="decimal" placeholder="49.90" value=${form.price} onInput=${set('price')} /></label>
          <label class="field"><span class="label">What is it?</span><select class="select" required value=${form.type} onChange=${set('type')}><option value="" disabled>Choose…</option>${Object.entries(cats).map(([c, list]) => html`<optgroup key=${c} label=${c}>${list.map((t) => html`<option key=${t.id} value=${t.id}>${t.label}</option>`)}</optgroup>`)}</select></label>
          <label class="field"><span class="label">Colour</span><select class="select" required value=${form.color} onChange=${set('color')}><option value="" disabled>Choose…</option>${data.colors.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}</select></label>
          <label class="field"><span class="label">For</span><select class="select" value=${form.gender} onChange=${set('gender')}><option value="unisex">Anyone</option><option value="men">Men</option><option value="women">Women</option></select></label>
        </div>
        <div class="row" style=${{ gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button class="btn btn-primary" disabled=${saving}>Save product</button>
          ${/^https:\/\//.test(form.imageUrl) ? html`<img class="prod-thumb" src=${form.imageUrl} alt="Photo preview" onError=${(e) => (e.target.style.opacity = 0.2)} />` : null}
        </div>
      </form>
    </section>

    <section class="card card-pad stack">
      <h2 class="display h-s">Import a product feed</h2>
      <p class="muted small" style=${{ maxWidth: '70ch' }}>Your affiliate network (Rakuten, Impact, CJ, AWIN) lets you download a store’s feed as CSV, TSV or JSON. Choose the store, pick the file, check the preview, then import. Importing again later updates prices and photos.</p>
      <div class="row" style=${{ gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select class="select" style=${{ width: 'auto' }} aria-label="Store" value=${imp.retailer} onChange=${(e) => (setImp({ ...imp, retailer: e.target.value }), setPreview(null))}><option value="" disabled>Store…</option>${data.retailers.map((r) => html`<option key=${r} value=${r}>${r}</option>`)}</select>
        <button class="btn btn-outline" type="button" onClick=${() => fileRef.current?.click()}>${imp.name || 'Choose feed file'}</button>
        <input ref=${fileRef} type="file" accept=".csv,.tsv,.txt,.json,text/csv,application/json" hidden onChange=${(e) => { pickFile(e.target.files?.[0]); e.target.value = ''; }} />
        <label class="row small" style=${{ gap: '6px' }}><input type="checkbox" checked=${imp.fullSync} onChange=${(e) => setImp({ ...imp, fullSync: e.target.checked })} />Mark products missing from this file as out of stock</label>
      </div>
      <div class="row" style=${{ gap: '10px', flexWrap: 'wrap' }}>
        <button class="btn btn-outline" disabled=${working || !imp.text} onClick=${() => runImport(true)}>Preview</button>
        <button class="btn btn-primary" disabled=${working || !imp.text || !preview || !preview.dryRun || !preview.usable} onClick=${() => runImport(false)}>Import ${preview?.dryRun && preview.usable ? `${preview.usable} products` : ''}</button>
      </div>
      ${preview ? html`<div class="stack" style=${{ gap: '8px' }}>
        <p><b>${preview.dryRun ? 'Preview:' : 'Imported:'}</b> ${preview.rows} rows, ${preview.usable} usable, ${preview.skipped} skipped.</p>
        ${preview.reasons.length ? html`<ul class="small muted">${preview.reasons.map((r) => html`<li key=${r.reason}>${r.count} × ${r.reason}</li>`)}</ul>` : null}
        ${preview.byType.length ? html`<p class="small muted">${preview.byType.slice(0, 10).map((t) => `${t.type} ${t.count}`).join(' · ')}</p>` : null}
        <div class="prod-samples">${preview.sample.map((p) => html`<figure key=${p.title}><img src=${p.imageUrl} alt="" loading="lazy" referrerpolicy="no-referrer" /><figcaption class="small">${p.title}<br /><span class="muted">${money(p.priceCents, p.currency)}</span></figcaption></figure>`)}</div>
      </div>` : null}
    </section>

    <section class="card card-pad stack">
      <div class="spread" style=${{ flexWrap: 'wrap', gap: '10px' }}>
        <h2 class="display h-s">Catalogue <span class="muted">${data.total}</span></h2>
        <div class="row" style=${{ gap: '8px', flexWrap: 'wrap' }}>
          <select class="select" style=${{ width: 'auto' }} aria-label="Filter by store" value=${retailer} onChange=${(e) => (setRetailer(e.target.value), setPage(0))}><option value="">All stores</option>${data.byRetailer.map((r) => html`<option key=${r.retailer} value=${r.retailer}>${r.retailer} (${r.n})</option>`)}</select>
          <input class="input" type="search" style=${{ width: '200px' }} placeholder="Search name or brand" aria-label="Search products" value=${q} onInput=${(e) => setQ(e.target.value)} />
        </div>
      </div>
      ${data.products.length
        ? html`<div class="prod-list">${data.products.map((p) => html`<div class=${`prod-row ${p.inStock ? '' : 'off'}`} key=${p.id}>
            <img src=${p.imageUrl} alt="" loading="lazy" referrerpolicy="no-referrer" />
            <div class="stack" style=${{ gap: '2px', minWidth: 0 }}>
              <a href=${p.url} target="_blank" rel="noopener noreferrer nofollow"><b>${p.title}</b></a>
              <span class="small muted">${p.retailer} · ${p.type} · ${p.color} · ${p.gender} · ${money(p.priceCents, p.currency)}${p.inStock ? '' : ' · out of stock'}</span>
            </div>
            <div class="row" style=${{ gap: '6px' }}><button class="btn btn-ghost btn-s" onClick=${() => stock(p)}>${p.inStock ? 'Mark out of stock' : 'Back in stock'}</button><button class="btn btn-ghost btn-s" onClick=${() => remove(p)}>Delete</button></div>
          </div>`)}</div>
          <div class="row" style=${{ justifyContent: 'space-between' }}><button class="btn btn-ghost btn-s" disabled=${page === 0} onClick=${() => setPage(page - 1)}>Previous</button><span class="small muted">Page ${page + 1} of ${pages}</span><button class="btn btn-ghost btn-s" disabled=${page + 1 >= pages} onClick=${() => setPage(page + 1)}>Next</button></div>`
        : html`<p class="muted">No products yet. Add one above, or import a feed.</p>`}
    </section>
  </div>`;
}

/** Errors in the app's own code, as people's browsers reported them. */
function BrowserErrors() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);
  const load = () => { setErr(null); api.get('/admin/errors').then(setD).catch(setErr); };
  useEffect(() => { load(); }, []);
  if (err) return html`<${Failed} error=${err} onRetry=${load} />`;
  if (!d) return html`<div class="skel" style=${{ height: '100px' }}></div>`;
  return html`<section class="card card-pad stack"><div class="spread"><h2 class="display h-s">Problems in people’s browsers</h2><button class="btn btn-outline" onClick=${load}>Refresh</button></div>
    <p class="muted small">Errors in the app’s own code over the last 7 days, newest first. Network failures and problems the app already explains to people are not listed.</p>
    ${d.groups.length
      ? html`<table class="table"><thead><tr><th>What</th><th>Page</th><th class="num">Times</th><th class="num">People</th><th>Last</th></tr></thead><tbody>${d.groups.map((g) => html`<tr key=${g.message}><td><b>${g.message}</b>${g.stack ? html`<details><summary class="small muted">Details</summary><pre class="small" style=${{ whiteSpace: 'pre-wrap', maxWidth: '60ch' }}>${g.stack}\nbuild ${g.build}</pre></details>` : null}</td><td>${g.path}</td><td class="num">${g.count}</td><td class="num">${g.people}</td><td>${new Date(g.last_at * 1000).toLocaleString()}</td></tr>`)}</tbody></table>`
      : html`<p>✓ Nothing reported in the last 7 days.</p>`}
  </section>`;
}

export function AdminView() {
  const [tab, setTab] = useState('overview');
  return html`<div class="stack-l">
    <header class="stack"><h1 class="display h-xl">Business</h1>
      <div class="row" style=${{ gap: '8px', flexWrap: 'wrap' }} role="tablist">${[['overview', 'Overview'], ['users', 'Users'], ['access', 'Pro access'], ['products', 'Products'], ['system', 'System']].map(([id, label]) => html`<button key=${id} role="tab" class="chip" aria-selected=${tab === id} onClick=${() => setTab(id)}>${label}</button>`)}</div>
    </header>
    ${tab === 'overview' ? html`<${Overview} />` : tab === 'users' ? html`<${Users} />` : tab === 'system' ? html`<div class="stack-l"><${System} /><${BrowserErrors} /></div>` : tab === 'products' ? html`<${Products} />` : html`<${Access} />`}
  </div>`;
}
