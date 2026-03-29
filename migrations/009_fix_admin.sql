-- Fix existing admin account for new auth system
UPDATE users 
SET is_active = true,
    failed_attempts = 0,
    locked_at = NULL,
    must_change_password = false
WHERE email = 'admin@medpath.com';

-- Fix all existing staff accounts
UPDATE users
SET is_active = true,
    failed_attempts = 0,
    locked_at = NULL,
    must_change_password = false
WHERE role IN ('admin','doctor','technician');