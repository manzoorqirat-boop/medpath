const router   = require("express").Router();
const bcrypt   = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { query } = require("../db");
const { signToken, authenticate } = require("../middleware/auth");
const { notifyOTP } = require("../utils/notify");

router.post("/otp/send",
  body("phone").notEmpty(),
  async (req, res, next) => {
    try {
      const { phone } = req.body;
      const otp = process.env.NODE_ENV === "production"
        ? String(Math.floor(100000 + Math.random() * 900000))
        : "123456";
      const expires = new Date(Date.now() + 10 * 60000);
      await query("INSERT INTO otp_codes(phone,code,expires_at) VALUES($1,$2,$3)", [phone, otp, expires]);
      await notifyOTP({ phone, otp });
      res.json({ message: "OTP sent", ...(process.env.NODE_ENV !== "production" && { otp }) });
    } catch (err) { next(err); }
  }
);

router.post("/otp/verify",
  body("phone").notEmpty(),
  body("otp").isLength({ min: 6, max: 6 }),
  async (req, res, next) => {
    try {
      const { phone, otp, name, dob, gender } = req.body;
      const { rows: [otpRow] } = await query(
        "SELECT * FROM otp_codes WHERE phone=$1 AND code=$2 AND used=false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
        [phone, otp]
      );
      if (!otpRow) return res.status(400).json({ error: "Invalid or expired OTP" });
      await query("UPDATE otp_codes SET used=true WHERE id=$1", [otpRow.id]);

      let { rows: [user] } = await query("SELECT * FROM users WHERE phone=$1", [phone]);
      if (!user) {
        if (!name) return res.status(400).json({ error: "Name required for new registration" });
        const { rows: [newUser] } = await query(
          "INSERT INTO users(name,phone,role) VALUES($1,$2,'patient') RETURNING *", [name, phone]);
        user = newUser;
        const { rows: [{ val }] } = await query("SELECT nextval('seq_patient_no') AS val");
        const patNo = "PAT-" + String(val).padStart(4, "0");
        await query(
          "INSERT INTO patients(user_id,patient_no,date_of_birth,gender) VALUES($1,$2,$3,$4)",
          [user.id, patNo, dob || null, gender || null]);
      }
      await query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);
      const { rows: [patient] } = await query("SELECT * FROM patients WHERE user_id=$1", [user.id]);
      const token = signToken({ id: user.id, role: "patient", patientId: patient?.id });
      res.json({ token, user: { id: user.id, name: user.name, phone, role: "patient", patientId: patient?.id, patientNo: patient?.patient_no } });
    } catch (err) { next(err); }
  }
);

router.post("/login",
  body("email").isEmail(),
  body("password").notEmpty(),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const { rows: [user] } = await query("SELECT * FROM users WHERE email=$1 AND is_active=true", [email]);
      if (!user || !user.password_hash) return res.status(401).json({ error: "Invalid credentials" });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: "Invalid credentials" });
      await query("UPDATE users SET last_login=NOW() WHERE id=$1", [user.id]);
      const { rows: [staff] } = await query("SELECT * FROM staff WHERE user_id=$1", [user.id]);
      const token = signToken({ id: user.id, role: user.role, staffId: staff?.id });
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, staffNo: staff?.staff_no } });
    } catch (err) { next(err); }
  }
);

router.get("/me", authenticate, async (req, res, next) => {
  try {
    const { rows: [user] } = await query(
      "SELECT id,name,email,phone,role,last_login FROM users WHERE id=$1", [req.user.id]);
    res.json({ user });
  } catch (err) { next(err); }
});

module.exports = router;
