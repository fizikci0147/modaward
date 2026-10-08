import { html, useState, useEffect } from '/js/ui.js';
import { t, tx } from '/js/i18n.js';
import { L } from '/shared/i18n.js';
import { api } from '/js/api.js';
import { authenticate, fail, toast } from '/js/store.js';
import { Icon, Logo } from '/js/icons.js';
import { OutfitArt } from '/js/components/art.js';
import { Spinner, LanguagePicker } from '/js/components/common.js';
import { Link, navigate, useQuery } from '/js/router.js';

const BOARD_A = [
  { type: 'shirt', color: '#8fa9c8', category: 'top' }, { type: 'chinos', color: '#a39a6a', category: 'bottom' },
  { type: 'trench', color: '#cdb89a', category: 'outerwear' }, { type: 'loafers', color: '#6b4a32', category: 'shoes' }, { type: 'watch', color: '#1c1c1e', category: 'accessory' }
];
const BOARD_B = [
  { type: 'dress', color: '#6d1f35', category: 'dress' }, { type: 'wool-coat', color: '#b58750', category: 'outerwear' },
  { type: 'boots', color: '#1c1c1e', category: 'shoes' }, { type: 'scarf', color: '#8e9096', category: 'accessory' }
];

function Side() {
  return html`<aside class="auth-side">
    <div class="brand" style=${{ color: 'inherit' }}><${Logo} size=${28} />ModaWard</div>
    <div class="boards" aria-hidden="true">
      <div><${OutfitArt} items=${BOARD_A} /></div>
      <div><${OutfitArt} items=${BOARD_B} /></div>
    </div>
    <div class="stack" style=${{ gap: '14px' }}>
      <h1 class="display h-xl">${t('Dress for the day')} <span class="italic">${t('ahead.')}</span></h1>
      <p>${t('Your closet, the hour-by-hour forecast and a stylist’s eye, in one calm place.')}</p>
    </div>
  </aside>`;
}

function Field({ id, label, type = 'text', value, onInput, autocomplete, hint, error, ...rest }) {
  return html`<div class="field">
    <label for=${id}>${label}</label>
    <input id=${id} class="input" type=${type} value=${value} onInput=${onInput} autocomplete=${autocomplete} aria-invalid=${error ? 'true' : undefined} aria-describedby=${error ? `${id}-e` : hint ? `${id}-h` : undefined} ...${rest} />
    ${error ? html`<span id=${`${id}-e`} class="error-text" role="alert">${error}</span>` : hint ? html`<span id=${`${id}-h`} class="hint">${hint}</span>` : null}
  </div>`;
}

export function AuthView({ mode }) {
  const q = useQuery();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  useEffect(() => { setError(''); setSent(false); }, [mode]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'login') {
        await authenticate('login', { email: form.email, password: form.password });
        navigate('/', { replace: true });
      } else if (mode === 'register') {
        await authenticate('register', { email: form.email, password: form.password, name: form.name });
        navigate('/welcome', { replace: true });
      } else if (mode === 'forgot') {
        await api.post('/auth/forgot', { email: form.email });
        setSent(true);
      } else if (mode === 'reset') {
        await api.post('/auth/reset', { token: q.get('token') || '', password: form.password });
        toast(t('Password updated. Sign in with your new password.'));
        navigate('/login', { replace: true });
      }
    } catch (err) {
      setError(err.message);
      if (err.code !== 'unauthorized' && err.status >= 500) fail(err);
    } finally {
      setBusy(false);
    }
  };

  const titles = { login: [L('Welcome back'), L('Sign in to see what to wear today.')], register: [L('Create your account'), L('Free to start. No card needed.')], forgot: [L('Reset your password'), L('We’ll email you a link to choose a new one.')], reset: [L('Choose a new password'), L('Use at least 10 characters.')] };
  const [title, sub] = titles[mode].map((x) => t(x));

  return html`<div class="auth">
    <${Side} />
    <main class="auth-form">
      <div class="auth-card enter">
        <div class="brand" style=${{ fontSize: '26px' }}><${Logo} size=${26} />ModaWard</div>
        <div class="stack" style=${{ gap: '8px' }}><h1 class="display h-l">${title}</h1><p class="muted">${sub}</p></div>
        <${LanguagePicker} />
        ${sent
          ? html`<div class="banner" role="status"><${Icon} name="mail" />${t('If that email has an account, a reset link is on its way. It works for one hour.')}</div>`
          : html`<form class="stack" onSubmit=${submit} noValidate>
              ${mode === 'register' ? html`<${Field} id="name" label=${t('Your name')} value=${form.name} onInput=${set('name')} autocomplete="name" maxlength="60" />` : null}
              ${mode !== 'reset' ? html`<${Field} id="email" label=${t('Email')} type="email" value=${form.email} onInput=${set('email')} autocomplete="email" required autofocus />` : null}
              ${mode !== 'forgot' ? html`<${Field} id="password" label=${mode === 'reset' ? t('New password') : t('Password')} type="password" value=${form.password} onInput=${set('password')} autocomplete=${mode === 'login' ? 'current-password' : 'new-password'} required hint=${mode === 'login' ? undefined : t('At least 10 characters. A short phrase works well.')} />` : null}
              ${error ? html`<div class="banner" role="alert"><${Icon} name="info" />${error}</div>` : null}
              <button class="btn btn-primary btn-l btn-block" disabled=${busy}>${busy ? html`<${Spinner} />` : null}${{ login: t('Sign in'), register: t('Create account'), forgot: t('Send reset link'), reset: t('Save new password') }[mode]}</button>
              ${mode === 'login' ? html`<div class="spread small"><${Link} href="/forgot" class="muted">${t('Forgot password?')}</${Link}><${Link} href="/register" style=${{ fontWeight: 600 }}>${t('Create an account')}</${Link}></div>` : null}
              ${mode === 'register' ? html`<p class="footnote">${tx(t('By creating an account you agree to our {terms} and {privacy}.'), { terms: html`<${Link} href="/terms">${t('Terms')}</${Link}>`, privacy: html`<${Link} href="/privacy">${t('Privacy Policy')}</${Link}>` })}</p><div class="small center">${t('Already have an account?')} <${Link} href="/login" style=${{ fontWeight: 600 }}>${t('Sign in')}</${Link}></div>` : null}
              ${mode === 'forgot' || mode === 'reset' ? html`<div class="small center"><${Link} href="/login" style=${{ fontWeight: 600 }}>${t('Back to sign in')}</${Link}></div>` : null}
            </form>`}
      </div>
    </main>
  </div>`;
}
