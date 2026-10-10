-- A claim row now records whether anything was actually delivered, so the "forgotten pieces"
-- cadence counts only reminders that reached someone, and a failed attempt can be retried.
ALTER TABLE reminder_log ADD COLUMN delivered INTEGER NOT NULL DEFAULT 0;
-- rows from before this column existed were sent as far as anyone can tell
UPDATE reminder_log SET delivered = 1;
