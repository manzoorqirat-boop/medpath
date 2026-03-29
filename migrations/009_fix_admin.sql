-- Ensure is_active column exists and fix existing accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivated_by UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_expires_at TIMESTAMPTZ;

-- Fix all existing users
UPDATE users SET 
  is_active = true,
  failed_attempts = 0,
  locked_at = NULL,
  must_change_password = false
WHERE is_active IS NULL OR is_active = false;

-- Create system_settings if not exists
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT,
  description TEXT,
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_settings(key,value) VALUES
  ('pwd_min_length','8'),
  ('pwd_require_upper','true'),
  ('pwd_require_number','true'),
  ('pwd_require_special','true'),
  ('pwd_expiry_days','0'),
  ('pwd_history_count','5'),
  ('max_failed_attempts','3'),
  ('session_timeout','30'),
  ('temp_pwd_expiry_hrs','24'),
  ('audit_trail','true'),
  ('lab_name','MedPath Laboratory'),
  ('lab_accreditation','NABL')
ON CONFLICT (key) DO NOTHING;

-- Create audit_log if not exists
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  category TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  target_name TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'success',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create password_history if not exists
CREATE TABLE IF NOT EXISTS password_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);