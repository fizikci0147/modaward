import { html, useState, useEffect } from '/js/ui.js';
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

export function AdminView() {
  const [m, setM] = useState(null);
  useEffect(() => { api.get('/admin/metrics').then(setM).catch(fail); }, []);
  if (!m) return html`<div class="skel" style=${{ height: '300px' }}></div>`;
  const max = Math.max(1, ...m.clicks.byDay.map((d) => d.clicks));
  return html`<div class="stack-l">
    <header class="stack"><h1 class="display h-xl">Business</h1><p class="muted">Updated ${new Date(m.generatedAt).toLocaleString()}</p></header>
    <${Access} />
    <div class="grid wide">
      <${Stat} label="Users" value=${m.users.total} sub=${`${m.users.new7} new this week`} />
      <${Stat} label="Pro" value=${m.users.pro} sub=${`${m.conversion}% conversion`} />
      <${Stat} label="Monthly active" value=${m.users.mau} sub=${`${m.users.wau} weekly · ${m.users.dau} daily`} />
      <${Stat} label="Shop clicks (30d)" value=${m.clicks.total30} />
      <${Stat} label="Closet pieces" value=${m.closet.pieces} sub=${`${m.closet.usersWithCloset} users · ${m.closet.withPhotos} with photos`} />
    </div>
    <section class="card card-pad stack"><h2 class="display h-s">Affiliate clicks by retailer</h2>
      ${m.clicks.last30.length ? html`<table class="table"><thead><tr><th>Retailer</th><th class="num">Clicks</th><th class="num">Product links</th></tr></thead><tbody>${m.clicks.last30.map((r) => html`<tr key=${r.retailer}><td>${r.retailer}</td><td class="num">${r.clicks}</td><td class="num">${r.product_clicks}</td></tr>`)}</tbody></table>` : html`<p class="muted">No clicks yet.</p>`}
    </section>
    <section class="card card-pad stack"><h2 class="display h-s">Clicks, last 14 days</h2>
      ${m.clicks.byDay.length ? null : html`<p class="muted">No clicks yet. They appear here once people tap through to a retailer.</p>`}
      <div class="stack" style=${{ gap: '6px' }}>${m.clicks.byDay.map((d) => html`<div key=${d.day} class="row small"><span class="faint num" style=${{ width: '84px' }}>${d.day.slice(5)}</span><div class="meter grow"><i style=${{ width: `${(d.clicks / max) * 100}%` }}></i></div><span class="num" style=${{ width: '36px', textAlign: 'right' }}>${d.clicks}</span></div>`)}</div>
    </section>
    <section class="card card-pad stack"><h2 class="display h-s">Engagement</h2>
      <p class="muted">${m.engagement.quizCompleted} completed the style quiz · ${m.engagement.feedback30} like/skip signals (30d) · ${m.engagement.savedLooks} saved looks · ${m.closet.wearLogs30} outfits worn (30d)</p>
    </section>
    <section class="card card-pad stack"><h2 class="display h-s">Catalogue and AI</h2>
      <p class="muted">${m.catalogue.products} real products loaded${m.catalogue.byRetailer.length ? `: ${m.catalogue.byRetailer.map((r) => `${r.retailer} ${r.n}`).join(', ')}` : '. Import an affiliate feed to show real product photos.'}</p>
      <p class="muted">AI calls today: ${m.ai.today.length ? m.ai.today.map((a) => `${a.kind} ${a.calls}`).join(', ') : 'none'}</p>
    </section>
  </div>`;
}
