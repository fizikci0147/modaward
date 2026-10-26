-- Who may use Track Weight (/trackweight) when access is members-only (the default). Keyed by account, not by
-- email address: ModaWard does not verify emails, so an address on a list could be claimed by whoever registers
-- with it first. Deleting the account removes the membership with it.
CREATE TABLE trackweight_members (
  user_id  TEXT    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  added_at INTEGER NOT NULL,
  note     TEXT    NOT NULL DEFAULT ''
);
