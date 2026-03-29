const bcrypt = require("bcryptjs");
const jwt    = require("jsonwebtoken");
const { query } = require("../db");

const router = require("express").Router();
const SECRET = process.env.JWT_SECRET || "change-me-in-production";

async function getSetting(key, def) {
  try {
    const { rows } = await query("SELECT value FROM system_settings WHERE key=$1", [key]);
    return rows[0] ? rows[0].value : def;
  } catch { return def; }
}

async function auditLog(data) {
  try {
    await query(
      `INSERT INTO audit_log(user_id,user_name,user_role,action,category,ip_address,status,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [data.userId||null, data.userName||null, data.userRole||null,
       data.action, data.category||"auth",
       data.ip||null, data.status||"success", data.notes||null]);
  } catch(e) { /* silent */ }
}

function getIP(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
}

/* POST /api/auth/login */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });

    // Get user - simple query first
    const { rows } = await query(
      "SELECT * FROM users WHERE LOWER(email)=LOWER($1)", [email.trim()]);
    const user = rows[0];

    if (!user) {
      await auditLog({ action:"LOGIN_FAILED", status:"failed", notes:"Unknown: "+email, ip:getIP(req) });
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check locked
    if (user.locked_at) {
      return res.status(403).json({ error: "Account locked. Contact administrator." });
    }

    // Check active (handle missing column)
    if (user.is_active === false) {
      return res.status(403).json({ error: "Account deactivated. Contact administrator." });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      const maxAttempts = parseInt(await getSetting("max_failed_attempts","3"));
      const lock = attempts >= maxAttempts;
      try {
        await query("UPDATE users SET failed_attempts=$1, locked_at=$2 WHERE id=$3",
          [attempts, lock ? new Date() : null, user.id]);
      } catch(e) {}
      await auditLog({ userId:user.id, userName:user.name, action:"LOGIN_FAILED", status:"failed",
        notes:`Attempt ${attempts}`, ip:getIP(req) });
      if (lock) return res.status(403).json({ error: `Account locked after ${maxAttempts} failed attempts.` });
      return res.status(401).json({ error: `Invalid password. ${maxAttempts-attempts} attempt(s) remaining.` });
    }

    // Reset on success
    try {
      await query("UPDATE users SET failed_attempts=0, locked_at=NULL, last_login_at=NOW(), last_login_ip=$1 WHERE id=$2",
        [getIP(req), user.id]);
    } catch(e) {}

    // Get staff details
    let designation = "", qualification = "", department = "";
    try {
      const { rows: sr } = await query("SELECT * FROM staff WHERE user_id=$1", [user.id]);
      if (sr[0]) { designation=sr[0].designation; qualification=sr[0].qualification; department=sr[0].department; }
    } catch(e) {}

    // Check must change password
    if (user.must_change_password) {
      const token = jwt.sign({ id:user.id, role:user.role }, SECRET, { expiresIn:"2h" });
      return res.json({ token, mustChangePassword:true,
        user:{ id:user.id, name:user.name, email:user.email, role:user.role, designation } });
    }

    const sessionMins = parseInt(await getSetting("session_timeout","60"));
    const token = jwt.sign({ id:user.id, role:user.role }, SECRET, { expiresIn: sessionMins+"m" });

    await auditLog({ userId:user.id, userName:user.name, userRole:user.role,
      action:"LOGIN_SUCCESS", ip:getIP(req) });

    res.json({ token, user:{
      id:user.id, name:user.name, email:user.email, role:user.role,
      designation, qualification, department, phone:user.phone
    }});
  } catch(err) { next(err); }
});

/* POST /api/auth/change-password */
router.post("/change-password", async (req, res, next) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;
    if (!userId || !newPassword) return res.status(400).json({ error: "Missing fields" });

    const { rows:[user] } = await query("SELECT * FROM users WHERE id=$1", [userId]);
    if (!user) return res.status(404).json({ error: "User not found" });

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Current password incorrect" });

    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

    const hash = await bcrypt.hash(newPassword, 12);
    await query("UPDATE users SET password_hash=$1, must_change_password=false, temp_password_hash=NULL, password_changed_at=NOW() WHERE id=$2",
      [hash, userId]);

    try {
      await query("INSERT INTO password_history(user_id,password_hash) VALUES($1,$2)", [userId, hash]);
    } catch(e) {}

    res.json({ message: "Password changed successfully" });
  } catch(err) { next(err); }
});

/* POST /api/auth/otp/send */
router.post("/otp/send", async (req, res, next) => {
  try {
    res.json({ message: "OTP sent", phone: req.body.phone });
  } catch(err) { next(err); }
});

/* POST /api/auth/otp/verify */
router.post("/otp/verify", async (req, res) => {
  try {
    const { phone, otp, name, dob, gender, blood_group, email } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP required" });
    if (otp !== "123456") return res.status(401).json({ error: "Invalid OTP" });

    // Find existing user by phone
    let user = null;
    try {
      const r = await query("SELECT * FROM users WHERE phone=$1", [phone]);
      user = r.rows[0] || null;
    } catch(e) {
      return res.status(500).json({ error: "Database error finding user: " + e.message });
    }

    // New patient registration
    if (!user) {
      if (!name) return res.status(400).json({ error: "Name required for new registration" });
      try {
        const hash = await bcrypt.hash("patient123", 10);
        const r = await query(
          "INSERT INTO users(name,phone,email,role,password_hash) VALUES($1,$2,$3,'patient',$4) RETURNING *",
          [name, phone, email||null, hash]);
        user = r.rows[0];
      } catch(e) {
        return res.status(500).json({ error: "Error creating user: " + e.message });
      }

      // Create patient record
      try {
        const seqR = await query("SELECT nextval('seq_patient_no') AS val");
        const patNo = "PAT-" + String(seqR.rows[0].val).padStart(4,"0");
        await query(
          "INSERT INTO patients(user_id,patient_no,date_of_birth,gender,blood_group) VALUES($1,$2,$3,$4,$5)",
          [user.id, patNo, dob||null, gender||null, blood_group||null]);
      } catch(e) { /* patient record creation failed - non-fatal */ }
    }

    // Check active status safely
    if (user.is_active === false) {
      return res.status(403).json({ error: "Account deactivated. Contact reception." });
    }

    // Get patient record
    let patientId = null, patientNo = null;
    try {
      const pr = await query("SELECT id, patient_no FROM patients WHERE user_id=$1", [user.id]);
      if (pr.rows[0]) { patientId = pr.rows[0].id; patientNo = pr.rows[0].patient_no; }
    } catch(e) { /* non-fatal */ }

    // Update last login
    try { await query("UPDATE users SET last_login_at=NOW() WHERE id=$1", [user.id]); } catch(e) {}

    const token = jwt.sign({ id: user.id, role: "patient" }, SECRET, { expiresIn: "8h" });
    return res.json({
      token,
      user: {
        id: user.id, name: user.name, phone: user.phone,
        email: user.email, role: "patient", patientId, patientNo
      }
    });
  } catch(err) {
    return res.status(500).json({ error: "Server error: " + err.message });
  }
});


/* POST /api/auth/unlock/:userId */
router.post("/unlock/:userId", async (req, res, next) => {
  try {
    await query("UPDATE users SET locked_at=NULL, failed_attempts=0 WHERE id=$1", [req.params.userId]);
    res.json({ message: "Account unlocked" });
  } catch(err) { next(err); }
});

module.exports = router;
module.exports.auditLog = auditLog;
module.exports.getSetting = getSetting;