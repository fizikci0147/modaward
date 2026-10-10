import { Router } from 'express';
import fs from 'node:fs';
import { requireUser } from '../middleware.js';
import { object, partial, string, number, boolean, oneOf, arrayOf, hexColor, optional } from '../../util/validate.js';
import { TYPE_IDS, TYPES, PATTERNS, ARCHETYPE_IDS } from '../../shared/taxonomy.js';
import { colorName } from '../../shared/color.js';
import { notFound, badRequest } from '../../util/errors.js';
import { assertCanAddGarments, assertWithinStorageCap } from '../../services/plans.js';
import { starterWardrobe } from '../../services/starter.js';
import { daysBetween } from '../../shared/dormancy.js';

const fields = {
  name: string({ min: 1, max: 80 }),
  type: oneOf(TYPE_IDS),
  color: hexColor(),
  pattern: oneOf(PATTERNS),
  warmth: number({ min: 0, max: 5, step: 0.5 }),
  formality: number({ min: 1, max: 5, step: 0.5 }),
  waterproof: boolean(),
  brand: string({ max: 40 }),
  styles: arrayOf(oneOf(ARCHETYPE_IDS), { max: 7, unique: true }),
  notes: string({ max: 300 }),
  favorite: boolean(),
  price: number({ min: 0, max: 100000 })
};

const createSchema = object({
  ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, k === 'type' || k === 'color' ? v : optional(v, undefined)])),
  image: optional(string({ max: 5_000_000, trim: false }), undefined)
});
const patchSchema = partial({ ...fields, archived: boolean() });
const photoSchema = object({ image: string({ min: 20, max: 5_000_000, trim: false }) });
const starterSchema = object({ department: optional(oneOf(['men', 'women', 'unisex']), undefined) });

const dateField = string({ pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: 'must be a date like 2026-10-06', max: 10 });
const wornSchema = object({ date: dateField });

/** A wear date may be backdated up to three years, and at most a day ahead (time zones). */
function assertPlausibleDate(date) {
  const today = new Date().toISOString().slice(0, 10);
  const ago = daysBetween(date, today);
  if (Number.isNaN(ago) || ago < -1 || ago > 3 * 365) throw badRequest('That date is out of range.');
}

/** The form speaks in currency units, the database in cents; 0 means "no price". */
function withPriceCents(input) {
  const { price, ...rest } = input;
  return price === undefined ? rest : { ...rest, priceCents: price > 0 ? Math.round(price * 100) : null };
}

const ID_RE = /^[0-9a-f-]{36}$/;
const idParam = (req) => {
  if (!ID_RE.test(req.params.id)) throw notFound('That item was not found.');
  return req.params.id;
};

export function garmentRoutes({ config, repos, images }) {
  const r = Router();
  r.use('/garments', requireUser);

  r.get('/garments', (req, res) => {
    const includeArchived = req.query.archived === '1';
    res.json({ garments: repos.garments.list(req.user.id, { includeArchived }), limit: config.plans.freeClosetLimit });
  });

  r.post('/garments', (req, res) => {
    const input = createSchema(req.body);
    assertCanAddGarments(req.user, config, repos.garments.count(req.user.id));
    assertWithinStorageCap(req.user, repos.garments.countAll(req.user.id));
    const { image, ...data } = withPriceCents(input);
    data.name ||= req.t('{color} {type}', { color: req.t(colorName(data.color)), type: req.t(TYPES[data.type].label).toLowerCase() }).replace(/^./, (c) => c.toUpperCase());
    let saved = null;
    if (image) saved = images.save(image);
    try {
      const garment = repos.garments.create(req.user.id, { ...data, imageName: saved?.name });
      res.status(201).json({ garment });
    } catch (e) {
      if (saved) images.remove(saved.name);
      throw e;
    }
  });

  r.post('/garments/starter', (req, res) => {
    const { department } = starterSchema(req.body ?? {});
    const dept = department || repos.profiles.get(req.user.id).department;
    const items = starterWardrobe(dept, req.t);
    assertCanAddGarments(req.user, config, repos.garments.count(req.user.id), items.length);
    assertWithinStorageCap(req.user, repos.garments.countAll(req.user.id), items.length);
    const created = repos.db.transaction(() => items.map((item) => repos.garments.create(req.user.id, item)));
    res.status(201).json({ garments: created });
  });

  r.get('/garments/:id', (req, res) => {
    const garment = repos.garments.get(req.user.id, idParam(req));
    if (!garment) throw notFound('That item was not found.');
    res.json({ garment });
  });

  r.patch('/garments/:id', (req, res) => {
    const patch = withPriceCents(patchSchema(req.body));
    if (!Object.keys(patch).length) throw badRequest('Nothing to update.');
    const id = idParam(req);
    // un-archiving counts against the free limit like a new item
    if (patch.archived === false) {
      const cur = repos.garments.get(req.user.id, id);
      if (cur?.archived) assertCanAddGarments(req.user, config, repos.garments.count(req.user.id));
    }
    const garment = repos.garments.update(req.user.id, id, patch);
    if (!garment) throw notFound('That item was not found.');
    res.json({ garment });
  });

  r.delete('/garments/:id', (req, res) => {
    const removedImage = repos.garments.remove(req.user.id, idParam(req));
    if (removedImage === null) throw notFound('That item was not found.');
    if (removedImage) images.remove(removedImage);
    res.json({ ok: true });
  });

  // "I wore this piece": log (or back-date) a single piece without picking a whole outfit
  r.post('/garments/:id/worn', (req, res) => {
    const id = idParam(req);
    const { date } = wornSchema(req.body);
    assertPlausibleDate(date);
    if (!repos.garments.get(req.user.id, id)) throw notFound('That item was not found.');
    repos.wear.log(req.user.id, { garmentIds: [id], date, outfitKey: `piece:${id}`, occasion: null });
    res.json({ garment: repos.garments.get(req.user.id, id) });
  });

  r.delete('/garments/:id/worn', (req, res) => {
    const id = idParam(req);
    const { date } = wornSchema({ date: req.query.date });
    if (!repos.garments.get(req.user.id, id)) throw notFound('That item was not found.');
    repos.wear.unlogOne(req.user.id, id, date);
    res.json({ garment: repos.garments.get(req.user.id, id) });
  });

  r.put('/garments/:id/photo', (req, res) => {
    const id = idParam(req);
    const { image } = photoSchema(req.body);
    if (!repos.garments.get(req.user.id, id)) throw notFound('That item was not found.');
    const saved = images.save(image);
    const previous = repos.garments.imageName(req.user.id, id);
    repos.garments.setImage(req.user.id, id, saved.name);
    if (previous) images.remove(previous);
    res.json({ garment: repos.garments.get(req.user.id, id) });
  });

  r.delete('/garments/:id/photo', (req, res) => {
    const id = idParam(req);
    if (!repos.garments.get(req.user.id, id)) throw notFound('That item was not found.');
    const previous = repos.garments.imageName(req.user.id, id);
    repos.garments.setImage(req.user.id, id, null);
    if (previous) images.remove(previous);
    res.json({ garment: repos.garments.get(req.user.id, id) });
  });

  return r;
}

/** Authenticated photo delivery: only the owner can fetch a file, and it is never cached publicly. */
export function uploadsRoute({ repos, images }) {
  return (req, res, next) => {
    if (!req.user) return next(notFound('Photo not found.'));
    const file = images.pathFor(req.params.name);
    if (!file || !repos.garments.ownsImage(req.user.id, req.params.name)) return next(notFound('Photo not found.'));
    if (!fs.existsSync(file)) return next(notFound('Photo not found.'));
    res.setHeader('Content-Type', images.mimeFor(req.params.name));
    res.setHeader('Cache-Control', 'private, max-age=604800, immutable');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.sendFile(file);
  };
}
