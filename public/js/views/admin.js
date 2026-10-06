import { html, useState, useEffect } from '/js/ui.js';
import { api } from '/js/api.js';
import { fail } from '/js/store.js';

const Stat = ({ label, value, sub }) => html`<div class="card stat"><span class="eyebrow">${label}</span><b class="num">${value}</b>${sub ? html`<span class="small muted">${sub}</span>` : null}</div>`;

export function AdminView() {
  const [m, setM] = useState(null);
  useEffect(() => { api.get('/admin/metrics').then(setM).catch(fail); }, []);
  if (!m) return html`<div class="skel" style=${{ height: '300px' }}></div>`;
  const max = Math.max(1, ...m.clicks.byDay.map((d) => d.clicks));
  return html`<div class="stack-l">
    <header class="stack"><h1 class="display h-xl">Business</h1><p class="muted">Updated ${new Date(m.generatedAt).toLocaleString()}</p></header>
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
