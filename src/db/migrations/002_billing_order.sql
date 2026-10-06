-- Stripe may deliver webhooks out of order; remember the newest event applied to each user.
ALTER TABLE users ADD COLUMN plan_event_at INTEGER NOT NULL DEFAULT 0;
