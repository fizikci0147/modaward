import { html } from '/js/ui.js';

/** Hand-drawn 24px stroke icons. One consistent weight, round caps. */
const P = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  'sun-cloud': '<circle cx="9" cy="8.5" r="3"/><path d="M9 2.5v1.2M3 8.5h1.2M4.8 4.3l.9.9M13.2 4.3l-.9.9"/><path d="M8 19h9.5a3.5 3.5 0 0 0 .4-6.97A5 5 0 0 0 8.3 13 3 3 0 0 0 8 19Z"/>',
  cloud: '<path d="M7 19h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.5 12.4 3.3 3.3 0 0 0 7 19Z"/>',
  rain: '<path d="M7 15h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.5 8.4 3.3 3.3 0 0 0 7 15Z"/><path d="M8 18.5l-1 2M12 18.5l-1 2M16 18.5l-1 2"/>',
  snow: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/><path d="M9.5 4.5 12 6.5l2.5-2M9.5 19.5 12 17.5l2.5 2"/>',
  storm: '<path d="M7 14h10.5a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.5 7.4 3.3 3.3 0 0 0 7 14Z"/><path d="m12.5 14-2.5 4h3l-1.5 3.5"/>',
  fog: '<path d="M5 9h14M3 13h18M6 17h12"/>',
  wind: '<path d="M3 9h10a3 3 0 1 0-3-3M3 15h14a3 3 0 1 1-3 3M3 12h6"/>',
  umbrella: '<path d="M3 12a9 9 0 0 1 18 0Z"/><path d="M12 3v1M12 12v6.2a2.3 2.3 0 0 0 4.6 0"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  thermo: '<path d="M10 14.8V5a2 2 0 1 1 4 0v9.8a4 4 0 1 1-4 0Z"/>',
  drop: '<path d="M12 3s6.5 6.8 6.5 11.5a6.5 6.5 0 0 1-13 0C5.5 9.8 12 3 12 3Z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 1.5h-15L6 16.5Z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/>',
  hanger: '<path d="M12 7.5V6.2a2.2 2.2 0 1 0-2.2-2.2"/><path d="M12 7.5 3.4 14.2a1.6 1.6 0 0 0 1 2.8h15.2a1.6 1.6 0 0 0 1-2.8L12 7.5Z"/>',
  home: '<path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-5.5H9V20H4.5a.5.5 0 0 1-.5-.5V11Z"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bag: '<path d="M5 8h14l-1 12.2a.8.8 0 0 1-.8.8H6.8a.8.8 0 0 1-.8-.8L5 8Z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  user: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20.5c.8-4 3.6-6 7.5-6s6.7 2 7.5 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  heart: '<path d="M12 20.3S3.5 15 3.5 9.2A4.7 4.7 0 0 1 12 6.6a4.7 4.7 0 0 1 8.5 2.6c0 5.8-8.5 11.1-8.5 11.1Z"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.5-3.8L4 9M4 4v5h5M4 13a8 8 0 0 0 14.5 3.8L20 15M20 20v-5h-5"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.3-2h6.4l1.3 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-9Z"/><circle cx="12" cy="13" r="3.6"/>',
  upload: '<path d="M12 16V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  left: '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  right: '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  down: '<path d="m5.5 9.5 6.5 6.5 6.5-6.5"/>',
  up: '<path d="m5.5 14.5 6.5-6.5 6.5 6.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  thumbdown: '<path d="M17 14V4M17 14l-2.2 5.2a1.6 1.6 0 0 1-1.5 1c-1 0-1.8-.8-1.8-1.8V15H6.6a2 2 0 0 1-2-2.3l1-6.4A2 2 0 0 1 7.6 4.5H17M17 4h2.5A1.5 1.5 0 0 1 21 5.5v7a1.5 1.5 0 0 1-1.5 1.5H17"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3.5 12h17M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.8c0-.4.3-.8.8-.8h3.4c.5 0 .8.4.8.8V7M6.5 7l.8 12.2c0 .5.4.8.9.8h7.6c.5 0 .9-.3.9-.8L17.5 7"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14.5 7.5 3 3"/>',
  pin: '<path d="M12 21s6.5-5.7 6.5-11A6.5 6.5 0 0 0 5.5 10c0 5.3 6.5 11 6.5 11Z"/><circle cx="12" cy="10" r="2.3"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8L12 3.5Z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.2"/>',
  bookmark: '<path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4.2L5.5 20V5a1 1 0 0 1 1-1Z"/>',
  logout: '<path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10M15 8l4 4-4 4M19 12H9.5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/>',
  crown: '<path d="m4 8 4.5 4L12 5l3.5 7L20 8l-1.5 10h-13L4 8Z"/>',
  shield: '<path d="M12 3.5 5 6v5.5c0 4.2 2.8 7.5 7 9 4.2-1.5 7-4.8 7-9V6l-7-2.5Z"/><path d="m9 12 2.2 2.2L15.2 10"/>',
  download: '<path d="M12 4v12M7.5 11.5 12 16l4.5-4.5M5 19.5h14"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
  tag: '<path d="M3.5 12.5v-7a2 2 0 0 1 2-2h7l8 8a2 2 0 0 1 0 2.8l-6.2 6.2a2 2 0 0 1-2.8 0l-8-8Z"/><circle cx="8.5" cy="8.5" r="1.3"/>',
  sparkle: '<path d="M12 3.5 13.8 10 20.5 12l-6.7 2L12 20.5 10.2 14 3.5 12l6.7-2L12 3.5Z"/>',
  shirt: '<path d="m8.5 4-5 3 2 4 2-1V20h9V10l2 1 2-4-5-3a3.6 3.6 0 0 1-7 0Z"/>',
  box: '<path d="m3.5 7.5 8.5-4 8.5 4v9l-8.5 4-8.5-4v-9Z"/><path d="m3.5 7.5 8.5 4 8.5-4M12 11.5v9"/>',
  share: '<circle cx="6" cy="12" r="2.3"/><circle cx="17.5" cy="6" r="2.3"/><circle cx="17.5" cy="18" r="2.3"/><path d="m8 11 7.5-3.8M8 13l7.5 3.8"/>',
  mail: '<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4 7 8 6 8-6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>'
};

export function Icon({ name, size, class: cls = '', label, style }) {
  const body = P[name] || P.info;
  return html`<svg
    class=${cls}
    style=${style}
    width=${size}
    height=${size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.7"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden=${label ? undefined : 'true'}
    role=${label ? 'img' : undefined}
    aria-label=${label}
    dangerouslySetInnerHTML=${{ __html: body }}
  />`;
}

/** Weather condition (from shared/weather-codes) → icon name. */
export const weatherIcon = (condition, isDay = true) =>
  ({ clear: isDay ? 'sun' : 'sun', partly: 'sun-cloud', cloudy: 'cloud', fog: 'fog', drizzle: 'rain', rain: 'rain', snow: 'snow', storm: 'storm' })[condition] || 'cloud';

/** The ModaWard mark: a hanger whose hook forms a rain-drop. */
export function Logo({ size = 24 }) {
  return html`<svg width=${size} height=${size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
    <path d="M16 10.2V8.6a2.9 2.9 0 1 0-2.9-2.9" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
    <path d="M16 10.2 4.6 19.2a2.1 2.1 0 0 0 1.3 3.8h20.2a2.1 2.1 0 0 0 1.3-3.8L16 10.2Z" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"/>
    <path d="M16 26.3s2.4-2.5 2.4-4a2.4 2.4 0 0 0-4.8 0c0 1.5 2.4 4 2.4 4Z" fill="var(--clay)"/>
  </svg>`;
}
