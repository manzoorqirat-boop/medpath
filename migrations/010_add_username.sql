-- Add username column for staff login
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Set username = email for existing staff users
UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE role IN ('admin','doctor','technician') AND email IS NOT NULL AND username IS NULL;

-- Set admin username explicitly
UPDATE users SET username = 'admin' WHERE email = 'admin@nidan.com';
UPDATE users SET username = 'suresh' WHERE email = 'suresh@nidan.com';
UPDATE users SET username = 'anita' WHERE email = 'anita@nidan.com';

-- Make sure all existing accounts are active and unlocked
UPDATE users SET 
  is_active = true,
  failed_attempts = 0,
  locked_at = NULL,
  must_change_password = false
WHERE role IN ('admin','doctor','technician');