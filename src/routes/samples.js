const router = require("express").Router();
const { query, transaction } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { notifyReportReady } = require("../utils/notify");

router.use(authenticate);

const STATUS_ORDER = ["Pending","Collected","Processing","Reported","Dispatched"];

router.get("/", async (req, res, next) => {
  try {
    const { status, patientId, page=1, limit=25, search="" } = req.query;
    const offset = (page-1)*limit;
    const conditions = []; const params = []; let i=1;

    if (req.user.role === "patient") {
      const { rows: [pat] } = await query("SELECT id FROM patients WHERE user_id=$1", [req.user.id]);
      if (!pat) return res.json({ samples: [], total: 0 });
      conditions.push(`s.patient_id=$${i++}`); params.push(pat.id);
    } else if (patientId) {
      conditions.push(`s.patient_id=$${i++}`); params.push(patientId);
    }
    if (status) { conditions.push(`s.status=$${i++}`); params.push(status); }
    if (search) { conditions.push(`(s.sample_no ILIKE $${i} OR u.name ILIKE $${i})`); params.push(`%${search}%`); i++; }

    const where = conditions.length ? "WHERE "+conditions.join(" AND ") : "";

    const { rows } = await query(`
      SELECT s.*,u.name patient_name,u.phone patient_phone,p.patient_no,
             ARRAY_AGG(DISTINCT tc.code) AS test_codes,
             ARRAY_AGG(DISTINCT tc.name) AS test_names
      FROM samples s
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN sample_tests st ON st.sample_id=s.id
      LEFT JOIN test_catalogue tc ON tc.id=st.test_id
      ${where}
      GROUP BY s.id,u.name,u.phone,p.patient_no
      ORDER BY s.created_at DESC
      LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]);

    const { rows: [{ count }] } = await query(
      `SELECT COUNT(DISTINCT s.id) FROM samples s
       JOIN patients p ON p.id=s.patient_id
       JOIN users u ON u.id=p.user_id ${where}`, params);

    res.json({ samples: rows, total: Number(count) });
  } catch (err) { next(err); }
});

router.get("/:id", async (req, res, next) => {
  try {
    const { rows: [sample] } = await query(`
      SELECT s.*,u.name patient_name,u.phone,u.email,p.patient_no,
             ARRAY_AGG(DISTINCT tc.code) test_codes,
             ARRAY_AGG(DISTINCT tc.name) test_names
      FROM samples s
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN sample_tests st ON st.sample_id=s.id
      LEFT JOIN test_catalogue tc ON tc.id=st.test_id
      WHERE s.id=$1 GROUP BY s.id,u.name,u.phone,u.email,p.patient_no`,
      [req.params.id]);
    if (!sample) return res.status(404).json({ error: "Sample not found" });

    const { rows: log } = await query(`
      SELECT ssl.*,u.name changed_by_name FROM sample_status_log ssl
      LEFT JOIN users u ON u.id=ssl.changed_by
      WHERE ssl.sample_id=$1 ORDER BY ssl.changed_at ASC`, [req.params.id]);

    res.json({ sample, statusLog: log });
  } catch (err) { next(err); }
});

router.post("/", authorize("admin","patient"), async (req, res, next) => {
  try {
    const { patient_id, test_ids, priority="Normal", collection_type="Walk-in",
            home_address, home_slot, referred_by, family_member_id } = req.body;
    if (!patient_id || !test_ids?.length)
      return res.status(400).json({ error: "patient_id and test_ids required" });

    await transaction(async (client) => {
      const { rows: tests } = await client.query(
        "SELECT * FROM test_catalogue WHERE id=ANY($1::uuid[]) AND is_active=true", [test_ids]);
      if (tests.length !== test_ids.length)
