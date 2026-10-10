import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { buildInsights } from '../../ai/insights.js';
import { wardrobeStats } from '../../shared/wardrobe-stats.js';

export function insightsRoutes({ repos }) {
  const r = Router();
  r.use('/insights', requireUser);
  r.get('/insights', (req, res) => res.json(buildInsights({ tasteState: repos.profiles.getTaste(req.user.id), garments: repos.garments.list(req.user.id), t: req.t })));
  r.get('/insights/wardrobe', (req, res) => {
    const q = String(req.query.today || '');
    const today = /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : new Date().toISOString().slice(0, 10);
    const garments = repos.garments.list(req.user.id);
    res.json({ stats: wardrobeStats({ garments, counts30: repos.wear.countsSince(req.user.id, 30, today), counts90: repos.wear.countsSince(req.user.id, 90, today), today }) });
  });
  return r;
}
