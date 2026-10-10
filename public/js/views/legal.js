import { html } from '/js/ui.js';
import { Link } from '/js/router.js';

const UPDATED = 'October 2026';

export function PrivacyView() {
  return html`<article class="legal">
    <h1 class="display h-xl">Privacy Policy</h1>
    <p class="faint small">Last updated ${UPDATED}</p>
    <p>ModaWard helps you decide what to wear. To do that we store only what the service needs, and you can export or delete all of it at any time from your profile.</p>
    <h2>What we collect</h2>
    <ul>
      <li><b>Account:</b> your email, name and a password stored only as a salted hash.</li>
      <li><b>Closet:</b> the garments you add, their attributes, and any photos you upload. Photos are private to your account.</li>
      <li><b>Profile:</b> style preferences, sizes, budget, and the city you choose for weather. If you use “current location”, we use your coordinates once to fetch the forecast and store a rounded location.</li>
      <li><b>Activity:</b> outfits you wear, love or skip, and looks you save. This trains your personal taste profile.</li>
      <li><b>Clicks:</b> when you open a shopping link we record the retailer and time, so we can understand which suggestions are useful and be paid commission.</li>
    </ul>
    <h2>Who we share it with</h2>
    <ul>
      <li><b>Weather provider:</b> your rounded coordinates, to fetch a forecast.</li>
      <li><b>Retailers:</b> when you follow a link, the retailer sees that you arrived from ModaWard. We never send them your closet or profile.</li>
      <li><b>AI services:</b> if the AI stylist is on, the garments and style preferences needed for that request are sent to Anthropic to generate a recommendation. Photos you ask us to analyse are sent for that request only. Anthropic does not use API inputs to train its models by default.</li>
      <li><b>Payments:</b> Stripe handles card details. We never see or store them.</li>
    </ul>
    <p>We do not sell your personal data.</p>
    <h2>Your choices</h2>
    <p>Download everything we hold, or delete your account and every photo and record, from <b>Profile → Account & plan</b>. Deleting is immediate and permanent.</p>
    <h2>Security</h2>
    <p>When the app itself hits an error in your browser, it sends us a short technical report (what failed, which page, which version and browser type) so we can fix it. Reports contain no photos or closet contents and are deleted after 30 days.</p>
    <p>Connections use HTTPS, passwords are hashed with scrypt, sessions use secure HttpOnly cookies, and uploaded photos are only served to their owner.</p>
    <h2>Contact</h2>
    <p>Questions about privacy? Contact the site operator using the details on the site where ModaWard is hosted.</p>
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
    <p>Keep your password safe and use accurate information. You are responsible for activity on your account. You must be at least 16 years old.</p>
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
