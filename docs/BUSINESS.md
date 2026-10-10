# Making money with ModaWard

ModaWard has two revenue engines that reinforce each other: **Pro subscriptions** and **affiliate commissions** on the clothes it recommends. This page is the practical playbook: what to switch on, in what order, what it costs, and what to watch. Nothing here is a revenue forecast; the numbers are formulas you can fill in with your own data.

## 1. The product loop

1. A person adds their closet (fast, with the starter wardrobe or photos with automatic background removal).
2. Every morning the app tells them what to wear for the actual weather. That is the **habit**.
3. Their reactions (love, skip, "I'm wearing this") train a taste model. That is the **moat**: the longer someone uses it, the better it knows them and the harder it is to leave.
4. The Shop tab turns that knowledge into complete looks, built around what they own, from stores they like. That is the **commerce**.
5. Pro removes the limits and adds the AI stylist and the full shopping feed. That is the **subscription**.

## 2. Free vs Pro (enforced on the server)

| | Free | Pro |
|---|---|---|
| Closet | 30 pieces | Unlimited |
| Planning | Today + 2 days | Full week |
| Shop looks | 6 at a time | Up to 36, mixed across brands |
| Saved looks | 10 | Unlimited |
| AI stylist notes, photo auto-fill, high-accuracy background removal | – | ✔ |

Limits live in `src/services/plans.js` and the `FREE_*` environment variables. Suggested pricing: **$7.99/month or $59/year**. Make the yearly option the default (the UI does) and expect the majority of revenue from it.

Set up in Stripe: one product, two recurring prices, the webhook and the Customer Portal (steps in [DEPLOY-HOSTINGER.md](DEPLOY-HOSTINGER.md)). Decide whether to charge sales tax (Stripe Tax) before launch.

## 3. Affiliate revenue

### What the app does today

Every "Shop" button points at `/go?...` on your own domain. The server verifies a signature, **records the click** (retailer, kind, time) and redirects, applying your affiliate link template. You can see clicks per retailer in `/admin`.

### What you must do (the app cannot do this for you)

1. **Join affiliate networks** and apply to the retailers' programs. Most large fashion brands run through **Rakuten Advertising, Impact, CJ Affiliate, AWIN or ShareASale**. Approval is per retailer and per site; a live, finished site (this one) helps. Commission rates vary widely by retailer and category.
2. **Add your tracking templates.** Create a JSON file and point `AFFILIATE_CONFIG` at it. Each value is the network's deep-link pattern with `{url}` where the destination goes (and optionally `{subid}`, which receives the link kind):

   ```json
   {
     "hm": "https://example.sjv.io/c/1234567/89012/3456?u={url}&subId1={subid}",
     "zara": "https://click.linksynergy.com/deeplink?id=YOURID&mid=12345&murl={url}"
   }
   ```
   Retailer ids are in `src/shop/retailers.js`. Retailers without a template still work; they just earn nothing.
3. **Load product feeds** so cards show real photos and prices (below). Without a feed, cards are illustrated and link to the retailer's search page.

### Product feeds (real photos, real prices)

Networks give approved publishers a downloadable product feed (CSV, TSV or JSON) with title, price, image and a tracking link per product.

```bash
# dry run: shows what would be imported and why rows were skipped
node scripts/import-feed.mjs --retailer hm --file hm-feed.csv --dry-run
# import; --full-sync marks products missing from this feed as out of stock
node scripts/import-feed.mjs --retailer hm --file hm-feed.csv --full-sync
# unusual column names
node scripts/import-feed.mjs --retailer zara --file zara.csv --map title=product_name,url=deeplink
```

**No command line? Use the browser.** *Business → Products* does the same job: choose the store, pick the feed file (up to 10 MB), look at the preview (what will be imported, what is skipped and why, a few sample photos), then import. You can also add a single hand-picked product there: paste the product page address (your affiliate link works) and the photo address the network gives you. Feeds bigger than 10 MB, and nightly refreshes, still use the command line.

The importer infers garment type, colour, gender and pattern from the text, **skips what it cannot place** (and says why) rather than guessing, and only accepts `https` links and images. Run it nightly from a cron job per retailer. Product images are loaded from the retailer's servers; use them only as your network's terms allow.

### Disclosure (required)

The Shop tab, Terms and Privacy pages already disclose affiliate links in plain language, as US FTC guidance expects. Keep the disclosure near the links if you change the layout.

## 4. Costs to plan for

| Item | Cost | Notes |
|---|---|---|
| Hosting | your Hostinger plan | Single Node process; SQLite on local disk. |
| Open-Meteo commercial | see their pricing | Required for a paid product. |
| Stripe | ~2.9% + 30¢ per charge (US, standard) | Check your region. |
| **AI stylist** | **per call, see below** | Pro only, capped per user per day. |
| remove.bg (optional) | per image | Pro only, capped per user per day. |
| Email | free with a Hostinger mailbox | Password resets only. |

### AI cost, honestly

The default model is `claude-opus-5-5` at about **$4 per million input tokens and $20 per million output tokens**. A day-outfit curation call is roughly 2–3k input tokens and a few hundred to ~1k output tokens, so **a few cents per call**. Results are cached (6 h for outfits, 12 h for looks) so reloading is free, and `AI_DAILY_LIMIT` (default 12) caps what one person can spend.

Run the numbers on your own plan: *(average paid AI calls per Pro user per month × cost per call)* must sit comfortably under *(subscription price − Stripe fees)*. If it does not:

1. Switch to a cheaper model with one setting: `AI_MODEL=claude-sonnet-5-5` (about half the price) or `claude-haiku-4-5` (cheaper still). Curation is a simple ranking-plus-copy task, so a smaller model is usually enough: compare a week of notes yourself.
2. Lower `AI_DAILY_LIMIT`.
3. Watch real usage in `/admin` (AI calls today) and the `ai_usage` table (calls and tokens per user per day).

### Photo recognition when people add many pieces at once

*Add several pieces* sends small thumbnails, six per model call, so recognising a 36-piece closet is six calls (one call counts once against `AI_DAILY_LIMIT`, default 12 per person per day, so up to 72 photos a day). It is a Pro feature; without it people choose each piece's type and still add them in one go.

## 5. Numbers to watch

| Metric | Why | Where |
|---|---|---|
| Activation: new users who add ≥ 5 items or use the starter wardrobe | The app is useless with an empty closet | `/admin` closet stats |
| Quiz completion | Better quiz = better looks | `/admin` engagement |
| Day-7 and day-30 retention (WAU/MAU) | The daily habit is the business | `/admin` users |
| "I'm wearing this" per active user | Proves the recommendations are useful | `/admin` wear logs |
| Love-to-skip ratio on looks | Shop relevance | `feedback` table |
| Clicks per look and per retailer | Affiliate yield; negotiate and prune with it | `/admin` clicks |
| Free→Pro conversion, monthly churn | Subscription health | `/admin` conversion; Stripe |
| Revenue per click (from your network dashboards) | Which retailers to favour | networks |

## 6. Legal checklist (not legal advice)

- Have a lawyer review the **Privacy Policy and Terms** in `public/js/views/legal.js` for your jurisdiction and add your company name and contact details.
- **Affiliate disclosure** is built in; keep it.
- **Privacy rights:** export and delete are built in (Profile → Account & plan). Mention a contact for requests.
- **Data processors** to list in your policy: your host, Open-Meteo, Stripe, Anthropic (if AI is on), remove.bg (if on), your email provider.
- **Open-Meteo licence:** commercial plan for a paid product.
- **Retailer imagery:** follow each network/retailer's terms for displaying product photos.
- Age gate: Terms say 16+; confirm it fits your markets.

## 7. Growth levers already in the product

- **Shareable looks** are a natural next feature (the data model has `saved_looks`).
- **Referral credit** is not built; add after you have retention data.
- The PWA is installable to the home screen (the daily-use surface). Prompt installs after a person's third visit.
- Email digests ("what to wear this week") are a retention lever: the engine already produces the week plan.

## Admin access and giving away Pro

- **Admin:** set `ADMIN_EMAILS=you@example.com` (comma-separated for several people). Register or sign in with that email, then open `/admin`. There is no separate admin password: the account is an ordinary one that the server recognises by its email. **Register that account first, before anyone else can**: accounts are not email-verified yet, so a stranger who signed up with your admin address before you would become an admin. The server logs a warning at startup while an admin address has no account. Do not delete your admin account.
- **Give Pro to an existing user:** `/admin` → *Pro access* → enter their email and a number of days. Pro ends automatically; a paying Stripe subscriber is never overridden.
- **Pro codes:** `/admin` → *Pro access* → *Create code* (leave the code blank for a random one such as `K7QM-2XPD-9TRB`). Choose the days of Pro and how many people can use it. Users enter it on the Pro page ("Have a Pro code?"). Every code is one use per person.
- **Stripe discounts:** the checkout page already accepts Stripe promotion codes. Create a coupon and promotion code in the Stripe dashboard (Product catalogue → Coupons) for discounts on paid subscriptions.
