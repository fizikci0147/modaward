# Changelog

Versions follow [semver](https://semver.org): **major** = a change that needs action from the owner, **minor** = new features, **patch** = fixes. Every zip is named `modaward-<version>-<commit>.zip`, `/health` reports the same `version` and `build`, and the app shows them under *You → Account*.

> Releases up to 5.2.0 were all uploaded as `modaward-5.0.0.zip`. They are numbered below after the fact so the history is readable; from 5.3.0 on, each zip carries its real version.

## [5.10.0] · 2026-10-13

### Changed
- **Removing a piece from a look now means "it doesn't go with that look", not "never use it".** The × on a piece offers *Doesn’t go with this look* (that piece and the others in the look are never put together again, in Today, Week, trips and the Shop's looks built from your closet), *Not today*, and *Never suggest this piece*. The piece stays free to be mixed with everything else unless you choose the last option. Every choice has Undo. Swapping out a piece for today no longer teaches the taste model that you dislike the piece.

### Added
- **Start over.** *You → Style → Start over* has three resets, each separate and confirmed: *Reset my style choices* (quiz answers, colours, "never" list, brands, fit and areas; the closet, sizes, budget and stores stay), *Forget what you’ve learned* (what the app learned from your likes and skips), and *Bring back removed pieces and pairings*.

## [5.9.1] · 2026-10-12

### Fixed
- **Clothes overlapping on outfit pictures (again).** In 5.9.0 a layered look drew the sweater or cardigan over the shirt, which looked like an overlap, especially next to a photo of your own piece. The two tops are now drawn side by side with clear space, and clear of the coat and shoes.

## [5.9.0] · 2026-10-12

Taste first, trends second, and a lasting way to say "not this piece".

### Added
- **"Never suggest this piece".** The × on a piece in Today now offers *Not today* (as before) or *Never suggest this piece*. The piece stays in your closet (marked "Not suggested", and switchable in its edit sheet) but is left out of Today, Week, trips and the Shop's looks built around your closet until you undo it. A toast offers Undo straight away. Asking to style that very piece still works.
- **Trends that follow your taste.** The engine knows what is current this season (autumn/winter or spring/summer for where you live), compiled in October 2026 from this season's reporting. A trend is only a tiebreak: it applies only to outfits you would already like, only if it suits one of your styles, and is capped small. **You → Style → How current should your outfits be?** sets it to Timeless, A little current, or Very current. When a trend helped, the outfit says so. **The lists keep up with the calendar**: once a month the app researches the current season with Claude's web search, checks the answer against its own vocabulary before using it, and saves the result (with sources and names in all seven languages); lists nobody refreshes fade out after six months. *Business → System check → Trend lists* shows their age and has Refresh now / Use built-in lists. You can also edit `DATA_DIR/trends.json` by hand (`docs/TRENDS.md`). Set `TRENDS_AUTO_REFRESH=0` to switch the automatic refresh off.

### Changed
- **Layered looks return, curated.** Two tops are used only as a real layered look on a cool day (a shirt under a sweater, a tee under a cardigan or hoodie, a polo under a sweater …), never a polo beside a button-up. They need contrast and at most one print, and a list of looks always keeps a single-top option. The picture now draws the layer over the base.
- **Your selections steer harder.** Colours you avoid are nearly a veto and colours you love lift an outfit; brands you love or avoid, areas you asked to cover, loud prints against a quiet style, running shoes at work, cargo or joggers outside casual days, a checked shirt with a skirt and double denim are all handled.
- Shop feed variety counts the same garments in different colours as different looks.

## [5.8.0] · 2026-10-12

A stylist pass on the recommendations: fewer mistakes, more of the person's own taste.

### Changed
- **One top per outfit.** The 5.7 layering experiment put two tops in one outfit (a blouse beside a cardigan, a polo beside a button-up). That is gone: warmth comes from the sweater, the coat and the scarf.
- **New stylist rules** that no amount of warmth or colour can outvote: sportswear and tailoring do not share an outfit (a hoodie under a blazer) unless you love streetwear; shorts stay out of cool weather, jackets and work; sundresses and open shoes wait for warm days; rain boots are for the wet; a belt is only suggested when it matches the shoes; black and brown are not mixed; denim over jeans, a silk blouse over cargo pants and a lone cardigan are marked down.
- **Your taste counts for more.** Your style quiz and learned taste now carry more weight than before, and printed pieces follow it (minimalists see fewer loud prints, boho more florals, streetwear more graphics).
- **Your profile is honoured when styling what you own.** The "never suggest" list (shorts, heels, wool, leather, …), avoided patterns and your dress code (casual, smart, business, formal) previously only shaped the Shop. They now shape Today, Week and trips too; if that would leave a whole category empty the app keeps the category rather than showing a blank screen.
- Shop feed variety now counts the same garments in different colours as different looks.

## [5.7.2] · 2026-10-12

### Fixed
- Free accounts can plan a short trip that starts later in the forecast again (5.7.0 wrongly asked them to upgrade for it); only trips longer than the free limit need Pro.
- Slow AI requests (photo analysis, the stylist) are no longer cut off after a minute, and the Shop's request limit is back to a comfortable 20 a minute so switching filters quickly never shows "browsing very fast".

## [5.7.1] · 2026-10-12

### Fixed
- **Overlapping clothes on outfit pictures.** Now that cool-weather outfits layer a base and a second layer, the picture drew the two tops on top of each other (and left a dress's cardigan out). Layered tops now sit side by side, and a dress shows its cardigan above it. This applies to the Shop, Today, the closet and the share picture.

## [5.7.0] · 2026-10-12

A second, deeper review by four independent reviewers (security, correctness, front-end, data and operations), with every confirmed finding fixed and covered by a test.

### Fixed: outfit quality
- **Layering, open shoes and accessory rules were silently switched off** because the engine never saw those facts about each garment type. Cold-weather outfits now layer a base and a mid layer, open sandals are marked down in the wet, and belts and scarves are suggested.
- A downpour without any waterproof piece can no longer score like a good outfit, and a suggestion far worse than the best one is no longer padded in to reach three.
- Packing lists keep shoes and outer layers to two each whenever the closet allows; very large closets are shortlisted so styling stays fast.

### Fixed: reminders
- A reminder that failed to send (mail server down, a crash mid-send) was lost for the day; it is now retried within the catch-up window and sent once.
- The "forgotten pieces" cadence counts only reminders that were delivered.
- Reminders follow the phone's time zone automatically, including after travel.

### Fixed: data you enter
- Logging an outfit checks the date, replaces the day's earlier outfit, teaches your taste once (not on a double tap), and "undo" no longer erases pieces you logged one by one.
- Shop feeds with prices like `29,99 EUR` are no longer read as 2,999 and stock words like "no" inside other words no longer hide in-stock products.
- An email address must name a single mailbox (no commas, quotes or brackets).

### Fixed: security and abuse limits
- Checkout is blocked for trial and past-due subscribers too; an old subscription ending cannot cancel a live one; code redemption is also limited per address.
- Rate limits count a whole IPv6 /64 as one client. The forgot-password cap now answers like a normal request, so it cannot be used to block someone else's reset or to probe addresses.
- Shop-look variations are limited to a fixed set, so a made-up value cannot force endless rebuilds; trip planning has its own tighter limit and free accounts cannot plan trips beyond their forecast days; upstream error text is no longer shown to people.
- A web address taken from the request's Host header is only trusted for localhost; `APP_URL` without `https://` is accepted and anything unusable stops start-up with a clear message.
- The payment webhook body is limited to 256 KB.

### Fixed: operations
- **Backups**: the script refuses to back up a missing or empty database (a wrong path used to produce an empty "successful" backup that could push out every good one), checks the copy, keeps the generated keys, and writes private files via a temporary name.
- **A full disk** no longer turns every signed-in request into an error, and `/ready` now fails when the database cannot be written.
- Two processes starting together no longer collide on a migration; an older database that cannot be set aside stops with a message instead of looping.
- Admin pages that scan large tables are cached for a minute, user lists page without counting everything first, and new indexes keep them fast.
- Old reset tokens, payment event ids, AI counters and shop looks are now purged, and the first clean-up runs two minutes after start-up.
- *Business → System check* now shows disk space, backup age, the payment webhook secret, the reminder scheduler and unclaimed admin addresses.

### Fixed: front-end
- The piece editor is a single column on phones; text fields no longer make iPhones zoom in.
- Stacked dialogs: Esc and Tab act on the top one only, focus starts inside and returns afterwards.
- The app tells you when the server cannot be reached instead of showing the sign-in screen, and retries when you are back online.
- Signing out or deleting an account stops notifications on that device; slow requests time out instead of hanging; a profile change made while another is saving is no longer overwritten; the You page follows `?section=` links; the export download reports failures; long names wrap; reduced-motion no longer freezes spinners; the app checks for a new version when reopened; screens start at the top for keyboard and screen-reader users; session storage being blocked no longer breaks Today.
- Old build addresses are no longer cached for a year.

### Changed
- **Privacy Policy rewritten** to match what the app actually does: who is responsible (set `OPERATOR_NAME` and `CONTACT_EMAIL`), legal bases, every recipient (including remove.bg, push services and retailer image servers), retention, backups after deletion, your rights, cookies and children. The data download now includes feedback, clicks, AI usage and redeemed codes.

### Needs your action
- Set `OPERATOR_NAME` and `CONTACT_EMAIL`. Register your own `ADMIN_EMAILS` account if you have not. Point the backup job at `DATA_DIR`, and copy the backup folder off the server (see the deploy guide).

## [5.6.0] · 2026-10-11

A quality and security pass: automated accessibility checks on every screen, an independent security review, failure testing and a load test.

### Fixed: security
- **A closet limit loophole.** Archiving pieces let a free account keep adding more. Every piece now counts toward a hard storage cap (100 free, 2,000 Pro).
- **Reset emails could carry someone else's HTML** through a person's name. Names are now escaped.
- **Reset emails** are capped to 3 an hour per address, whoever asks; "send me a test" to 5 an hour; sending a reset no longer reveals through timing whether an address has an account.
- **Sign-in, sign-up, forgot and reset each have their own attempt limit**, so people behind one network address cannot lock each other out.
- **Reset links are no longer written to the server log in production** (set `LOG_MAIL_BODIES=1` to bring that back if you have no email set up).
- **Deleting an account now stops if the subscription cannot be cancelled**, instead of deleting the account and leaving the person being charged.
- Session cookies are always `Secure` in production; a malformed cookie or file path no longer causes a server error; anonymous visitors can no longer make the server read multi-megabyte bodies; push notifications only go to Google's FCM service (not any Google host) and a person is limited to 10 devices; `/go` and city search are rate limited; old click records are purged.
- The server warns at startup if an `ADMIN_EMAILS` address has no account yet.

### Fixed: accessibility and polish
- Small grey text now meets WCAG AA contrast in light and dark mode (previously about 3.6:1).
- Skip-to-content links work on every page; heading levels no longer skip; faded temperatures on the Week days are readable.
- Small buttons (swap, favourite, remove, chips) have bigger tap areas on touch screens.
- The Welcome screens no longer sit 12px off-centre on phones; the Week row respects its padding.
- Admin sections and Reminders show an error and a retry button, instead of a loading placeholder forever, when the server cannot be reached.

### Added
- **Problems in people's browsers** (Business → System): errors in the app's own code are reported and grouped, so bugs are found before anyone writes in. A broken screen shows "Something went wrong" with a way out instead of a blank page.
- Business → System shows the visitor address as the app sees it, so you can check the proxy setting.
- Start-up files are preloaded together, and colour maths is cached.
- Data export includes planned days and reminder settings.

## [5.5.1] · 2026-10-11

### Fixed
- **A new release could look like it had not changed anything.** If a browser, the service worker or the hosting provider's cache kept old copies of the app's script files, people kept seeing the old screens even though the server was updated. Each build now serves its scripts and styles under its own address (`/v/<build>/…`), so no cache can show an old release. Because those addresses never change, they are also cached for a year, which makes repeat visits faster. The old addresses still work and now serve the current code.

## [5.5.0] · 2026-10-11

### Added
- **Closet → Insights.** How much of the closet gets worn (last 30 and 90 days), what has never been worn, the closet's value, **cost per wear** (best value, and which pieces are worth wearing more), most worn pieces, what the closet is made of, forgotten pieces with a one-tap *Style it*, and a short "What's missing" list that links to the Shop's gap finder.
- **What you paid** on every piece (optional), and a **Currency** setting in *You → About you*.
- **What's on this day?** On the Week screen, tell the app a day is for a wedding, a dinner, the office. The outfits follow, Today opens on that occasion with your note, and the morning reminder uses it too.
- **Pack for a trip** (`/trip`, linked from Week and Insights): choose a destination, start day, length and occasions. It picks the fewest pieces from your closet that suit every day's forecast at the destination (shoes and outer layers capped at two each), with a tick-off checklist, an outfit for each day, and a copy/share button. Free: up to 3 days. Pro: the whole 8-day forecast.

### Changed
- The Week header no longer runs two sentences together.
- Data export now includes planned days and reminder settings.

## [5.4.0] · 2026-10-10

### Added
- **Not worn in a while.** Every piece shows when it was last worn ("Last worn 3 weeks ago", "Not worn yet · added 2 months ago"). Pieces idle for 60+ days (or never worn 3 weeks after being added) get an *Idle* tag, a **Not worn lately** filter, a **Sort by longest unworn** option, and a "Not worn in a while" card at the top of the closet with one-tap **Style it** and **Wore it today**. A piece's own screen has a wear history with *I wore it today* and back-dating. The outfit engine now gently brings forgotten pieces back and says so ("Brings back the navy polo, which you last wore 4 months ago").
- **Style it**: outfits built around one chosen piece (from the closet).
- **Add several pieces at once**: pick up to 40 photos; backgrounds are removed in the browser, and with the AI stylist on, Claude recognises the pieces (six photos per call, so a 36-photo closet is six calls). Everything lands on one review screen where you fix types or colours and add them all together. Without AI you choose the type for each piece and still add them in one go.
- **Reminders**: a morning outfit at a time you choose, a Sunday-evening look at the week ahead, and a Saturday nudge about forgotten pieces. Delivered as **push notifications** (Android, desktop, and iPhone once added to the Home Screen) and/or **email** (off until the person turns it on; every email has an unsubscribe link). Follows each person's language and time zone. *You → Reminders* has a "Send me a test" button.
- **Share an outfit as a picture** (1080×1350) from the Today screen, through the phone's share sheet or as a download.
- **Business → Products**: add a hand-picked product (store, link, photo address, price, type, colour) or **upload an affiliate feed** (CSV, TSV or JSON) in the browser, preview what will be imported, then import. Browse, mark out of stock, or delete products.

### Changed
- Web push uses VAPID keys that are generated once and kept in the data folder, so it needs no setup. The optional `PUSH_ENABLED`, `VAPID_*` and `REMINDERS_*` settings are in `.env.example`.

### Security
- Push subscriptions are only accepted from the browser vendors' real push services, so the server can never be pointed at an arbitrary address.

## [5.3.0] · 2026-10-08

### Added
- **Seven languages**: English, Spanish, French, German, Portuguese, Italian and Turkish. Screens, outfit explanations, weather tips, shop looks, closet-gap advice, error messages, the password-reset email and the AI stylist's notes all follow the language people pick (saved on their account). City search results come back in that language too.
- `node scripts/i18n.mjs check` (part of `npm run check`) fails when any language is missing a string or a placeholder differs.
- Business → Overview shows which languages people choose.
- Version and build shown in *You → Account* and Business → System.

### Changed
- Zips are named `modaward-<version>-<commit>.zip`, and packaging refuses a tree with uncommitted changes, so a zip always matches a commit. A release needs a matching `CHANGELOG.md` entry.
- The service worker cache is versioned per build automatically.

### Fixed
- Phone layouts (360px) no longer overflow sideways, including a small existing overflow on *Sizes & fit*.

## [5.2.0] · 2026-10-08

### Added
- **Dislike** is a labelled thumbs-down on outfits and shop looks; any single piece of today's outfit can be swapped out ("Not using today"); closet tiles have a quick remove.
- Business → **Overview** grows: signup funnel, audience (styles, cities, departments, ages), retention, paying vs comped Pro, closet and shopping activity, and **when people use the app** (weekday × hour heatmap, daily users, stickiness).
- Business → **Users**: searchable, filterable list with plan, last seen, closet size and activity.
- Business → **System**: one-click check of the weather service and your settings, with the exact failure reason.
- `/health` reports a build id.
- Impact affiliate site-verification tag.

### Fixed
- "Last seen" now updates while people use the app (it was only set at sign-in).
- Weather failures are logged with their real cause instead of a generic message.

## [5.1.0] · 2026-10-06

### Added
- **Pro codes** (redeemable on the Pro page) and **give Pro by email**, both time-limited and managed in Business → Pro access. Comped time ends by itself; a paying Stripe subscriber is never overridden.

## [5.0.2] · 2026-10-06

### Security
- Upgraded `nodemailer` to 10.0.15, clearing 13 published advisories.
- API responses are marked private and uncacheable so a proxy or CDN can never serve one person's data to another.

## [5.0.1] · 2026-10-06

### Fixed
- Hostinger **503s**: a failed start now serves a readable page and writes `startup-error.log` (`SHOW_STARTUP_ERRORS=1` shows the reason); `app.js` and `index.js` entry points for hosts with a different default; SQLite falls back from WAL where the filesystem can't do it; `npm run doctor`.
- A database left by an older app in the data folder is set aside instead of crashing the migration.

## [5.0.0] · 2026-10-06

First complete release: weather-aware outfit engine, closet with automatic background removal, Stitch Fix-style shop with mixed-store looks and closet-gap advice, full style profile, learning taste model, optional Claude stylist, Pro subscriptions with Stripe, affiliate tracking and feed importer, PWA, security hardening, tests and docs.
