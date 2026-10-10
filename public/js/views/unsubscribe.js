import { html, useState, useEffect } from '/js/ui.js';
import { t } from '/js/i18n.js';
import { api } from '/js/api.js';
import { Link } from '/js/router.js';
import { Spinner } from '/js/components/common.js';

/** The page behind the "turn off emails" link in a reminder email. Needs no sign-in. */
export function UnsubscribeView() {
  const [state, setState] = useState('working'); // working | done | bad
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    api.post('/reminders/unsubscribe', { u: q.get('u') || '', t: q.get('t') || '' })
      .then(() => setState('done'))
      .catch(() => setState('bad'));
  }, []);
  return html`<div class="stack-l center" style=${{ maxWidth: '520px', margin: '60px auto', padding: '0 16px' }}>
    ${state === 'working' ? html`<${Spinner} />` : null}
    ${state === 'done' ? html`<h1 class="display h-l">${t('You are unsubscribed')}</h1><p class="muted">${t('We will not email you reminders any more. You can turn them back on any time in your profile.')}</p>` : null}
    ${state === 'bad' ? html`<h1 class="display h-l">${t('That link is not valid')}</h1><p class="muted">${t('It may have been used already. You can change email reminders in your profile.')}</p>` : null}
    ${state !== 'working' ? html`<div><${Link} href="/style?section=reminders" class="btn btn-primary">${t('Open ModaWard')}</${Link}></div>` : null}
  </div>`;
}
