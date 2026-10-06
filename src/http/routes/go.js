import { now } from '../../db/index.js';

/** GET /go — verified redirect to a retailer, with click logging. */
export function goRoute({ linker, repos, log }) {
  return (req, res) => {
    const hit = linker.verify(req.query);
    if (!hit) return res.status(400).type('text/plain').send('This link is not valid.');
    try {
      repos.db.run('INSERT INTO click_events (user_id,retailer,kind,host,created_at) VALUES (?,?,?,?,?)', req.user?.id ?? null, hit.retailer.id, hit.kind, hit.host, now());
    } catch (e) {
      log.warn('click.log_failed', { message: e.message });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.redirect(302, hit.destination);
  };
}
