# Changelog

Versions follow [semver](https://semver.org): **major** = a change that needs action from the owner, **minor** = new features, **patch** = fixes. Every zip is named `modaward-<version>-<commit>.zip`, `/health` reports the same `version` and `build`, and the app shows them under *You → Account*.

> Releases up to 5.2.0 were all uploaded as `modaward-5.0.0.zip`. They are numbered below after the fact so the history is readable; from 5.3.0 on, each zip carries its real version.

## [5.18.1] · 2026-10-20

### Fixed
- **Light check and pinstripe shirts are cut out whole.** A pale pattern looks like the surface square by square, so the background used to leak in between the squares and the photo was either refused ("too close in colour") or came out as a lace of holes. On a smooth surface the cut-out now treats a dense mesh of edges as cloth. Found with a real photo of a light checked shirt; a test now covers it.
- **The browser-tab icon is updated** to the new M-and-sun mark, drawn simpler so it stays readable at 16 pixels (`favicon.svg`, `favicon-32.png` and `favicon.ico`). Browsers and the offline cache kept showing the old hanger because the icon files were cached under the same names; the icons now carry a version in their address and the offline cache is renewed, so everyone gets the new one.
- Cut-outs no longer keep a pale outline from the old background: the studio finish shaves the outermost pixel and evens out the brightness of the rim.

## [5.18.0] · 2026-10-19

### Added
- **A large built-in store database.** About 530 stores across 13 regions (United States, Canada, United Kingdom, Australia, Germany/Austria/Switzerland, France, Spain, Italy, Portugal, Netherlands, Türkiye, Brazil, Mexico) plus global brands: fast fashion, department stores, luxury, sport and outdoor, shoes, marketplaces and resale. In *Brands and stores* (and in the first-run quiz) you can search the whole list, narrow it to where you shop, and pick as many as you like. Where you shop starts from your currency and language and you can change it.
- **Add your own store.** If a shop is not listed, add its name and website (and, if you like, a search link) and the Shop's links to it start to appear in your looks. Your stores are private to you, and the address is checked so only ordinary public shop websites are accepted.
- **Studio finish for photos.** A cut-out is now tidied automatically: a garment photographed a little crooked is straightened, the lumpy shading of wrinkles in plain fabric is softened (about a third less), and light that fell harder on one side is evened out. Colours and prints are left as they are. It is on by default, and a *Studio finish* switch (in Add a piece, Add several and after Touch up) gives the plain cut-out back. It is image processing on the phone, not AI, so it cleans a photo up but cannot press fabric flat or show the piece on a person.
- `npm run stores:check` visits every store's website and lists any that no longer answer, so the list is easy to keep current (it needs internet access).

### Changed
- Starter stores follow your region: someone in Germany who has picked no stores is sent to stores that ship to Germany, not American department stores. For people in the United States nothing changes: the starter set is exactly the original fourteen.
- Links use a store's own search page where we are certain of it and a search of the store's website otherwise, so every link is valid.

## [5.17.0] · 2026-10-18

### Added
- **Several pieces in one photo.** Lay a few pieces apart on a plain surface, take one photo, and each piece is cut out on its own and becomes its own card to check and add. In *Add several* there is a new switch, *Several pieces in one photo*. In the single-piece sheet, a photo that seems to show several pieces offers *Add them separately*, which hands the photo over. Pieces that are too close in colour to the surface are left out and you are told. Pieces that touch or overlap come out as one, so keep a little space between them. A pair of near-identical pieces (two shoes) is not offered as a split.

### Changed
- **New logo:** an M with a sun rising between its peaks. It replaces the hanger everywhere: the website, the favicon, the app icons and launch screens for iPhone and Android, the offline screen, the shared-outfit picture, the store screenshots and the front page.

### Fixed
- The front page's desktop layout and the Touch up styles were lost because of an unclosed brace in the stylesheet; the check now fails on an unbalanced stylesheet.

## [5.16.0] · 2026-10-17

### Added
- **A free version, and it is the default** (`PRICING=free`). Every feature is free for everyone: no billing, no Pro screens, no welcome offer, no limits on the closet or planning, in the website and both apps. The AI stylist and AI photo tagging stay off unless you set `FREE_AI=1` (they cost money per call). Set `PRICING=paid` to get the earlier Free / Pro plans back exactly as they were. Terms and Privacy follow the mode (no Pro subscriptions or Stripe mentioned when free).
- **Touch up** for cut-outs: when a photo's background is not removed well, or was left as it was, *Touch up* lets you erase what should go, restore what was cut by mistake, or tap a patch of backdrop to erase everything of that colour around it, with undo and start over. It works on the original photo, so it also rescues photos the automatic cut-out gave up on.
- The front page now explains how ModaWard works with real screenshots from the app (the three steps, what goes into a look, week, trip, shop and insights), plus a questions section.

### Improved
- **Background removal** is more careful and sharper. A striped or patterned garment whose light stripes looked like backdrop used to come out in pieces; it now comes out whole. When a garment is too close in colour to the surface, it says so and keeps your photo instead of guessing a bad cut-out. Edges are decided at full resolution, so they are crisper. Cut-out pieces now sit on the board with a soft contact shadow instead of looking pasted on. A built-in set of synthetic test photos (four kinds of surface, six garment shapes, shadows, noise) now guards the quality.

## [5.15.4] · 2026-10-16

### Fixed
- **The first screens ignored the notch** in the apps: the front page, the sign-in and sign-up pages and the first-run style quiz started under the status bar (the clock and battery sat on top of the logo). They now start below it, and the bottom keeps clear of the home bar. Nothing changes in a normal browser. A browser test checks all three.
- On shorter Android phone screenshots the phone frame covered a line of the headline; the layout now leaves room.

## [5.15.3] · 2026-10-16

### Fixed
- **On a phone with a notch the top bar was squeezed** (the app title half hidden under the status bar). The bar kept its 60px height but also added the notch's padding inside it. It now sits below the status bar at full height, in the iPhone and Android apps and anywhere a browser reports a top inset. Nothing changes in a normal browser. A browser test now checks it.

### Added
- `mobile/store/make-screenshots.mjs` makes the App Store and Google Play screenshots from the real app: iPhone 6.9" and 6.5", iPad 13", Android phone and 10" tablet, plus the Google Play feature graphic (see docs/MOBILE.md).

## [5.15.2] · 2026-10-15

### Fixed
- Xcode warned that the iOS launch-screen image set had "3 unassigned children": three unused leftover images from Capacitor's default template. They are removed (the real launch screens were never affected), and a test now fails if an unused image ever sits in an iOS asset set.

## [5.15.1] · 2026-10-15

### Fixed
- `npm install` in `mobile/` no longer pulls in the icon-generating tools (they came with 7 security warnings, one critical, in tools that never ship in the app). They now live in `mobile/tools/` and install only when you run `npm run assets`. A plain install is down to 3 low-severity notices that come from Capacitor's own command-line tool.

## [5.15.0] · 2026-10-15

### Added
- **iPhone and Android apps** (`mobile/`, guide in `docs/MOBILE.md`). They are native shells around this same web app, so a change to the website is a change to both apps with nothing to rebuild. Includes the app icons and launch screens in every size (light and dark), camera, photo and location permissions with the explanations the stores require, a branded offline screen in the phone's language, and the website's version number on both. Ready for you to open in Xcode and Android Studio; it has not been run on a real device yet.
- In the apps, nothing offers or links to buying Pro (Apple and Google require their own in-app purchase for subscriptions; see the guide). Pro the person already has works everywhere. A browser test runs the site as the apps will and fails if a purchase button appears.
- The Privacy Policy now mentions the apps and what they ask permission for.

### Changed
- Page layout reads safe areas (notches, gesture bars) from the browser or from the Android app, whichever provides them. Nothing changes in a browser.

## [5.14.0] · 2026-10-15

### Added
- **A reminder before free Pro ends.** In the last two weeks a notice in the app says when it ends, with *Keep Pro*; it can be put away and comes back for the next end date. By email (and push, for people who use it) a notice goes out a week before and another the day before, in the person's language, only during the daytime and only once each. It covers time-limited free Pro only, never paying subscribers. Every email has a one-tap *Turn off emails* link, which also stops these notices. If the mail server is down the notice is retried on the next pass instead of being lost.

## [5.13.0] · 2026-10-14

### Added
- **Three months of Pro free for new members.** Every new account now gets Pro for 90 days, with no card. It shows on the front page, the sign-up screen and the Pro page, in all languages. It ends by itself (the account carries on as Free), existing accounts are not changed, and a member can subscribe at any time to keep Pro. *You → Account* now says "Free Pro until <date>" instead of "Renews", and offers *See Pro* rather than *Manage billing* (there is no subscription to manage yet). The length is the setting `SIGNUP_PRO_DAYS` (default 90; `0` switches the offer off; maximum 365). The Terms mention the offer.

## [5.12.0] · 2026-10-14

### Added
- **A proper front page.** Visitors who are not signed in now land on a page that explains the app before asking for anything: what it does, how it works in three steps, what you get, how your data is treated, an example of a day's look, and *Get started free* / *Sign in* buttons (also in every language). Signed-in people still open straight on Today.
- **Show / hide password** on sign-up, sign-in and reset, so a password can be checked before it is submitted.

### Fixed
- **The sign-up agreement checkbox was below the *Create account* button**, easy to miss. It now sits above the button.
- **Clothes overlapping in some outfit pictures.** A page style meant for one picture also resized the small garment cells inside others. It squeezed the pictures on the style-vote cards in *You → Style* and the first-run quiz, made the packing-list outfits in *Pack for a trip* oversized, and did the same to the sample boards on the sign-in page. The style is now limited to the outer picture. A browser check now fails the build if any garment cell is drawn larger than it was given, on the front page, quiz, Today and the trip list.

## [5.11.0] · 2026-10-13

### Added
- **A style quiz when you join.** After choosing your city, a seven-step quiz now builds your profile before the first outfit: *about you* (who you shop for, language, currency), *style* (vote on looks), *colours* (loved, avoided, patterns), *fit and sizes*, *life and budget*, and *rules and stores* (what to never suggest, how current you like to look, where you shop). Each step is the same form you already had under *You*, saves as you go, and has Back and Continue. *Skip for now* still works. You can take it again any time from *You → Style → Start over → Retake the style quiz*; your answers stay until you change them.
- **A sign-up agreement.** Creating an account now requires confirming you are at least 16 and accept the Terms and Privacy Policy, and that suggestions are guidance only. Existing accounts are asked once. The version and time of acceptance are stored with the account and included in the data export. The legal pages were expanded to match. These are plain-language templates, not legal advice: have a lawyer review them and set `OPERATOR_NAME` and `CONTACT_EMAIL` before launch.

### Changed
- On the *You* page, every style section now shows its own "Saved" confirmation.

## [5.10.1] · 2026-10-13

### Fixed
- **You → About you: the Language box ran over the Location box** when the place name was long (for example "Philadelphia, Pennsylvania"). The location now gets a wider box, a long name is shortened with "…" instead of spilling out, and Language and Currency sit in their own cells. A browser check now fails the build if any field in that form overlaps another.

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
