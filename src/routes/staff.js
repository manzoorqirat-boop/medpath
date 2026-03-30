const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { auditLog, getSetting } = require("./auth");

const router = require("express").Router();
router.use(authenticate);

function getIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || req.connection?.remoteAddress || "unknown";
}

function generateTempPassword() {
  return "Medpath@" + Math.random().toString(36).slice(2,7).toUpperCase();
}

/* GET /api/staff — list all staff */
router.get("/", authorize("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT s.*, u.name, u.email, u.phone, u.role, u.last_login_at, u.is_active,
             u.locked_at, u.failed_attempts, u.must_change_password,
             u.password_expires_at, u.created_at user_created_at,
             c.name created_by_name
      FROM staff s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN users c ON c.id = u.created_by
      WHERE s.is_active = true
      ORDER BY s.created_at DESC`);
    res.json({ staff: rows });
  } catch(err) { next(err); }
});

/* POST /api/staff — create staff user */
router.post("/", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { name, email, phone, role, designation, department, qualification, account_expires_at, username } = req.body;
    if (!name || !username || !designation) return res.status(400).json({ error: "Name, username and designation required" });

    // Check duplicate username
    const { rows: existingU } = await query("SELECT id FROM users WHERE username=$1", [username.toLowerCase()]);
    if (existingU.length) return res.status(400).json({ error: "Username already taken. Choose another." });
    // Check duplicate email (optional)
    if (email) {
      const { rows: existing } = await query("SELECT id FROM users WHERE email=$1", [email.trim().toLowerCase()]);
      if (existing.length) return res.status(400).json({ error: "Email already registered" });
    }

    // Generate temporary password
    const tempPwd  = generateTempPassword();
    const tempHash = await bcrypt.hash(tempPwd, 12);
    const tempExpHrs = parseInt(await getSetting("temp_pwd_expiry_hrs", "24"));
    const tempExpires = new Date(Date.now() + tempExpHrs * 3600000);

    const expiryDays = parseInt(await getSetting("pwd_expiry_days","90"));
    const pwdExpires = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400000) : null;

    const { rows:[user] } = await query(`
      INSERT INTO users(name,email,phone,username,password_hash,temp_password_hash,temp_password_expires,
        must_change_password,role,is_active,created_by,password_expires_at,account_expires_at)
      VALUES($1,$2,$3,$4,$5,$5,$6,true,$7,true,$8,$9,$10) RETURNING *`,
      [name, email?email.trim().toLowerCase():null, phone||null, username.toLowerCase(), tempHash, tempExpires, role, req.user.id, pwdExpires, account_expires_at||null]);

    const { rows:[{val}] } = await query("SELECT nextval('seq_staff_no') AS val");
    const staffNo = "STF-"+String(val).padStart(4,"0");
    const { rows:[staff] } = await query(
      "INSERT INTO staff(user_id,staff_no,designation,department,qualification) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [user.id, staffNo, designation, department||null, qualification||null]);

    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"USER_CREATED", category:"user_management",
      targetId:user.id, targetName:name, newValue:{ email, role, designation }, ip });

    res.status(201).json({
      staff: { ...staff, name, email, phone, role },
      tempPassword: tempPwd,
      message: `User created. Temporary password: ${tempPwd} (expires in ${tempExpHrs} hours)`
    });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/:id — update staff */
router.patch("/:id", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { name, email, phone, role, designation, department, qualification, account_expires_at } = req.body;
    const { rows:[old] } = await query(
      "SELECT u.*,s.designation FROM users u JOIN staff s ON s.user_id=u.id WHERE s.id=$1", [req.params.id]);
    if (!old) return res.status(404).json({ error: "Staff not found" });

    await query("UPDATE users SET name=$1,email=$2,phone=$3,role=$4,account_expires_at=$5 WHERE id=$6",
      [name||old.name, email||old.email, phone||old.phone, role||old.role, account_expires_at||null, old.id]);
    await query("UPDATE staff SET designation=$1,department=$2,qualification=$3 WHERE id=$4",
      [designation||old.designation, department||null, qualification||null, req.params.id]);

    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"USER_UPDATED", category:"user_management", targetId:old.id, targetName:old.name,
      oldValue:{ name:old.name, role:old.role }, newValue:{ name, role }, ip });

    res.json({ message: "Staff updated" });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/:id/unlock — unlock account */
router.patch("/:id/unlock", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { rows:[s] } = await query(
      "SELECT u.* FROM users u JOIN staff s ON s.user_id=u.id WHERE s.id=$1", [req.params.id]);
    if (!s) return res.status(404).json({ error: "Not found" });
    await query("UPDATE users SET locked_at=NULL, failed_attempts=0 WHERE id=$1", [s.id]);
    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"ACCOUNT_UNLOCKED", category:"user_management", targetId:s.id, targetName:s.name, ip });
    res.json({ message: "Account unlocked" });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/:id/reset-password — reset to new temp password */
router.patch("/:id/reset-password", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { rows:[s] } = await query(
      "SELECT u.* FROM users u JOIN staff s ON s.user_id=u.id WHERE s.id=$1", [req.params.id]);
    if (!s) return res.status(404).json({ error: "Not found" });
    const tempPwd  = generateTempPassword();
    const tempHash = await bcrypt.hash(tempPwd, 12);
    const tempExpHrs = parseInt(await getSetting("temp_pwd_expiry_hrs","24"));
    const tempExpires = new Date(Date.now() + tempExpHrs * 3600000);
    await query("UPDATE users SET temp_password_hash=$1,temp_password_expires=$2,must_change_password=true,locked_at=NULL,failed_attempts=0 WHERE id=$3",
      [tempHash, tempExpires, s.id]);
    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"PASSWORD_RESET", category:"user_management", targetId:s.id, targetName:s.name, ip });
    res.json({ message: "Password reset", tempPassword: tempPwd });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/:id/deactivate */
router.patch("/:id/deactivate", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { rows:[s] } = await query(
      "SELECT u.* FROM users u JOIN staff s ON s.user_id=u.id WHERE s.id=$1", [req.params.id]);
    if (!s) return res.status(404).json({ error: "Not found" });
    await query("UPDATE users SET is_active=false,deactivated_at=NOW(),deactivated_by=$1 WHERE id=$2",
      [req.user.id, s.id]);
    await query("UPDATE staff SET is_active=false WHERE id=$1", [req.params.id]);
    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"USER_DEACTIVATED", category:"user_management", targetId:s.id, targetName:s.name,
      notes:req.body.reason||null, ip });
    res.json({ message: "User deactivated" });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/:id/reactivate */
router.patch("/:id/reactivate", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { rows:[s] } = await query(
      "SELECT u.* FROM users u JOIN staff s ON s.user_id=u.id WHERE s.id=$1", [req.params.id]);
    if (!s) return res.status(404).json({ error: "Not found" });
    await query("UPDATE users SET is_active=true,deactivated_at=NULL,deactivated_by=NULL WHERE id=$1", [s.id]);
    await query("UPDATE staff SET is_active=true WHERE id=$1", [req.params.id]);
    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"USER_REACTIVATED", category:"user_management", targetId:s.id, targetName:s.name, ip });
    res.json({ message: "User reactivated" });
  } catch(err) { next(err); }
});

/* GET /api/staff/audit-log — audit trail */
router.get("/audit/log", authorize("admin"), async (req, res, next) => {
  try {
    const { category, action, from, to, limit=100 } = req.query;
    const conds = []; const params = [];
    let i = 1;
    if (category) { conds.push(`category=$${i++}`); params.push(category); }
    if (action)   { conds.push(`action=$${i++}`); params.push(action); }
    if (from)     { conds.push(`created_at>=$${i++}`); params.push(from); }
    if (to)       { conds.push(`created_at<=$${i++}`); params.push(to); }
    const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
    params.push(limit);
    const { rows } = await query(
      `SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT $${i}`, params);
    res.json({ logs: rows });
  } catch(err) { next(err); }
});

/* GET /api/staff/settings — system settings */
router.get("/settings/all", authorize("admin"), async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM system_settings ORDER BY key");
    res.json({ settings: rows });
  } catch(err) { next(err); }
});

/* PATCH /api/staff/settings — update system settings */
router.patch("/settings", authorize("admin"), async (req, res, next) => {
  const ip = getIP(req);
  try {
    const { settings } = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await query("UPDATE system_settings SET value=$1, updated_by=$2, updated_at=NOW() WHERE key=$3",
        [String(value), req.user.id, key]);
    }
    await auditLog({ userId:req.user.id, userName:req.user.name, userRole:req.user.role,
      action:"SETTINGS_UPDATED", category:"system", newValue:settings, ip });
    res.json({ message: "Settings updated" });
  } catch(err) { next(err); }
});

module.exports = router;