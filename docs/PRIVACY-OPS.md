# Data, privacy and operations notes

For the person running the site. The public Privacy Policy (`public/js/views/legal.js`) is written from this; keep them in step if you change what is stored.

## What is stored, and for how long

| Data | Where | Kept |
|---|---|---|
| Account (email, name, password hash), sessions | `users`, `sessions` | until the account is deleted; sessions until they expire |
| Closet, photos, profile, taste model, wear history, planned days, reminder settings, push devices | per-user tables, `DATA_DIR/uploads` | until the account is deleted |
| Saved looks | `saved_looks` | until removed / account deleted |
| Shop looks shown (for feedback) | `looks` | 14 days |
| Hours of activity | `user_activity` | 400 days |
| Shop link clicks | `click_events` | 400 days (the user link is cleared when an account is deleted) |
| Browser error reports | `client_errors` | 30 days |
| AI usage counters | `ai_usage` | 400 days |
| Payment webhook ids | `stripe_events` | 90 days |
| Password-reset tokens | `password_resets` | removed a day after use/expiry |
| Reminder send log | `reminder_log` | 60 days |

A background pass removes expired rows two minutes after start-up and then hourly (`housekeeping()` in `src/main.js`).

## Deleting an account

*Profile → Account & plan → Delete account* removes every row linked to the person (the database cascades), cancels their Stripe subscription first (and refuses to delete if that fails), and deletes their photo files. Copies in backups made before the deletion remain until those backups rotate out (14 days from this app's own backups). SQLite does not overwrite freed pages immediately.

## Backups

See the deploy guide. `npm run backup` refuses to run without a real database, checks the copy, keeps the generated secrets with it, and writes files readable only by the app's user. The backup folder is on the same disk as the data: copy it elsewhere.

## Things this app cannot do for you

- **Email addresses are not verified.** Register your own `ADMIN_EMAILS` account first.
- **Alerting.** *Business → System check* shows disk space, backup age, the payment webhook secret and unclaimed admin addresses, but nothing pages you. Check it after each deploy and put `/ready` in an uptime monitor (it fails when the database cannot be written, for example when the disk is full).
