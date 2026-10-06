/**
 * ModaWard Pro subscriptions on Stripe, via Stripe's REST API (no SDK, no extra dependency).
 *
 * Flow: the app asks for a Checkout Session, sends the person to Stripe, and Stripe tells us
 * what happened through signed webhooks. The webhook is the only thing that changes a plan, so
 * a payment can never be faked from the browser.
 */
import crypto from 'node:crypto';
import { now } from '../db/index.js';
import { HttpError, badRequest, unavailable } from '../util/errors.js';

const API = 'https://api.stripe.com/v1';
const TOLERANCE_S = 300;
const PRO_STATUSES = new Set(['active', 'trialing', 'past_due']); // past_due keeps access while Stripe retries the card

/** Verify a Stripe-Signature header against the raw body. */
export function verifySignature(rawBody, header, secret, { nowS = now(), toleranceS = TOLERANCE_S } = {}) {
  if (!header || !secret) return false;
  let t = null;
  const sigs = [];
  for (const part of header.split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') t = v;
    else if (k === 'v1' && v) sigs.push(v);
  }
  if (!t || !/^\d+$/.test(t) || !sigs.length) return false;
  if (Math.abs(nowS - Number(t)) > toleranceS) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.`).update(rawBody).digest('hex');
  const exp = Buffer.from(expected);
  return sigs.some((s) => {
    const got = Buffer.from(s);
    return got.length === exp.length && crypto.timingSafeEqual(got, exp);
  });
}

const periodEnd = (sub) => sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end ?? null;

/**
 * @param {import('../config.js').Config} config
 * @param {ReturnType<import('../repo/index.js').createRepos>} repos
 * @param {{info:Function, warn:Function, error:Function}} log
 * @param {typeof fetch} [doFetch]
 */
export function createBilling(config, repos, log, doFetch = globalThis.fetch) {
  const { stripe } = config;
  if (!stripe.secretKey) return null;

  async function call(method, path, params) {
    let res;
    try {
      res = await doFetch(`${API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${stripe.secretKey}`, ...(params ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
        body: params ? new URLSearchParams(params).toString() : undefined,
        signal: AbortSignal.timeout(15_000)
      });
    } catch (e) {
      log.error('stripe.network', { path, message: e.message });
      throw unavailable('Payments are temporarily unavailable. Please try again in a moment.');
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      log.error('stripe.error', { path, status: res.status, type: json.error?.type, code: json.error?.code, message: json.error?.message });
      throw new HttpError(502, 'payment_error', 'We could not reach the payment provider. You have not been charged.');
    }
    return json;
  }

  /** Set a user's plan from a subscription object, ignoring events older than one already applied. */
  function applySubscription(sub, eventCreated) {
    const userId = sub.metadata?.user_id;
    const user = (userId && repos.users.byId(userId)) || repos.users.byStripeCustomer(sub.customer);
    if (!user) {
      log.warn('stripe.unknown_user', { customer: sub.customer });
      return;
    }
    if (eventCreated < (user.plan_event_at ?? 0)) return;
    const pro = PRO_STATUSES.has(sub.status);
    repos.users.setPlan(user.id, { plan: pro ? 'pro' : 'free', status: sub.status, renewsAt: pro ? periodEnd(sub) : null, customerId: sub.customer, subscriptionId: sub.id });
    repos.db.run('UPDATE users SET plan_event_at = ? WHERE id = ?', eventCreated, user.id);
    log.info('stripe.plan', { user: user.id, plan: pro ? 'pro' : 'free', status: sub.status });
  }

  function handle(event) {
    const obj = event.data?.object ?? {};
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription') return;
        const user = repos.users.byId(obj.client_reference_id || obj.metadata?.user_id);
        if (!user) return log.warn('stripe.checkout_unknown_user', {});
        // grant access immediately; the subscription event that follows carries the exact period end
        if (event.created >= (user.plan_event_at ?? 0)) {
          repos.users.setPlan(user.id, { plan: 'pro', status: 'active', renewsAt: null, customerId: obj.customer, subscriptionId: obj.subscription });
          repos.db.run('UPDATE users SET plan_event_at = ? WHERE id = ?', event.created, user.id);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        applySubscription(obj, event.created);
        break;
      case 'customer.subscription.deleted':
        applySubscription({ ...obj, status: 'canceled' }, event.created);
        break;
      default:
    }
  }

  return {
    /** Express handler. Mounted with express.raw() so the signature covers the exact bytes. */
    webhook(req, res) {
      const raw = req.body;
      if (!Buffer.isBuffer(raw) || !verifySignature(raw, req.get('stripe-signature'), stripe.webhookSecret)) {
        return res.status(400).json({ error: { code: 'bad_signature', message: 'Invalid signature.' } });
      }
      let event;
      try {
        event = JSON.parse(raw.toString('utf8'));
      } catch {
        return res.status(400).json({ error: { code: 'bad_json', message: 'Invalid payload.' } });
      }
      try {
        // idempotent: Stripe retries, and the same event may arrive twice
        const fresh = repos.db.run('INSERT OR IGNORE INTO stripe_events (id, received_at) VALUES (?, ?)', event.id, now()).changes;
        if (fresh) handle(event);
        res.json({ received: true });
      } catch (e) {
        repos.db.run('DELETE FROM stripe_events WHERE id = ?', event.id); // let Stripe retry
        log.error('stripe.webhook_failed', { type: event.type, message: e.message });
        res.status(500).json({ error: { code: 'webhook_failed', message: 'Could not process event.' } });
      }
    },

    async checkout(user, interval, base) {
      const price = interval === 'year' ? stripe.priceYearly : stripe.priceMonthly;
      if (!price) throw badRequest('That billing option is not available.');
      if (!base) throw unavailable('Payments are not fully configured yet (the site address is missing).');
      if (user.plan === 'pro' && user.plan_status === 'active') throw badRequest('You are already on Pro. Manage your plan from your profile.');
      const params = {
        mode: 'subscription',
        'line_items[0][price]': price,
        'line_items[0][quantity]': '1',
        success_url: `${base}/style?section=account&upgraded=1`,
        cancel_url: `${base}/pro`,
        client_reference_id: user.id,
        'metadata[user_id]': user.id,
        'subscription_data[metadata][user_id]': user.id,
        allow_promotion_codes: 'true'
      };
      if (user.stripe_customer_id) params.customer = user.stripe_customer_id;
      else params.customer_email = user.email;
      const session = await call('POST', '/checkout/sessions', params);
      if (!session.url) throw new HttpError(502, 'payment_error', 'We could not start checkout. You have not been charged.');
      return { url: session.url };
    },

    async portal(user, base) {
      if (!user.stripe_customer_id) throw badRequest('There is no subscription to manage yet.');
      if (!base) throw unavailable('Payments are not fully configured yet (the site address is missing).');
      const session = await call('POST', '/billing_portal/sessions', { customer: user.stripe_customer_id, return_url: `${base}/style?section=account` });
      return { url: session.url };
    },

    /** Called when an account is deleted: stop billing immediately. */
    async cancelForUser(user) {
      if (user.stripe_subscription_id) await call('DELETE', `/subscriptions/${encodeURIComponent(user.stripe_subscription_id)}`);
    }
  };
}
