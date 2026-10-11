-- Whether account notices by email (for example "your free Pro is about to end") may be sent.
-- Anyone can switch them off from the link in the email; the default is on because they concern the person's own account.
ALTER TABLE users ADD COLUMN email_notices INTEGER NOT NULL DEFAULT 1;
