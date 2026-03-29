-- ══════════════════════════════════════════════
-- 008: Enhanced User Management & Security
-- ══════════════════════════════════════════════

-- 1. Enhance users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS temp_password_hash      TEXT,
  ADD COLUMN IF NOT EXISTS temp_password_expires   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS must_change_password    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS failed_attempts         INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_changed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS password_expires_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_ip           TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at           TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active               BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS deactivated_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_by          UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS created_by              UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS account_expires_at      TIMESTAMPTZ;

-- 2. Password history table
CREATE TABLE IF NOT EXISTS password_history (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pwd_history_user ON password_history(user_id, created_at DESC);

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES users(id),
  user_name    TEXT,
  user_role    TEXT,
  action       TEXT NOT NULL,
  category     TEXT NOT NULL,
  target_type  TEXT,
  target_id    TEXT,
  target_name  TEXT,
  old_value    JSONB,
  new_value    JSONB,
  ip_address   TEXT,
  user_agent   TEXT,
  status       TEXT NOT NULL DEFAULT 'success',
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action  ON audit_log(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);

-- 4. System settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key          TEXT PRIMARY KEY,
  value        TEXT NOT NULL,
  label        TEXT,
  description  TEXT,
  updated_by   UUID REFERENCES users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default security settings
INSERT INTO system_settings(key, value, label, description) VALUES
  ('pwd_min_length',     '8',  'Minimum Password Length',           'Minimum characters required'),
  ('pwd_require_upper',  'true','Require Uppercase',                'Must contain A-Z'),
  ('pwd_require_number', 'true','Require Number',                   'Must contain 0-9'),
  ('pwd_require_special','true','Require Special Character',        'Must contain !@#$%'),
  ('pwd_expiry_days',    '90', 'Password Expiry (days)',            '0 = never expires'),
  ('pwd_history_count',  '5',  'Password History Count',           'Cannot reuse last N passwords'),
  ('max_failed_attempts','3',  'Max Failed Login Attempts',         'Before account lockout'),
  ('session_timeout',    '30', 'Session Timeout (minutes)',         'Idle session auto-logout'),
  ('temp_pwd_expiry_hrs','24', 'Temporary Password Expiry (hours)', 'First login temp password validity'),
  ('audit_trail',        'true','Audit Trail',                     'Enable full audit logging'),
  ('lab_name',           'MedPath Laboratory', 'Laboratory Name',  'Displayed on reports'),
  ('lab_accreditation',  'NABL', 'Accreditation',                 'Lab accreditation type')
ON CONFLICT (key) DO NOTHING;

-- 5. User sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  ip_address   TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON user_sessions(user_id);