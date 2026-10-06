import { html, useState } from '/js/ui.js';
import { api } from '/js/api.js';
import { useStore, updateProfile, loadCloset, toast, fail } from '/js/store.js';
import { Icon, Logo } from '/js/icons.js';
import { LocationPicker, Spinner } from '/js/components/common.js';
import { GarmentArt } from '/js/components/art.js';
import { ArchetypeGrid } from '/js/views/profile.js';
import { navigate } from '/js/router.js';

export function WelcomeView() {
  const { profile, user } = useStore();
  const [step, setStep] = useState(profile?.location ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const picked = Object.values(profile?.style?.archetypes || {}).filter((w) => w >= 0.8).length;

  const pickLocation = async (location) => {
    await updateProfile({ location }, { immediate: true, quiet: true }).catch(() => {});
    setStep(1);
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

  return html`<main class="welcome">
    <div class="spread"><span class="brand"><${Logo} size=${26} />ModaWard</span><button class="btn btn-ghost btn-s" onClick=${() => navigate('/', { replace: true })}>Skip for now</button></div>
    <div class="steps" aria-hidden="true">${[0, 1, 2].map((i) => html`<i key=${i} class=${i <= step ? 'on' : ''}></i>`)}</div>

    ${step === 0
      ? html`<section class="stack-l enter" key="s0">
          <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">Step 1 of 3</span><h1 class="display h-xl">Welcome${user?.name ? `, ${user.name.split(' ')[0]}` : ''}.<br /><span class="italic">Where are you?</span></h1><p class="muted">We read the forecast hour by hour for your city, so every outfit suits the day you’ll actually have.</p></div>
          <${LocationPicker} onPick=${pickLocation} />
        </section>`
      : null}

    ${step === 1
      ? html`<section class="stack-l enter" key="s1">
          <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">Step 2 of 3</span><h1 class="display h-xl">What’s <span class="italic">your</span> style?</h1><p class="muted">Tell us who you shop for, then vote on a few looks. It takes under a minute, and you can change it any time.</p></div>
          <div class="field"><span class="label">I shop for</span><div class="row-wrap">${[['women', 'Womenswear'], ['men', 'Menswear'], ['unisex', 'Both']].map(([id, t]) => html`<button key=${id} class="chip" aria-pressed=${profile.department === id ? 'true' : 'false'} onClick=${() => updateProfile({ department: id }, { quiet: true })}>${t}</button>`)}</div></div>
          <${ArchetypeGrid} value=${profile.style.archetypes} onChange=${(archetypes) => updateProfile({ style: { archetypes, quizDone: true } }, { quiet: true })} />
          <div class="row"><button class="btn btn-primary btn-l grow" onClick=${() => setStep(2)} disabled=${!picked}>Continue</button></div>
          <p class="footnote center">${picked ? `${picked} style${picked > 1 ? 's' : ''} loved.` : 'Love at least one style to continue.'}</p>
        </section>`
      : null}

    ${step === 2
      ? html`<section class="stack-l enter" key="s2">
          <div class="stack" style=${{ gap: '10px' }}><span class="eyebrow">Step 3 of 3</span><h1 class="display h-xl">Now, <span class="italic">your closet.</span></h1><p class="muted">Start with a ready-made wardrobe to see outfits in seconds, then swap in your own pieces. Or add your own right away.</p></div>
          <div class="card card-pad stack" style=${{ gap: '18px' }}>
            <div class="row" style=${{ gap: '4px', justifyContent: 'center' }}>${[['tee', '#f7f6f2'], ['jeans', '#2b3a55'], ['sweater', '#1f2f54'], ['trench', '#cdb89a'], ['sneakers', '#f7f6f2']].map(([t, c]) => html`<div key=${t} style=${{ width: '64px', height: '64px' }}><${GarmentArt} type=${t} color=${c} /></div>`)}</div>
            <button class="btn btn-primary btn-l btn-block" onClick=${() => finish(true)} disabled=${busy}>${busy ? html`<${Spinner} />` : null}Start with a starter wardrobe</button>
            <button class="btn btn-outline btn-block" onClick=${() => finish(false)} disabled=${busy}><${Icon} name="camera" />I’ll add my own pieces</button>
          </div>
        </section>`
      : null}
  </main>`;
}
