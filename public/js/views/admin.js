import { html, useState, useEffect, useRef } from '/js/ui.js';
import { api } from '/js/api.js';
import { fail, toast } from '/js/store.js';

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
  useEffect(() => {
    api.get(`/admin/activity?tz=${-new Date().getTimezoneOffset()}`).then(setA).catch(fail);
  }, []);
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
  useEffect(() => { api.get('/admin/metrics').then(setM).catch(fail); }, []);
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
  const timer = useRef(0);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const qs = new URLSearchParams({ q, plan, sort, page: String(page) });
      api.get(`/admin/users?${qs}`).then(setData).catch(fail);
    }, q ? 250 : 0);
    return () => clearTimeout(timer.current);
  }, [q, plan, sort, page]);
  const pages = data ? Math.max(1, Math.ceil(data.total / 25)) : 1;
  return html`<section class="card card-pad stack">
    <div class="row" style=${{ flexWrap: 'wrap', gap: '8px' }}>
      <input class="input grow" type="search" aria-label="Search users" placeholder="Search by name or email" value=${q} onInput=${(e) => { setQ(e.target.value); setPage(0); }} />
      <select class="input" style=${{ width: '130px' }} aria-label="Plan" value=${plan} onChange=${(e) => { setPlan(e.target.value); setPage(0); }}><option value="">All plans</option><option value="pro">Pro</option><option value="free">Free</option></select>
      <select class="input" style=${{ width: '170px' }} aria-label="Sort" value=${sort} onChange=${(e) => { setSort(e.target.value); setPage(0); }}><option value="joined">Newest first</option><option value="active">Recently active</option><option value="closet">Biggest closet</option></select>
    </div>
    ${!data ? html`<div class="skel" style=${{ height: '240px' }}></div>` : html`
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
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { setS(await api.get('/admin/system')); } catch (e) { fail(e); }
    setBusy(false);
  };
  useEffect(() => { run(); }, []);
  const Row = ({ label, ok, detail }) => html`<tr><td>${label}</td><td>${ok === null ? html`<span class="faint">–</span>` : ok ? '✓ OK' : '✕ Problem'}</td><td class="small muted">${detail}</td></tr>`;
  return html`<section class="card card-pad stack"><div class="spread"><h2 class="display h-s">System check</h2><button class="btn btn-outline btn-s" onClick=${run} disabled=${busy}>${busy ? 'Checking…' : 'Run again'}</button></div>
    ${!s ? html`<div class="skel" style=${{ height: '160px' }}></div>` : html`
      <table class="table"><thead><tr><th>Check</th><th>Result</th><th>Details</th></tr></thead><tbody>
        <${Row} label="Weather service" ok=${s.weather.probe.ok} detail=${s.weather.probe.ok ? `${s.weather.provider} answered in ${s.weather.probe.ms} ms` : `${s.weather.probe.error}${s.weather.probe.status ? ` (HTTP ${s.weather.probe.status})` : ''}${s.weather.probe.reason ? `: ${s.weather.probe.reason}` : ''}`} />
        <${Row} label="Last weather error" ok=${s.weather.lastError ? false : null} detail=${s.weather.lastError ? `${s.weather.lastError.message} · ${new Date(s.weather.lastError.at).toLocaleString()}` : 'none since the app last started'} />
        <${Row} label="Web address (APP_URL)" ok=${Boolean(s.appUrl)} detail=${s.appUrl || 'Not set. Password-reset and payment links need it.'} />
        <${Row} label="Email (SMTP)" ok=${s.integrations.email} detail=${s.integrations.email ? 'configured' : 'Not configured: password-reset emails only go to the server log.'} />
        <${Row} label="Payments (Stripe)" ok=${s.integrations.stripe} detail=${s.integrations.stripe ? 'configured' : 'Not switched on yet.'} />
        <${Row} label="AI stylist" ok=${s.integrations.ai} detail=${s.integrations.ai ? 'configured' : 'Not switched on (no ANTHROPIC_API_KEY).'} />
        <${Row} label="Version running" ok=${true} detail=${`${s.build?.id || 'unknown'}${s.build?.builtAt ? ` · built ${new Date(s.build.builtAt).toLocaleString()}` : ''}`} />
        <${Row} label="Server" ok=${true} detail=${`Node ${s.node} · database ${s.database} · up ${s.uptimeMinutes} min · ${s.production ? 'production' : 'development'}`} />
      </tbody></table>
      <p class="faint small">Checked ${new Date(s.checkedAt).toLocaleString()}.</p>`}
  </section>`;
}

export function AdminView() {
  const [tab, setTab] = useState('overview');
  return html`<div class="stack-l">
    <header class="stack"><h1 class="display h-xl">Business</h1>
      <div class="row" style=${{ gap: '8px', flexWrap: 'wrap' }} role="tablist">${[['overview', 'Overview'], ['users', 'Users'], ['access', 'Pro access'], ['system', 'System']].map(([id, label]) => html`<button key=${id} role="tab" class="chip" aria-selected=${tab === id} onClick=${() => setTab(id)}>${label}</button>`)}</div>
    </header>
    ${tab === 'overview' ? html`<${Overview} />` : tab === 'users' ? html`<${Users} />` : tab === 'system' ? html`<${System} />` : html`<${Access} />`}
  </div>`;
}
