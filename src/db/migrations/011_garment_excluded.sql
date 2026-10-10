-- "Don't suggest this piece": it stays in the closet (and in cost-per-wear and wear history) but
-- is never put into an outfit, a week plan, a trip or a shop look built around the closet.
ALTER TABLE garments ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0;
