-- Proof that a person agreed to the Terms and Privacy Policy, and confirmed they are 16 or older:
-- which version, and when. Accounts created before this existed are asked once.
ALTER TABLE users ADD COLUMN terms_version TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at INTEGER;
