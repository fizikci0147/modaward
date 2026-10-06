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
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=no-reply@yourdomain.com
SMTP_PASS=<mailbox password>
SMTP_FROM=ModaWard <no-reply@yourdomain.com>
```

**Two settings people get wrong**

- `DATA_DIR` must be **outside** the application folder. Redeploys replace the app folder; your users' database and photos live in `DATA_DIR` and must survive. (If you leave it unset, ModaWard uses `~/modaward-data`, which is also outside the app folder.)
- `APP_URL` is **required**. Password-reset emails and Stripe return links are built from it, never from the request's Host header (which attackers can forge).

Do **not** set `PORT` unless Hostinger tells you to: the platform provides it.

## 4. Start it and check

Press **Start / Restart**, then open:

- `https://yourdomain.com/health` → `{"ok":true,...}`
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
5. **Background removal fallback (optional).** `REMOVEBG_API_KEY`.

## 6. Updating

- Git deploy: push; hPanel redeploys. Zip deploy: upload the new zip over the old one. Migrations run automatically at startup.
- Run `npm run backup` before big updates. Back up `DATA_DIR/uploads` (photos) as well; Hostinger's own backups can cover both.

## 7. Backups (do this on day one)

Schedule a daily cron job in hPanel (**Advanced → Cron jobs**):

```
cd ~/domains/yourdomain.com/nodejs && /usr/bin/env node scripts/backup.mjs
```

This writes consistent snapshots to `DATA_DIR/backups` and keeps the newest 14.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| App won't start, "No SQLite driver available" | Node.js version is below 22.5 and `better-sqlite3` was not installed. Pick Node 22+, or run `npm install` again. |
| "No writable data directory" | `DATA_DIR` points somewhere the app user can't write. Use a folder under your home directory. |
| Sign-in works but you are logged out on refresh | The panel is terminating HTTPS in front of Node: set `TRUST_PROXY=1`. |
| Password-reset emails never arrive | Check `SMTP_*` and `APP_URL`; run `npm run live:check`. Without SMTP the link is only written to the server log. |
| Pro purchase succeeds but the account stays Free | The webhook is missing or its secret is wrong. In Stripe → Developers → Webhooks look for failed deliveries. |
| Weather shows "temporarily unavailable" | The server cannot reach api.open-meteo.com. Check outbound access; recent data is served from cache up to 6 hours. |
| Photos disappear after a deploy | `DATA_DIR` was inside the app folder. Move it out (see step 3) and restore from backup. |

## Running on a VPS instead

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash - && sudo apt-get install -y nodejs
npm install --omit=dev
cp .env.example .env   # edit it
npm install -g pm2 && pm2 start server.js --name modaward && pm2 save && pm2 startup
```

Run **one** instance (SQLite and the in-memory rate limiter assume a single process), and put Nginx or Caddy in front for HTTPS.
