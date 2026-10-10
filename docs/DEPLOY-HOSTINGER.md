# Deploying ModaWard on Hostinger

ModaWard is a standard Node.js application with a SQLite database, so it runs on **Hostinger's Node.js hosting** (Business, Cloud and VPS plans). Shared "Premium" plans without Node.js support cannot run it; use the Business plan or above, or a VPS.

> I could not log in to your Hostinger account from here, so these steps follow Hostinger's documented flow rather than a recording of it. Menu names move around in hPanel; the *values* (Node version, start file, environment variables) are what matter.

## 0. Before you start

- A Hostinger **Business or Cloud** plan (or a VPS), with your domain pointed at it and **SSL enabled** (Websites → your site → Security → SSL).
- Node.js **22.x or 24.x** (what hPanel offers; 20.19+ also works).
- Optional but recommended: a Hostinger **mailbox** for password-reset emails (e.g. `no-reply@yourdomain.com`).

## 1. Get the files onto the server

**Option A: Git (best for updates).** Push this repository to GitHub, then in hPanel: **Websites → Add website → Node.js Apps → Import Git repository**, authorise GitHub and choose the repository and branch. Every `git push` can redeploy.

**Option B: upload the zip.** On your computer run `npm install && npm run package`, then in hPanel choose **Node.js Apps → Upload your website files** and upload `dist/modaward-<version>.zip`.

## 2. Configure the application

| Setting | Value |
|---|---|
| Node.js version | 22.x (or 24.x) |
| Install command | `npm install --omit=dev` |
| Build command | *(leave empty: there is no build step)* |
| Entry / start file | `server.js` (or start command `npm start`) |
| Application mode | Production |

## 3. Environment variables

Add these in hPanel's **Environment variables** for the app (or put a `.env` file next to `server.js`; real environment variables win):

```
NODE_ENV=production
TRUST_PROXY=1
APP_URL=https://yourdomain.com
DATA_DIR=/home/<your-hostinger-user>/modaward-data
ADMIN_EMAILS=you@yourdomain.com
OPERATOR_NAME=Your name or company
CONTACT_EMAIL=privacy@yourdomain.com
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=<mailbox password>
SMTP_FROM=ModaWard <no-reply@yourdomain.com>
```

**Do this straight after the first start: register your own account with the `ADMIN_EMAILS` address.** The app does not verify email addresses, so until that account exists anyone who signs up with that address first becomes an admin (the *Business → System check* page warns you while it is unclaimed). `OPERATOR_NAME` and `CONTACT_EMAIL` appear in the Privacy Policy as who is responsible and how to reach them; many countries require that. `APP_URL` is the plain address (`https://yourdomain.com`, no path); the app stops with a clear message if it cannot read it.

**Two settings people get wrong**

- `DATA_DIR` must be **outside** the application folder. Redeploys replace the app folder; your users' database and photos live in `DATA_DIR` and must survive. (If you leave it unset, ModaWard uses `~/modaward-data`, which is also outside the app folder.)
- `APP_URL` is **required**. Password-reset emails and Stripe return links are built from it, never from the request's Host header (which attackers can forge).

Do **not** set `PORT` unless Hostinger tells you to: the platform provides it.

## 4. Start it and check

Press **Start / Restart**, then open:

- `https://yourdomain.com/health` → `{"ok":true,"version":"5.7.0","build":"5.7.0+abc1234",...}`. The version and build must match the name of the zip you uploaded (`modaward-5.7.0-abc1234.zip`); if they don't, the old code is still running
- `https://yourdomain.com/` → the sign-in page. Create your account.

On the server's SSH terminal you can also run the integration check once your keys are in place:

```bash
cd ~/domains/yourdomain.com/nodejs      # wherever the app lives
npm run live:check
```

## 5. Switch on the business, in this order

1. **Weather licence.** Open-Meteo's free endpoint is non-commercial. Buy their commercial plan and set `OPEN_METEO_API_KEY` before charging users.
2. **Stripe (Pro subscriptions).** In Stripe create one product with two recurring prices (monthly, yearly). Set `STRIPE_SECRET_KEY`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`. Add a webhook endpoint `https://yourdomain.com/api/billing/webhook` for the events `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and copy its signing secret into `STRIPE_WEBHOOK_SECRET`. Enable the Customer Portal in Stripe settings. Test in Stripe test mode first (`npm run live:check` prints TEST mode).
3. **Affiliate links and products.** See [BUSINESS.md](BUSINESS.md): join networks, set `AFFILIATE_CONFIG`, import product feeds.
4. **AI stylist.** Set `ANTHROPIC_API_KEY`. Read the cost notes in BUSINESS.md first; the default per-user daily cap is 12 calls.
5. **Reminders (push and email).** Nothing to set up for push: keys are generated into `DATA_DIR/secrets` on first start (keep that folder in your backups, because devices subscribed with these keys stop receiving notifications if the keys change). Email reminders need the `SMTP_*` settings and `APP_URL`. The reminder timer runs inside the Node process, so the app must stay running (Business Cloud Node apps do; if your plan sleeps idle apps, reminders only go out while it is awake). Open *You → Reminders* and press "Send me a test". On iPhone, notifications work only after the person adds the app to the Home Screen.
6. **Background removal fallback (optional).** `REMOVEBG_API_KEY`.

## 6. Updating

- Git deploy: push; hPanel redeploys (the Git checkout has no `BUILD.json`, so the build shows as "development" and browsers re-check files every visit; a zip from `npm run package` gets per-release URLs and long caching). Zip deploy: upload the new zip over the old one. Migrations run automatically at startup.
- Run `npm run backup` before big updates. Back up `DATA_DIR/uploads` (photos) as well; Hostinger's own backups can cover both.

## 7. Backups (do this on day one)

Schedule a daily cron job in hPanel (**Advanced → Cron jobs**):

```
cd ~/domains/yourdomain.com/nodejs && /usr/bin/env node scripts/backup.mjs
```

Cron jobs do **not** receive the app's environment variables, so put the data folder on the command line: `cd ~/domains/yourdomain.com/nodejs && DATA_DIR=/home/<user>/modaward-data node scripts/backup.mjs`. The script refuses to run (and says why) if it cannot find a database or the database has no users, so a wrong path can never replace your good backups with an empty one.

Each run writes a checked, private (mode 600) snapshot of the database **and a copy of the generated secrets** (push keys, link-signing keys) to `DATA_DIR/backups` and keeps the newest 14. **That folder sits on the same disk as the live data, so copy it somewhere else regularly** (download it, or have Hostinger's backup include it). Back up `DATA_DIR/uploads` (the photos) the same way. After you delete an account, copies made earlier still contain it until they rotate out, which the Privacy Policy tells people (14 days).

When a database from an older version is found, it is never deleted: it is renamed `modaward.previous-<date>.db` beside the new one. Remove those files yourself when you no longer need them.

## Troubleshooting

### "503 Service Unavailable"

A 503 from Hostinger means the platform could not reach a running Node process. Work down this list; the first three fix almost every case.

1. **Startup file.** Set the entry/startup file to `server.js`. (`app.js` and `index.js` also work, because hosts differ in what they default to.)
2. **Dependencies.** Run `npm install --omit=dev` in the app folder (hPanel → Node.js app → *Run NPM install*, or SSH). A missing `node_modules` is the most common cause.
3. **Node version.** Choose **22.x or 24.x** in hPanel, then restart.
4. **Ask the app.** Set the environment variable `SHOW_STARTUP_ERRORS=1` and restart. If the app itself fails to start, the 503 page now says why (and the same reason is written to `startup-error.log` in the app folder). Remove the variable once fixed.
5. **Full check over SSH.** `cd` into the app folder and run `npm run doctor`. It checks Node version, files, dependencies, the SQLite driver, the data folder and `APP_URL`, and prints the fix for each failure.
6. **Still plain "503" with no message from ModaWard.** Then Node never started at all (wrong folder, wrong startup file, or the platform's own limit). Check the application's log in hPanel and confirm the startup file exists in the folder hPanel points at.

| Symptom | Likely cause |
|---|---|
| App won't start, "No SQLite driver available" | Node.js version is below 22.5 and `better-sqlite3` was not installed. Pick Node 22.13+, or run `npm install` again. |
| "table users already exists" (older versions) | An older ModaWard database was sitting in `DATA_DIR`. Current versions set it aside as `modaward.previous-<date>.db` and start a new one automatically. |
| "No writable data directory" | `DATA_DIR` points somewhere the app user can't write. Use a folder under your home directory. |
| Sign-in works but you are logged out on refresh | The panel is terminating HTTPS in front of Node: set `TRUST_PROXY=1`. |
| Password-reset emails never arrive | Check `SMTP_*` and `APP_URL`; run `npm run live:check`. Without SMTP, reset links are not delivered anywhere in production (they are only written to the log when `LOG_MAIL_BODIES=1`). |
| Pro purchase succeeds but the account stays Free | The webhook is missing or its secret is wrong. In Stripe → Developers → Webhooks look for failed deliveries. |
| Weather shows "temporarily unavailable" | The server cannot reach api.open-meteo.com. Check outbound access; recent data is served from cache up to 6 hours. |
| A new version is uploaded and `/health` shows it, but the screens look the same | Since 5.5.1 each release uses its own file addresses, so a cache cannot hold old screens. If you still see old ones, open the site in a private window; if that is fine, clear the site data in your browser. The version in *You → Account* tells you which build the page is running. |
| Photos disappear after a deploy | `DATA_DIR` was inside the app folder. Move it out (see step 3) and restore from backup. |

## Restoring from a backup

1. Stop the app (hPanel → Node.js app → Stop).
2. In `DATA_DIR`, move `modaward.db` (and any `modaward.db-wal` / `modaward.db-shm`) out of the way, then copy the backup you want from `DATA_DIR/backups/` to `DATA_DIR/modaward.db`.
3. Photos live in `DATA_DIR/uploads` and are **not** part of the database backup: restore that folder from your own copy or Hostinger's backups too, or pieces will show their drawings instead of photos.
4. Start the app and open `/health`. Sign in and check your closet.

A backup is only proven when it has been restored once. Do a trial restore into a spare folder before you need it.

## Running on a VPS instead

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs
npm install --omit=dev
cp .env.example .env   # edit it
npm install -g pm2 && pm2 start server.js --name modaward && pm2 save && pm2 startup
```

Run **one** instance (SQLite and the in-memory rate limiter assume a single process), and put Nginx or Caddy in front for HTTPS.
