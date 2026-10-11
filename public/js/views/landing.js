import { html } from '/js/ui.js';
import { useStore } from '/js/store.js';
import { promoLine } from '/js/promo.js';
import { t } from '/js/i18n.js';
import { Icon, Logo } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { LanguagePicker } from '/js/components/common.js';
import { Link } from '/js/router.js';
import { BOARD_A, BOARD_B } from '/js/views/auth.js';

/** What the app is and why you would want it, with a way in. This is what signed-out visitors see first. */
export function LandingView() {
  const { capabilities } = useStore();
  const promo = promoLine(capabilities?.promo?.proDays);
  const steps = [
    [t('Tell us your style'), t('Take a one-minute quiz: the looks you love, your colours, sizes and budget.')],
    [t('Add your closet'), t('Start with a ready-made wardrobe, or photograph your own pieces. The background is removed for you.')],
    [t('Get today’s look'), t('A full outfit for the weather you’ll actually have, hour by hour. Swap any piece and it learns what you like.')]
  ];
  const features = [
    ['sun', t('Outfits for the real weather'), t('Warm enough, dry enough, and never overdressed for the afternoon.')],
    ['shirt', t('Your own closet'), t('See what you wear, what you forget, and what each piece costs per wear.')],
    ['calendar', t('The week and your trips'), t('Plan the days ahead, and build a packing list for a trip.')],
    ['bag', t('Looks to shop'), t('Complete looks from the stores you pick, matched to your taste.')],
    ['sparkle', t('It learns your taste'), t('Love it, skip it, swap it. Trends only ever nudge between looks you already like.')],
    ['bell', t('A nudge each morning'), t('An optional email or notification with today’s look, at the time you choose.')]
  ];
  return html`<div class="land">
    <header class="land-top"><span class="brand"><${Logo} size=${26} />ModaWard</span><div class="row" style=${{ gap: '10px' }}><${LanguagePicker} /><${Link} href="/login" class="btn btn-ghost btn-s">${t('Sign in')}</${Link}></div></header>
    <main id="main" tabindex="-1">
      <section class="land-hero" aria-labelledby="land-h">
        <div class="stack-l land-copy">
          ${promo ? html`<span class="land-promo"><${Icon} name="sparkle" size="16" />${promo}</span>` : html`<span class="eyebrow">${t('Your daily stylist')}</span>`}
          <h1 id="land-h" class="display h-xl">${t('Dress for the day')} <span class="italic">${t('ahead.')}</span></h1>
          <p class="land-lead">${t('Open ModaWard each morning and know exactly what to wear: pieces from your own closet, matched to the hour-by-hour forecast and to your personal style.')}</p>
          <div class="row-wrap"><${Link} href="/register" class="btn btn-primary btn-l">${t('Get started free')}</${Link}><${Link} href="/login" class="btn btn-outline btn-l">${t('Sign in')}</${Link}></div>
          <ul class="land-perks">${[t('Free to start. No card needed.'), t('Works on your phone'), t('Ready in about a minute')].map((x) => html`<li key=${x}><${Icon} name="check" size="16" />${x}</li>`)}</ul>
        </div>
        <figure class="land-demo" aria-label=${t('An example of today’s look')}>
          <div class="land-boards" aria-hidden="true"><div><${OutfitArt} items=${BOARD_A} /></div><div><${OutfitArt} items=${BOARD_B} /></div></div>
          <figcaption class="land-note"><span class="land-pill"><${Icon} name="sun" size="15" />${t('Light rain after 3 pm')}</span><span>${t('Trench for the rain, loafers for the office.')}</span></figcaption>
        </figure>
      </section>

      <section class="land-section" aria-labelledby="land-how">
        <h2 id="land-how" class="display h-l">${t('How it works')}</h2>
        <ol class="land-steps">${steps.map(([title, text], i) => html`<li key=${i} class="card card-pad stack" style=${{ gap: '8px' }}><span class="eyebrow">${t('Step {n} of {total}', { n: i + 1, total: steps.length })}</span><h3 class="display h-m">${title}</h3><p class="muted">${text}</p></li>`)}</ol>
      </section>

      <section class="land-section" aria-labelledby="land-what">
        <h2 id="land-what" class="display h-l">${t('Everything for getting dressed')}</h2>
        <ul class="land-grid">${features.map(([icon, title, text]) => html`<li key=${title} class="stack" style=${{ gap: '8px' }}><span class="land-icon" aria-hidden="true"><${Icon} name=${icon} size="22" /></span><h3 class="land-h3">${title}</h3><p class="muted">${text}</p></li>`)}</ul>
      </section>

      <section class="land-section land-trust" aria-labelledby="land-trust">
        <h2 id="land-trust" class="display h-l">${t('Yours to keep private')}</h2>
        <p class="muted">${t('Your closet and photos are private to you. You can export or delete everything whenever you like. Suggestions are style guidance only: you decide what you wear and buy.')}</p>
      </section>

      <section class="land-cta" aria-labelledby="land-go">
        <h2 id="land-go" class="display h-xl">${t('Ready when you are.')}</h2>
        ${promo ? html`<p class="muted">${promo}</p>` : null}
        <div class="row-wrap" style=${{ justifyContent: 'center' }}><${Link} href="/register" class="btn btn-primary btn-l">${t('Get started free')}</${Link}><${Link} href="/login" class="btn btn-outline btn-l">${t('Sign in')}</${Link}></div>
      </section>
    </main>
    <footer class="land-foot"><span class="muted small">ModaWard</span><nav class="row-wrap"><${Link} href="/pro" class="muted small">${t('Pro')}</${Link}><${Link} href="/terms" class="muted small">${t('Terms')}</${Link}><${Link} href="/privacy" class="muted small">${t('Privacy Policy')}</${Link}></nav></footer>
  </div>`;
}
