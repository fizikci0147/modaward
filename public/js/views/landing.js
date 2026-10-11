import { html } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { useStore, proOffered } from '/js/store.js';
import { promoLine } from '/js/promo.js';
import { isNativeApp } from '/js/native.js';
import { Icon, Logo } from '/js/icons.js';
import { LanguagePicker } from '/js/components/common.js';
import { Link } from '/js/router.js';

/** A real screen from the app, in a phone frame (public/img/landing/, made by mobile/store/make-landing-images.mjs). */
function Phone({ id, eager = false }) {
  return html`<div class="land-phone"><img src=${`/img/landing/${id}.webp`} width="540" height="1173" alt="" loading=${eager ? 'eager' : 'lazy'} decoding="async" fetchpriority=${eager ? 'high' : undefined} /></div>`;
}

/** What the app is, how it works, and why you would want it, with a way in. This is what signed-out visitors see first. */
export function LandingView() {
  const { capabilities } = useStore();
  const free = capabilities?.pricing === 'free';
  const promo = promoLine(capabilities?.promo?.proDays);
  const steps = [
    ['style', t('Tell us your style'), t('A one-minute quiz: vote on a few looks, pick the colours you love and the ones you never wear, and add your sizes and budget. You can change any answer later, and it keeps learning from every outfit you love or skip.')],
    ['closet', t('Add your closet'), t('Start with a ready-made wardrobe to see outfits in seconds, then add your own pieces. Photograph a piece and the background is removed for you, or add several at once.')],
    ['today', t('Get today’s look'), t('Every morning ModaWard reads the forecast for your city, hour by hour, and builds a complete outfit from your closet: warm enough, dry enough and right for the occasion. Don’t like a piece? Swap it, and it learns.')]
  ];
  const considers = [
    ['sun', t('The weather'), t('Temperature, how it feels, rain, wind and sun, hour by hour.')],
    ['calendar', t('The occasion'), t('Casual, work, a date, a formal event or a workout.')],
    ['sparkle', t('Your taste'), t('The styles and colours you love, and anything you never wear.')],
    ['shirt', t('What goes together'), t('Colours, formality, layers and shoes that make sense as a whole.')],
    ['bag', t('Your closet'), t('Only pieces you own, and it notices the ones you have not worn in a while.')]
  ];
  const more = [
    ['week', t('Plan the week'), t('See every day’s forecast with a look to match, and add events so a wedding day gets a formal outfit.')],
    ['trip', t('Pack for a trip'), t('Choose where and for how long. ModaWard picks the fewest pieces that work for every day’s weather and makes a packing list.')],
    ['shop', t('Looks to shop'), t('Complete looks from the stores you pick, built around your taste, plus the pieces your closet is missing.')],
    ['insights', t('Wear more of what you own'), t('See what you wear, what you forget, and what each piece costs per wear.')]
  ];
  const faq = [
    [t('Do I have to photograph my whole closet?'), t('No. Start with the ready-made wardrobe, or add just a few pieces. Add more whenever you like, one at a time or several at once.')],
    [t('How does it choose outfits?'), t('ModaWard’s own styling engine scores combinations on how comfortable they are in the weather, how well the pieces go together, the occasion and your taste, then shows you the best.')],
    [t('Is it really free?'), free ? t('ModaWard is free. When you buy something through a shop link we may earn a commission, at no extra cost to you.') : t('You can use ModaWard free. An optional Pro plan removes the limits.')],
    !isNativeApp ? [t('Does it work on my phone?'), t('Yes. It works in your phone’s browser, and you can add it to your home screen to open it like an app.')] : null,
    [t('Which languages does it speak?'), 'English, Español, Français, Deutsch, Português, Italiano, Türkçe.']
  ].filter(Boolean);
  const signUp = html`<div class="row-wrap"><${Link} href="/register" class="btn btn-primary btn-l">${t('Get started free')}</${Link}><${Link} href="/login" class="btn btn-outline btn-l">${t('Sign in')}</${Link}></div>`;

  return html`<div class="land">
    <header class="land-top"><span class="brand"><${Logo} size=${26} />ModaWard</span><div class="row" style=${{ gap: '10px' }}><${LanguagePicker} /><${Link} href="/login" class="btn btn-ghost btn-s">${t('Sign in')}</${Link}></div></header>
    <main id="main" tabindex="-1">
      <section class="land-hero" aria-labelledby="land-h">
        <div class="stack-l land-copy">
          ${promo ? html`<span class="land-promo"><${Icon} name="sparkle" size="16" />${promo}</span>` : html`<span class="eyebrow">${t('Your daily stylist')}</span>`}
          <h1 id="land-h" class="display h-xl">${t('Dress for the day')} <span class="italic">${t('ahead.')}</span></h1>
          <p class="land-lead">${t('Open ModaWard each morning and know exactly what to wear: pieces from your own closet, matched to the hour-by-hour forecast and to your personal style.')}</p>
          ${signUp}
          <ul class="land-perks">${[free ? t('Free, with no card needed.') : t('Free to start. No card needed.'), t('Works on your phone'), t('Ready in about a minute')].map((x) => html`<li key=${x}><${Icon} name="check" size="16" />${x}</li>`)}</ul>
        </div>
        <${Phone} id="today" eager />
      </section>

      <section class="land-section" aria-labelledby="land-how">
        <h2 id="land-how" class="display h-l">${t('How it works')}</h2>
        <ol class="land-steps">${steps.map(([id, title, text], i) => html`<li key=${id} class=${`land-step ${i % 2 ? 'rev' : ''}`}><${Phone} id=${id} /><div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">${t('Step {n} of {total}', { n: i + 1, total: steps.length })}</span><h3 class="display h-m">${title}</h3><p class="muted land-text">${text}</p></div></li>`)}</ol>
      </section>

      <section class="land-section" aria-labelledby="land-what">
        <div class="stack" style=${{ gap: '8px' }}><h2 id="land-what" class="display h-l">${t('What goes into every look')}</h2><p class="muted land-text">${t('ModaWard’s own styling engine weighs five things before it shows you an outfit.')}</p></div>
        <ul class="land-grid">${considers.map(([icon, title, text]) => html`<li key=${title} class="stack" style=${{ gap: '8px' }}><span class="land-icon" aria-hidden="true"><${Icon} name=${icon} size="22" /></span><h3 class="land-h3">${title}</h3><p class="muted">${text}</p></li>`)}</ul>
      </section>

      <section class="land-section" aria-labelledby="land-more">
        <h2 id="land-more" class="display h-l">${t('Plan ahead, pack and shop')}</h2>
        <ul class="land-more">${more.map(([id, title, text]) => html`<li key=${id} class="stack" style=${{ gap: '14px' }}><${Phone} id=${id} /><div class="stack" style=${{ gap: '6px' }}><h3 class="land-h3">${title}</h3><p class="muted">${text}</p></div></li>`)}</ul>
      </section>

      <section class="land-section land-trust" aria-labelledby="land-trust">
        <h2 id="land-trust" class="display h-l">${t('Yours to keep private')}</h2>
        <p class="muted">${t('Your closet and photos are private to you. You can export or delete everything whenever you like. Suggestions are style guidance only: you decide what you wear and buy.')}</p>
      </section>

      <section class="land-section land-faq" aria-labelledby="land-faq">
        <h2 id="land-faq" class="display h-l">${t('Questions')}</h2>
        <div class="land-qa">${faq.map(([q, a]) => html`<details key=${q}><summary>${q}</summary><p class="muted">${a}</p></details>`)}</div>
      </section>

      <section class="land-cta" aria-labelledby="land-go">
        <h2 id="land-go" class="display h-xl">${t('Ready when you are.')}</h2>
        ${promo ? html`<p class="muted">${promo}</p>` : null}
        <div style=${{ display: 'flex', justifyContent: 'center' }}>${signUp}</div>
      </section>
    </main>
    <footer class="land-foot"><span class="muted small">ModaWard</span><nav class="row-wrap">${proOffered() ? html`<${Link} href="/pro" class="muted small">${t('Pro')}</${Link}>` : null}<${Link} href="/terms" class="muted small">${t('Terms')}</${Link}><${Link} href="/privacy" class="muted small">${t('Privacy Policy')}</${Link}></nav></footer>
  </div>`;
}
