import { html, useState } from '/js/ui.js';
import { DEFAULT_PROFILE, today } from '/shared/nutrition.js';
import { getSetting, setSetting, useQuery } from '/js/trackweight/db.js';
import { Logo } from '/js/icons.js';
import { Icon, Spinner } from '/js/trackweight/ui.js';
import { Diary } from '/js/trackweight/views/diary.js';
import { Exercise } from '/js/trackweight/views/exercise.js';
import { Progress } from '/js/trackweight/views/progress.js';
import { ProfileView } from '/js/trackweight/views/profile.js';

const TABS = [
  ['diary', 'Diary', 'diary'],
  ['exercise', 'Exercise', 'run'],
  ['progress', 'Progress', 'chart'],
  ['profile', 'Profile', 'user']
];

async function saveProfile(p) {
  await setSetting('profile', p);
  // ask the browser not to evict the diary when the device is short of space
  navigator.storage?.persist?.().catch(() => {});
}

function Header() {
  return html`<header class="topbar tw-top">
    <a class="brand" href="/" aria-label="ModaWard home"><${Logo} /><span>ModaWard</span></a>
    <span class="eyebrow">Track Weight</span>
  </header>`;
}

export function App() {
  const [tab, setTab] = useState('diary');
  const [date, setDate] = useState(today());
  // undefined while reading, null when this is the first visit
  const profile = useQuery(() => getSetting('profile', null), [], undefined);

  if (profile === undefined) return html`<div class="tw-center"><${Spinner} /></div>`;
  if (profile === null) {
    return html`<${Header} /><main class="main narrow tw-main"><${ProfileView} initial=${DEFAULT_PROFILE} onSave=${saveProfile} firstRun /></main>`;
  }
  return html`
    <${Header} />
    <main class="main narrow tw-main">
      ${tab === 'diary' ? html`<${Diary} profile=${profile} date=${date} setDate=${setDate} />` : null}
      ${tab === 'exercise' ? html`<${Exercise} profile=${profile} date=${date} setDate=${setDate} />` : null}
      ${tab === 'progress' ? html`<${Progress} profile=${profile} saveProfile=${saveProfile} />` : null}
      ${tab === 'profile' ? html`<${ProfileView} initial=${profile} onSave=${saveProfile} />` : null}
    </main>
    <nav class="tabbar tw-tabbar" aria-label="Track Weight">
      ${TABS.map(([id, label, icon]) => html`<button class="tab" key=${id} aria-current=${tab === id ? 'page' : undefined} onClick=${() => (setTab(id), scrollTo(0, 0))}><${Icon} name=${icon} />${label}</button>`)}
    </nav>`;
}

