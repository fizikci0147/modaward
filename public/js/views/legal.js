import { html } from '/js/ui.js';
import { Link } from '/js/router.js';
import { state } from '/js/store.js';

const UPDATED = 'October 2026';

export function PrivacyView() {
  const op = state.capabilities?.operator || {};
  return html`<article class="legal">
    <h1 class="display h-xl">Privacy Policy</h1>
    <p class="faint small">Last updated ${UPDATED}</p>
    <p>ModaWard helps you decide what to wear. We keep what the service needs to do that, and you can download or delete all of it from your profile at any time.</p>

    <h2>Who is responsible</h2>
    <p>${op.name ? html`<b>${op.name}</b> runs this ModaWard site and decides how your data is used.` : 'The operator of this site decides how your data is used.'} ${op.email ? html`Questions, requests and complaints: <a href=${`mailto:${op.email}`}>${op.email}</a>.` : 'Contact details are provided by the operator on the site where ModaWard is hosted.'}</p>

    <h2>What we collect, and why</h2>
    <ul>
      <li><b>Account</b> (to run your account, a contract with you): your email, name, and a password stored only as a salted hash. We also keep when you last used the app, and a record of which hours of which days you were active, for up to 400 days, to keep the service working and to understand overall usage.</li>
      <li><b>Closet</b> (to give you outfits): the garments you add, their details (including a price if you enter one) and any photos you upload. Photos are private to your account.</li>
      <li><b>Profile</b> (to personalise): style preferences, sizes, budget, age range and department if you choose to give them, and the place you pick for the weather. If you use “current location” we store the coordinates your device gives us, to about 11 metres, in your profile, and send them to the weather provider each time we fetch your forecast, including when we prepare a reminder. You can replace the location with a city at any time.</li>
      <li><b>Activity</b> (to personalise): outfits you wear, love or skip, looks you save, and your reminder settings. Wear history is kept until you delete it or your account. It feeds your personal taste profile. We also use profile details such as city, age range and department in combined, anonymous-style business statistics about the audience.</li>
      <li><b>Shopping clicks</b> (our legitimate interest in understanding which suggestions are useful, and in earning commission): when you open a shopping link we record the retailer, the kind of link and the time for up to 400 days.</li>
      <li><b>Technical reports</b> (our legitimate interest in fixing faults): if the app hits an error in your browser it sends what failed, the page, the version and your browser type, linked to your account, and we delete it after 30 days. Our server logs record requests and your account identifier, not your address or the content of your closet.</li>
      <li><b>Notifications</b>: if you turn them on we store the address your browser’s push service gives us for this device, and send reminders through that service.</li>
    </ul>

    <h2>Who receives it</h2>
    <ul>
      <li><b>Weather provider (Open-Meteo):</b> your coordinates, to fetch a forecast.</li>
      <li><b>Retailers:</b> when you follow a link, the retailer sees that you came from ModaWard. We never send them your closet or profile. Product pictures in the Shop come straight from retailers’ image servers, so those servers can see your IP address when a picture loads.</li>
      <li><b>AI service (Anthropic):</b> if the AI stylist is on, the garments and preferences needed for that request go to Anthropic, which processes them in the United States. Photos you ask us to analyse are sent for that request only. Anthropic does not train its models on API inputs by default.</li>
      <li><b>Background removal (remove.bg), only if you use the high-accuracy option:</b> the photo you choose is sent to them to cut out the garment.</li>
      <li><b>Payments (Stripe):</b> Stripe handles card details; we never see or store them. Stripe keeps its own records of your payments.</li>
      <li><b>Email and notification services:</b> emails go through the operator’s mail provider. Push notifications travel through Google, Apple or Mozilla, depending on your browser, and contain the reminder text.</li>
      <li><b>Hosting:</b> the site is hosted by the operator’s hosting company, which stores the data and backups.</li>
    </ul>
    <p>We do not sell your personal data and we do not share it for advertising. Some of the services above are outside your country (including the United States); where that applies they provide their own transfer safeguards.</p>

    <h2>How long we keep it</h2>
    <ul>
      <li>Your account, closet, photos, profile and history: until you delete your account.</li>
      <li>Shopping clicks and activity hours: up to 400 days. Technical reports: 30 days. Reset links: until they expire. Previous suggestions shown in the Shop: about two weeks.</li>
      <li>After you delete your account, the data is removed from the live system straight away. Backups made before that moment keep a copy for up to 14 days, and the hosting company’s own backups may keep one a little longer, until they rotate out. Stripe may keep payment records as the law requires.</li>
    </ul>

    <h2>Your rights</h2>
    <p>You can see and download your data (<b>Profile → Account &amp; plan → Download my data</b>), correct it in the app, and delete your account and everything linked to it in the same place. Depending on where you live you may also have the right to object to or restrict some uses, to have data moved to another service, to withdraw consent you gave, and to complain to your data-protection authority. Write to the contact above and we will answer within a month. If you live in California: we do not sell or share your personal information as those terms are defined.</p>

    <h2>Cookies and device storage</h2>
    <p>We use one secure cookie to keep you signed in, and your browser’s storage for your language, theme and a few settings that make the app work. These are strictly necessary, so there is no cookie banner. We do not use advertising or tracking cookies.</p>

    <h2>Security</h2>
    <p>Connections use HTTPS, passwords are hashed with scrypt, sessions use secure HttpOnly cookies, and uploaded photos are only served to their owner. No system is perfectly secure; if something affecting you goes wrong we will tell you.</p>

    <h2>Children</h2>
    <p>ModaWard is for people aged 16 and over. If you believe a younger person has an account, contact us and we will remove it.</p>

    <h2>Changes</h2>
    <p>If we change this policy in a way that matters we will say so in the app. The date above shows the latest version.</p>
    <p class="footnote"><${Link} href="/">Back to ModaWard</${Link}></p>
  </article>`;
}

export function TermsView() {
  return html`<article class="legal">
    <h1 class="display h-xl">Terms of Service</h1>
    <p class="faint small">Last updated ${UPDATED}</p>
    <p>By using ModaWard you agree to these terms.</p>
    <h2>The service</h2>
    <p>ModaWard suggests outfits and shopping ideas. Suggestions are guidance, not guarantees: forecasts can be wrong, products change, and fit and fabric are your call.</p>
    <h2>Your account</h2>
    <p>Keep your password safe and use accurate information. You are responsible for activity on your account. By creating an account you confirm you are at least 16 years old.</p>
    <h2>Your content</h2>
    <p>You own the photos and details you add. You give us permission to store and process them to provide the service. Only upload photos you have the right to use.</p>
    <h2>Shopping links and affiliate disclosure</h2>
    <p>Some links to retailers are affiliate links: we may earn a commission if you buy, at no extra cost to you. This never changes what we recommend. Prices, stock and delivery are the retailer’s responsibility, and any purchase is a contract between you and the retailer.</p>
    <h2>Pro subscriptions</h2>
    <p>Pro renews automatically at the period you choose until you cancel from your profile. Cancelling stops the next renewal; you keep Pro until the paid period ends. Taxes may apply.</p>
    <h2>Acceptable use</h2>
    <p>Do not misuse the service, attempt to access other people’s data, upload unlawful content, or overload our systems.</p>
    <h2>Liability</h2>
    <p>The service is provided “as is”. To the extent the law allows, we are not liable for indirect or consequential loss arising from your use of ModaWard.</p>
    <p class="footnote"><${Link} href="/">Back to ModaWard</${Link}></p>
  </article>`;
}
