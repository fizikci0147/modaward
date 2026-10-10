import { html, useState } from '/js/ui.js';
import { t, tn } from '/js/i18n.js';
import { api } from '/js/api.js';
import { useStore, updateProfile, loadCloset, fail } from '/js/store.js';
import { Icon, Logo } from '/js/icons.js';
import { LocationPicker, Spinner, LanguagePicker } from '/js/components/common.js';
import { GarmentArt } from '/js/components/art.js';
import { AboutSection, StyleVotesSection, ColoursSection, SizesFitSection, LifestyleBudget, NeverSection, TrendSection, BrandsStoresSection } from '/js/views/profile.js';
import { navigate } from '/js/router.js';

const STEPS = ['location', 'about', 'style', 'colours', 'fit', 'life', 'rules', 'closet'];

/** One step of the quiz: where we are, what this is for, the questions, and a way forward and back. */
function QuizStep({ n, total, title, blurb, onBack, onNext, nextLabel, nextDisabled, hint, children }) {
  return html`<section class="stack-l enter" key=${title}>
    <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">${t('Step {n} of {total}', { n, total })}</span><h1 class="display h-xl">${title}</h1><p class="muted">${blurb}</p></div>
    ${children}
    <div class="row" style=${{ gap: '10px' }}>
      <button class="btn btn-outline btn-l" onClick=${onBack}>${t('Back')}</button>
      <button class="btn btn-primary btn-l grow" onClick=${onNext} disabled=${nextDisabled}>${nextLabel || t('Continue')}</button>
    </div>
    ${hint ? html`<p class="footnote center">${hint}</p>` : null}
  </section>`;
}

/**
 * The style quiz people take when they join: who they shop for, which styles feel like them, colours,
 * fit and sizes, lifestyle and budget, their hard "nevers" and stores, and then the closet.
 * Everything saves as they go and every question stays editable under You.
 */
export function WelcomeView() {
  const { profile, user } = useStore();
  const retake = new URLSearchParams(location.search).get('quiz') === '1';
  const [step, setStep] = useState(profile?.location ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const picked = Object.values(profile?.style?.archetypes || {}).filter((w) => w >= 0.8).length;
  const total = STEPS.length;
  const go = (i) => { setStep(i); window.scrollTo({ top: 0 }); };
  const name = STEPS[step];

  const pickLocation = async (location) => {
    await updateProfile({ location }, { immediate: true, quiet: true }).catch(() => {});
    go(1);
  };
  const finish = async (starter) => {
    setBusy(true);
    try {
      if (starter) {
        await api.post('/garments/starter', {});
        await loadCloset(true);
      }
      navigate(starter ? '/' : '/closet?add=1', { replace: true });
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };
  const common = (i) => ({ n: i + 1, total, onBack: () => go(i - 1), onNext: () => (retake && i === total - 2 ? navigate('/style', { replace: true }) : go(i + 1)) });

  return html`<main class="welcome" id="main" tabindex="-1">
    <div class="spread"><span class="brand"><${Logo} size=${26} />ModaWard</span><${LanguagePicker} /><button class="btn btn-ghost btn-s" onClick=${() => navigate(retake ? '/style' : '/', { replace: true })}>${retake ? t('Close') : t('Skip for now')}</button></div>
    <div class="steps" aria-hidden="true">${STEPS.map((_, i) => html`<i key=${i} class=${i <= step ? 'on' : ''}></i>`)}</div>

    ${name === 'location'
      ? html`<section class="stack-l enter" key="s0">
          <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">${t('Step {n} of {total}', { n: 1, total })}</span><h1 class="display h-xl">${user?.name ? t('Welcome, {name}.', { name: user.name.split(' ')[0] }) : t('Welcome.')}<br /><span class="italic">${t('Where are you?')}</span></h1><p class="muted">${t('We read the forecast hour by hour for your city, so every outfit suits the day you’ll actually have.')}</p></div>
          <${LocationPicker} onPick=${pickLocation} />
        </section>`
      : null}

    ${name === 'about'
      ? html`<${QuizStep} ...${common(1)} onBack=${() => go(0)} title=${t('Let’s start with you')} blurb=${t('Tell us a little so we can pick the right weather, stores and occasions.')}>
          <${AboutSection} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'style'
      ? html`<${QuizStep} ...${common(2)} nextDisabled=${!picked} hint=${picked ? tn(picked, '{n} style loved.', '{n} styles loved.') : t('Love at least one style to continue.')}
          title=${html`${t('What’s your')} <span class="italic">${t('style?')}</span>`} blurb=${t('Vote on a few looks. It takes under a minute, and you can change it any time.')}>
          <${StyleVotesSection} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'colours'
      ? html`<${QuizStep} ...${common(3)} title=${t('Your colours')} blurb=${t('Pick the colours you love and the ones you would never wear.')}>
          <${ColoursSection} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'fit'
      ? html`<${QuizStep} ...${common(4)} title=${t('Fit and sizes')} blurb=${t('So suggestions fit your body and come in your size.')}>
          <${SizesFitSection} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'life'
      ? html`<${QuizStep} ...${common(5)} title=${t('Your life and budget')} blurb=${t('What you dress for and what you like to spend.')}>
          <${LifestyleBudget} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'rules'
      ? html`<${QuizStep} ...${common(6)} title=${t('Your rules and stores')} blurb=${t('Anything we must never suggest, how current you like to look, and where you like to shop.')}>
          <${NeverSection} profile=${profile} />
          <${TrendSection} profile=${profile} />
          <${BrandsStoresSection} profile=${profile} />
        </${QuizStep}>`
      : null}

    ${name === 'closet'
      ? html`<section class="stack-l enter" key="s7">
          <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">${t('Step {n} of {total}', { n: total, total })}</span><h1 class="display h-xl">${t('Now,')} <span class="italic">${t('your closet.')}</span></h1><p class="muted">${t('Start with a ready-made wardrobe to see outfits in seconds, then swap in your own pieces. Or add your own right away.')}</p></div>
          <div class="card card-pad stack" style=${{ gap: '18px' }}>
            <div class="row" style=${{ gap: '4px', justifyContent: 'center' }}>${[['tee', '#f7f6f2'], ['jeans', '#2b3a55'], ['sweater', '#1f2f54'], ['trench', '#cdb89a'], ['sneakers', '#f7f6f2']].map(([type, c]) => html`<div key=${type} style=${{ width: '64px', height: '64px' }}><${GarmentArt} type=${type} color=${c} /></div>`)}</div>
            <button class="btn btn-primary btn-l btn-block" onClick=${() => finish(true)} disabled=${busy}>${busy ? html`<${Spinner} />` : null}${t('Start with a starter wardrobe')}</button>
            <button class="btn btn-outline btn-block" onClick=${() => finish(false)} disabled=${busy}><${Icon} name="camera" />${t('I’ll add my own pieces')}</button>
            <button class="btn btn-ghost btn-block" onClick=${() => go(total - 2)} disabled=${busy}>${t('Back')}</button>
          </div>
        </section>`
      : null}
  </main>`;
}
