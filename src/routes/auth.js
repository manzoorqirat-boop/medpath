const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const crypto   = require("crypto");
const { query } = require("../db");

const router = require("express").Router();

// ── Helpers ──────────────────────────────────────────────
async function getSetting(key, defaultVal) {
  try {
    const { rows } = await query("SELECT value FROM system_settings WHERE key=$1", [key]);
    return rows[0] ? rows[0].value : defaultVal;
  } catch { return defaultVal; }
}

async function auditLog({ userId, userName, userRole, action, category, targetType, targetId, targetName, oldValue, newValue, ip, status="success", notes }) {
  try {
    await query(`INSERT INTO audit_log(user_id,user_name,user_role,action,category,target_type,target_id,target_name,old_value,new_value,ip_address,status,notes)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [userId||null, userName||null, userRole||null, action, category,
       targetType||null, targetId||null, targetName||null,
       oldValue?JSON.stringify(oldValue):null,
       newValue?JSON.stringify(newValue):null,
       ip||null, status, notes||null]);
  } catch(e) { console.error("Audit log error:", e.message); }
}

function getIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.connection?.remoteAddress || "unknown";
}

function validatePassword(pwd, settings) {
  const minLen  = parseInt(settings.pwd_min_length) || 8;
  const needUp  = settings.pwd_require_upper  !== "false";
  const needNum = settings.pwd_require_number !== "false";
  const needSpc = settings.pwd_require_special !== "false";
  const errors  = [];
  if (pwd.length < minLen)                       errors.push(`At least ${minLen} characters`);
  if (needUp  && !/[A-Z]/.test(pwd))             errors.push("At least one uppercase letter");
  if (needNum && !/[0-9]/.test(pwd))             errors.push("At least one number");
  if (needSpc && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) errors.push("At least one special character");
  return errors;
}

async function checkPasswordHistory(userId, newPwdPlain, historyCount) {
  const count = parseInt(historyCount) || 5;
  const { rows } = await query(
    "SELECT password_hash FROM password_history WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2",
    [userId, count]);
  for (const row of rows) {
    if (await bcrypt.compare(newPwdPlain, row.password_hash)) return false;
  }
  return true;
}

async function savePasswordHistory(userId, hashedPwd) {
  await query("INSERT INTO password_history(user_id,password_hash) VALUES($1,$2)", [userId, hashedPwd]);
}

// ── POST /api/auth/login — Staff login ──────────────────
router.post("/login", async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    const { rows: [user] } = await query(
      "SELECT u.*,s.designation,s.qualification,s.department FROM users u LEFT JOIN staff s ON s.user_id=u.id WHERE u.email=$1",
      [email.trim().toLowerCase()]);

    if (!user) {
      await auditLog({ action:"LOGIN_FAILED", category:"auth", status:"failed", notes:`Unknown email: ${email}`, ip });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if account is active
    if (!user.is_active) {
      await auditLog({ userId:user.id, userName:user.name, action:"LOGIN_BLOCKED", category:"auth", status:"failed", notes:"Account deactivated", ip });
      return res.status(403).json({ error: "Account has been deactivated. Contact administrator." });
    }

    // Check if account is locked
    if (user.locked_at) {
      await auditLog({ userId:user.id, userName:user.name, action:"LOGIN_BLOCKED", category:"auth", status:"failed", notes:"Account locked", ip });
      return res.status(403).json({ error: "Account is locked due to multiple failed attempts. Contact administrator to unlock." });
    }

    // Verify password
    const maxAttempts = parseInt(await getSetting("max_failed_attempts", "3"));
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      const shouldLock  = newAttempts >= maxAttempts;
      await query(
        "UPDATE users SET failed_attempts=$1, locked_at=$2 WHERE id=$3",
        [newAttempts, shouldLock ? new Date() : null, user.id]);
      await auditLog({ userId:user.id, userName:user.name, action:"LOGIN_FAILED", category:"auth", status:"failed",
        notes:`Attempt ${newAttempts}/${maxAttempts}${shouldLock?" — ACCOUNT LOCKED":""}`, ip });
      if (shouldLock) return res.status(403).json({ error: `Account locked after ${maxAttempts} failed attempts. Contact administrator.` });
      return res.status(401).json({ error: `Invalid password. ${maxAttempts - newAttempts} attempt(s) remaining.` });
    }

    // Reset failed attempts on success
    const sessionMins = parseInt(await getSetting("session_timeout", "30"));
    const expiresAt   = new Date(Date.now() + sessionMins * 60 * 1000);

    await query(
      "UPDATE users SET failed_attempts=0, locked_at=NULL, last_login_at=NOW(), last_login_ip=$1 WHERE id=$2",
      [ip, user.id]);

    // Check temp password
    if (user.must_change_password || user.temp_password_hash) {
      // Check if temp password used
      let tempValid = false;
      if (user.temp_password_hash) {
        tempValid = await bcrypt.compare(password, user.temp_password_hash);
        if (tempValid && user.temp_password_expires && new Date() > new Date(user.temp_password_expires)) {
          return res.status(403).json({ error: "Temporary password has expired. Contact administrator for a new one." });
        }
      }
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "medpath_secret", { expiresIn: "2h" });
      await auditLog({ userId:user.id, userName:user.name, userRole:user.role, action:"LOGIN_TEMP", category:"auth", ip });
      return res.json({
        token, mustChangePassword: true,
        user: { id:user.id, name:user.name, email:user.email, role:user.role, designation:user.designation }
      });
    }

    // Check password expiry
    if (user.password_expires_at && new Date() > new Date(user.password_expires_at)) {
      const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "medpath_secret", { expiresIn: "2h" });
      await auditLog({ userId:user.id, userName:user.name, userRole:user.role, action:"LOGIN_PWD_EXPIRED", category:"auth", ip });
      return res.json({
        token, mustChangePassword: true, reason: "expired",
        user: { id:user.id, name:user.name, email:user.email, role:user.role, designation:user.designation }
      });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || "medpath_secret", { expiresIn: sessionMins+"m" });

    await auditLog({ userId:user.id, userName:user.name, userRole:user.role, action:"LOGIN_SUCCESS", category:"auth", ip });

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        designation: user.designation, qualification: user.qualification, department: user.department,
        phone: user.phone, mustChangePassword: false
      }
    });
  } catch(err) { next(err); }
});

// ── POST /api/auth/change-password ──────────────────────
router.post("/change-password", async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ error: "Missing required fields" });

    const { rows: [user] } = await query("SELECT * FROM users WHERE id=$1", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Verify current password (or temp password)
    let currentValid = false;
    if (user.password_hash) currentValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!currentValid && user.temp_password_hash) currentValid = await bcrypt.compare(currentPassword, user.temp_password_hash);
    if (!currentValid) return res.status(401).json({ error: "Current password is incorrect" });

    // Validate new password strength
    const settings = {};
    const settingKeys = ["pwd_min_length","pwd_require_upper","pwd_require_number","pwd_require_special","pwd_expiry_days","pwd_history_count"];
    for (const k of settingKeys) settings[k] = await getSetting(k, "");
    const errors = validatePassword(newPassword, settings);
    if (errors.length) return res.status(400).json({ error: "Password requirements not met", requirements: errors });

    // Check password history
    const historyOk = await checkPasswordHistory(user.id, newPassword, settings.pwd_history_count);
    if (!historyOk) return res.status(400).json({ error: `Cannot reuse last ${settings.pwd_history_count} passwords` });

    // Hash and save
    const hash = await bcrypt.hash(newPassword, 12);
    const expiryDays = parseInt(settings.pwd_expiry_days) || 0;
    const expiresAt  = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000) : null;

    await query(
      "UPDATE users SET password_hash=$1, temp_password_hash=NULL, must_change_password=false, password_changed_at=NOW(), password_expires_at=$2 WHERE id=$3",
      [hash, expiresAt, user.id]);

    await savePasswordHistory(user.id, hash);
    await auditLog({ userId:user.id, userName:user.name, userRole:user.role, action:"PASSWORD_CHANGED", category:"auth", ip });

    res.json({ message: "Password changed successfully" });
  } catch(err) { next(err); }
});

// ── POST /api/auth/otp/send ──────────────────────────────
router.post("/otp/send", async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number required" });
    const otp = "123456"; // TODO: integrate SMS
    await auditLog({ action:"OTP_SENT", category:"auth", targetName:phone, ip });
    res.json({ message: "OTP sent", phone });
  } catch(err) { next(err); }
});

// ── POST /api/auth/otp/verify ────────────────────────────
router.post("/otp/verify", async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { phone, otp, name, dob, gender, blood_group, email } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });
    if (otp !== "123456") return res.status(401).json({ error: "Invalid OTP" });

    let { rows: [user] } = await query("SELECT * FROM users WHERE phone=$1", [phone]);

    if (!user) {
      if (!name) return res.status(400).json({ error: "Name required for new registration" });
      // Auto-register new patient
      const { rows: [newUser] } = await query(
        "INSERT INTO users(name,phone,email,role,is_active) VALUES($1,$2,$3,'patient',true) RETURNING *",
        [name, phone, email||null]);
      // Create patient record
      const { rows:[{val}] } = await query("SELECT nextval('seq_patient_no') AS val");
      const patNo = "PAT-"+String(val).padStart(4,"0");
      await query(
        "INSERT INTO patients(user_id,patient_no,date_of_birth,gender,blood_group) VALUES($1,$2,$3,$4,$5)",
        [newUser.id, patNo, dob||null, gender||null, blood_group||null]);
      user = newUser;
      await auditLog({ userId:user.id, userName:user.name, action:"PATIENT_SELF_REGISTERED", category:"user_management", ip });
    }

    if (!user.is_active) return res.status(403).json({ error: "Account deactivated. Contact reception." });

    const { rows:[pat] } = await query("SELECT * FROM patients WHERE user_id=$1", [user.id]);
    const sessionMins = parseInt(await getSetting("session_timeout","30"));
    const token = jwt.sign({ id:user.id, role:"patient" }, process.env.JWT_SECRET||"medpath_secret", { expiresIn:sessionMins+"m" });

    await query("UPDATE users SET last_login_at=NOW(), last_login_ip=$1 WHERE id=$2", [ip, user.id]);
    await auditLog({ userId:user.id, userName:user.name, userRole:"patient", action:"LOGIN_SUCCESS", category:"auth", ip });

    res.json({
      token,
      user: {
        id:user.id, name:user.name, phone:user.phone, email:user.email, role:"patient",
        patientId: pat?.id, patientNo: pat?.patient_no
      }
    });
  } catch(err) { next(err); }
});

// ── POST /api/auth/unlock — Admin unlocks user ───────────
router.post("/unlock/:userId", async (req, res, next) => {
  const ip = getIP(req);
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized" });
    const token = authHeader.replace("Bearer ","");
    const decoded = jwt.verify(token, process.env.JWT_SECRET||"medpath_secret");
    if (decoded.role !== "admin") return res.status(403).json({ error: "Admin only" });
    const { rows:[admin] } = await query("SELECT * FROM users WHERE id=$1", [decoded.id]);
    const { rows:[target] } = await query("SELECT * FROM users WHERE id=$1", [req.params.userId]);
    if (!target) return res.status(404).json({ error: "User not found" });
    await query("UPDATE users SET locked_at=NULL, failed_attempts=0 WHERE id=$1", [req.params.userId]);
    await auditLog({ userId:decoded.id, userName:admin?.name, userRole:"admin", action:"ACCOUNT_UNLOCKED",
      category:"user_management", targetId:target.id, targetName:target.name, ip });
    res.json({ message: "Account unlocked successfully" });
  } catch(err) { next(err); }
});

module.exports = router;
module.exports.auditLog = auditLog;
module.exports.getSetting = getSetting;