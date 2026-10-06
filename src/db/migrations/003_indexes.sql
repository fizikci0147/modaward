-- Closet listings count wears per garment; without this index each garment scans the whole wear log.
CREATE INDEX IF NOT EXISTS idx_wear_garment ON wear_log(garment_id);
