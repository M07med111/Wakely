ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_sub_type text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS charge text;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS session_type text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_type text;
