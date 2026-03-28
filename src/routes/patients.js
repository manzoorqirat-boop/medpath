const router = require("express").Router();
const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/", authorize("admin","doctor"), async (req, res, next) => {
  try {
    const { search="", page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const { rows } = await query(`
      SELECT p.id,p.patient_no,p.date_of_birth,p.gender,p.blood_group,p.address,p.created_at,
             u.name,u.phone,u.email
      FROM patients p JOIN users u ON u.id=p.user_id
      WHERE u.name ILIKE $1 OR p.patient_no ILIKE $1 OR u.phone ILIKE $1
      ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`,
      [`%${search}%`, limit, offset]);
    const { rows: [{ count }] } = await query(
      "SELECT COUNT(*) FROM patients p JOIN users u ON u.id=p.user_id WHERE u.name ILIKE $1 OR p.patient_no ILIKE $1",
      [`%${search}%`]);
    res.json({ patients: rows, total: Number(count) });
  } catch (err) { next(err); }
});

router.get("/me/profile", async (req, res, next) => {
  try {
    const { rows: [p] } = await query(
      "SELECT p.*,u.name,u.phone,u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE u.id=$1",
      [req.user.id]);
    res.json({ patient: p });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows: [p] } = await query(
      "SELECT p.*,u.name,u.phone,u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1",
      [req.params.id]);
    if (!p) return res.status(404).json({ error: "Patient not found" });
    res.json({ patient: p });
  } catch (err) { next(err); }
});

router.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const { name,phone,email,dob,gender,blood_group,address,emergency_contact,emergency_phone } = req.body;
    const { rows: [user] } = await query(
      "INSERT INTO users(name,phone,email,role) VALUES($1,$2,$3,'patient') RETURNING *",
      [name, phone, email||null]);
    const { rows: [{ val }] } = await query("SELECT nextval('seq_patient_no') AS val");
    const patNo = "PAT-" + String(val).padStart(4,"0");
    const { rows: [patient] } = await query(
      "INSERT INTO patients(user_id,patient_no,date_of_birth,gender,blood_group,address,emergency_contact,emergency_phone) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
      [user.id,patNo,dob||null,gender||null,blood_group||null,address||null,emergency_contact||null,emergency_phone||null]);
    res.status(201).json({ patient: { ...patient, name, phone, email } });
  } catch (err) { next(err); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const { date_of_birth,gender,blood_group,address,emergency_contact,emergency_phone } = req.body;
    const { rows: [p] } = await query(
      "UPDATE patients SET date_of_birth=$1,gender=$2,blood_group=$3,address=$4,emergency_contact=$5,emergency_phone=$6 WHERE id=$7 RETURNING *",
      [date_of_birth,gender,blood_group,address,emergency_contact,emergency_phone,req.params.id]);
    res.json({ patient: p });
  } catch (err) { next(err); }
});

module.exports = router;
