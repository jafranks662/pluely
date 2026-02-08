ALTER TABLE conversations ADD COLUMN mode TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE conversations ADD COLUMN live_summary_json TEXT;
ALTER TABLE conversations ADD COLUMN live_summary_updated_at INTEGER;
