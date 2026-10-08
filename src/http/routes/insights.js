import { Router } from 'express';
import { requireUser } from '../middleware.js';
import { buildInsights } from '../../ai/insights.js';

export function insightsRoutes({ repos }) {
  const r = Router();
  r.use('/insights', requireUser);
  r.get('/insights', (req, res) => res.json(buildInsights({ tasteState: repos.profiles.getTaste(req.user.id), garments: repos.garments.list(req.user.id), t: req.t })));
  return r;
}
