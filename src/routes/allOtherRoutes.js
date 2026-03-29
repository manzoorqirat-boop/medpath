const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { sendEmail, sendSMS, notifyHomeCollection } = require("../utils/notify");
const bcrypt = require("bcryptjs");

const router1 = require("express").Router();

router1.get("/", async (req, res, next) => {
  try {
    const { cat, search="" } = req.query;
    const { rows } = await query(
      `SELECT tc.*, COALESCE(json_agg(tp ORDER BY tp.display_order) FILTER(WHERE tp.id IS NOT NULL),'[]') parameters
       FROM test_catalogue tc
       LEFT JOIN test_parameters tp ON tp.test_id=tc.id
       WHERE tc.is_active=true
       AND ($1::text IS NULL OR tc.category=$1)
       AND (tc.name ILIKE $2 OR tc.code ILIKE $2 OR tc.category ILIKE $2)
       GROUP BY tc.id ORDER BY tc.category,tc.name`,
      [cat||null, "%"+search+"%"]);
    res.json({ tests: rows });
  } catch (err) { next(err); }
});

router1.get("/categories", async (_req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT DISTINCT category FROM test_catalogue WHERE is_active=true ORDER BY category");
    res.json({ categories: rows.map(r=>r.category) });
  } catch (err) { next(err); }
});

router1.get("/:id", async (req, res, next) => {
  try {
    const { rows: [test] } = await query(
      "SELECT * FROM test_catalogue WHERE id=$1 OR code=$1", [req.params.id]);
    if (!test) return res.status(404).json({ error: "Test not found" });
    const { rows: params } = await query(
      "SELECT * FROM test_parameters WHERE test_id=$1 ORDER BY display_order", [test.id]);
    res.json({ test: { ...test, parameters: params } });
  } catch (err) { next(err); }
});

router1.post("/", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { code,name,category,price,turnaround_hrs,fasting_required,description } = req.body;
    const { rows: [test] } = await query(
      "INSERT INTO test_catalogue(code,name,category,price,turnaround_hrs,fasting_required,description) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *",
      [code,name,category,price,turnaround_hrs||6,fasting_required||false,description||null]);
    res.status(201).json({ test });
  } catch (err) { next(err); }
});

router1.put("/:id", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { name,category,price,turnaround_hrs,fasting_required,description,is_active } = req.body;
    const { rows: [test] } = await query(
      "UPDATE test_catalogue SET name=$1,category=$2,price=$3,turnaround_hrs=$4,fasting_required=$5,description=$6,is_active=$7 WHERE id=$8 RETURNING *",
      [name,category,price,turnaround_hrs,fasting_required,description,is_active,req.params.id]);
    res.json({ test });
  } catch (err) { next(err); }
});

/* ── Test Parameters CRUD ── */

// GET /api/tests/:id/parameters
router1.get("/:id/parameters", async (req, res, next) => {
  try {
    const { rows: [test] } = await query(
      "SELECT id FROM test_catalogue WHERE id=$1 OR code=$1",
      [req.params.id]);
    if (!test) return res.status(404).json({ error: "Test not found" });
    const { rows } = await query(
      "SELECT * FROM test_parameters WHERE test_id=$1 ORDER BY display_order",
      [test.id]);
    res.json({ parameters: rows });
  } catch (err) { next(err); }
});

// POST /api/tests/:id/parameters — add new parameter
router1.post("/:id/parameters", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const {
      param_name, unit,
      range_male_min, range_male_max,
      range_female_min, range_female_max,
      range_text, display_order
    } = req.body;
    if (!param_name) return res.status(400).json({ error: "param_name is required" });
    const { rows: [p] } = await query(`
      INSERT INTO test_parameters
        (test_id,param_name,unit,range_male_min,range_male_max,range_female_min,range_female_max,range_text,display_order)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.params.id, param_name, unit||null,
       range_male_min||null, range_male_max||null,
       range_female_min||null, range_female_max||null,
       range_text||null, display_order||0]);
    res.status(201).json({ parameter: p });
  } catch (err) { next(err); }
});

// PUT /api/tests/parameters/:paramId — update parameter
router1.put("/parameters/:paramId", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const {
      param_name, unit,
      range_male_min, range_male_max,
      range_female_min, range_female_max,
      range_text, display_order
    } = req.body;
    const { rows: [p] } = await query(`
      UPDATE test_parameters
      SET param_name=$1, unit=$2,
          range_male_min=$3, range_male_max=$4,
          range_female_min=$5, range_female_max=$6,
          range_text=$7, display_order=$8
      WHERE id=$9 RETURNING *`,
      [param_name, unit||null,
       range_male_min||null, range_male_max||null,
       range_female_min||null, range_female_max||null,
       range_text||null, display_order||0,
       req.params.paramId]);
    if (!p) return res.status(404).json({ error: "Parameter not found" });
    res.json({ parameter: p });
  } catch (err) { next(err); }
});

// DELETE /api/tests/parameters/:paramId — delete parameter
router1.delete("/parameters/:paramId", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    await query("DELETE FROM test_parameters WHERE id=$1", [req.params.paramId]);
    res.json({ message: "Parameter deleted" });
  } catch (err) { next(err); }
});

const router2 = require("express").Router();
router2.use(authenticate);

router2.get("/", authorize("admin"), async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT s.*,u.name,u.email,u.phone,u.role,u.last_login FROM staff s JOIN users u ON u.id=s.user_id WHERE s.is_active=true ORDER BY s.created_at");
    res.json({ staff: rows });
  } catch (err) { next(err); }
});

router2.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const { name,email,phone,role,designation,department,qualification,joined_date,password="medpath@123" } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await query(
      "INSERT INTO users(name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [name,email,phone,hash,role]);
    const { rows: [{ val }] } = await query("SELECT nextval('seq_staff_no') AS val");
    const staffNo = "STF-"+String(val).padStart(4,"0");
    const { rows: [staff] } = await query(
      "INSERT INTO staff(user_id,staff_no,designation,department,qualification,joined_date) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [user.id,staffNo,designation,department||null,qualification||null,joined_date||null]);
    res.status(201).json({ staff: { ...staff, name, email, phone } });
  } catch (err) { next(err); }
});

router2.patch("/:id/deactivate", authorize("admin"), async (req, res, next) => {
  try {
    await query("UPDATE staff SET is_active=false WHERE id=$1", [req.params.id]);
    res.json({ message: "Staff deactivated" });
  } catch (err) { next(err); }
});

const router3 = require("express").Router();
router3.use(authenticate);

router3.get("/", async (req, res, next) => {
  try {
    const { page=1, limit=30 } = req.query;
    const offset = (page-1)*limit;
    const { rows } = await query(
      "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
      [req.user.id, limit, offset]);
    const { rows: [{ count }] } = await query(
      "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false", [req.user.id]);
    res.json({ notifications: rows, unread: Number(count) });
  } catch (err) { next(err); }
});

router3.patch("/read-all", async (req, res, next) => {
  try {
    await query("UPDATE notifications SET is_read=true WHERE user_id=$1", [req.user.id]);
    res.json({ message: "All marked as read" });
  } catch (err) { next(err); }
});

router3.patch("/:id/read", async (req, res, next) => {
  try {
    await query("UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2",
      [req.params.id, req.user.id]);
    res.json({ message: "Marked as read" });
  } catch (err) { next(err); }
});

router3.post("/broadcast", authorize("admin"), async (req, res, next) => {
  try {
    const { target, title, message, send_sms=false, send_email=false } = req.body;
    let users = [];
    if (target === "all_patients") {
      const { rows } = await query("SELECT id,phone,email,name FROM users WHERE role='patient' AND is_active=true");
      users = rows;
    } else if (target === "all_staff") {
      const { rows } = await query("SELECT id,phone,email,name FROM users WHERE role!='patient' AND is_active=true");
      users = rows;
    } else {
      const { rows } = await query("SELECT id,phone,email,name FROM users WHERE id=$1", [target]);
      users = rows;
    }
    for (const u of users) {
      await query(
        "INSERT INTO notifications(user_id,type,title,message,sent_sms,sent_email) VALUES($1,'system',$2,$3,$4,$5)",
        [u.id, title, message, send_sms, send_email]);
      if (send_sms && u.phone) await sendSMS({ to: u.phone, message });
      if (send_email && u.email) await sendEmail({ to: u.email, subject: title, text: message });
    }
    res.json({ sent: users.length });
  } catch (err) { next(err); }
});

const router4 = require("express").Router();
router4.use(authenticate);

router4.get("/patient/:patientId", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM family_members WHERE patient_id=$1 ORDER BY created_at",
      [req.params.patientId]);
    res.json({ members: rows });
  } catch (err) { next(err); }
});

router4.post("/patient/:patientId", async (req, res, next) => {
  try {
    const { name,relation,date_of_birth,gender,blood_group } = req.body;
    const { rows: [m] } = await query(
      "INSERT INTO family_members(patient_id,name,relation,date_of_birth,gender,blood_group) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
      [req.params.patientId,name,relation,date_of_birth||null,gender||null,blood_group||null]);
    res.status(201).json({ member: m });
  } catch (err) { next(err); }
});

router4.delete("/:id", async (req, res, next) => {
  try {
    await query("DELETE FROM family_members WHERE id=$1", [req.params.id]);
    res.json({ message: "Member removed" });
  } catch (err) { next(err); }
});

const router5 = require("express").Router();
router5.use(authenticate);

router5.get("/", authorize("admin"), async (req, res, next) => {
  try {
    const { date, status } = req.query;
    const conds=[]; const params=[]; let i=1;
    if (date) { conds.push("scheduled_date=$"+i++); params.push(date); }
    if (status) { conds.push("hc.status=$"+i++); params.push(status); }
    const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
    const { rows } = await query(
      "SELECT hc.*,u.name patient_name,u.phone,p.patient_no FROM home_collections hc JOIN patients p ON p.id=hc.patient_id JOIN users u ON u.id=p.user_id "+where+" ORDER BY scheduled_date,scheduled_slot",
      params);
    res.json({ collections: rows });
  } catch (err) { next(err); }
});

router5.post("/", async (req, res, next) => {
  try {
    const { patient_id, address, scheduled_date, scheduled_slot, notes } = req.body;
    const { rows: [hc] } = await query(
      "INSERT INTO home_collections(patient_id,address,scheduled_date,scheduled_slot,notes) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [patient_id, address, scheduled_date, scheduled_slot, notes||null]);
    const { rows: [pat] } = await query(
      "SELECT u.name,u.phone,u.email FROM patients p JOIN users u ON u.id=p.user_id WHERE p.id=$1",
      [patient_id]);
    if (pat) notifyHomeCollection({ ...pat, date: scheduled_date, slot: scheduled_slot, address }).catch(()=>{});
    res.status(201).json({ collection: hc });
  } catch (err) { next(err); }
});

router5.patch("/:id/status", authorize("admin","technician"), async (req, res, next) => {
  try {
    const { status, phlebotomist_id } = req.body;
    const { rows: [hc] } = await query(
      "UPDATE home_collections SET status=$1,phlebotomist_id=COALESCE($2,phlebotomist_id) WHERE id=$3 RETURNING *",
      [status, phlebotomist_id||null, req.params.id]);
    res.json({ collection: hc });
  } catch (err) { next(err); }
});

const router6 = require("express").Router();
router6.use(authenticate, authorize("admin","doctor"));

router6.get("/", async (req, res, next) => {
  try {
    const today = new Date().toISOString().split("T")[0];
    const [{ rows: [stats] }, { rows: pipeline }, { rows: urgent }, { rows: [rev] }] =
      await Promise.all([
        query(
          "SELECT (SELECT COUNT(*) FROM patients) total_patients, (SELECT COUNT(*) FROM samples WHERE DATE(created_at)=$1) today_samples, (SELECT COUNT(*) FROM samples WHERE status='Pending') pending_samples, (SELECT COUNT(*) FROM home_collections WHERE scheduled_date=$1) home_today",
          [today]),
        query("SELECT status,COUNT(*) count FROM samples GROUP BY status"),
        query(
          "SELECT s.sample_no,u.name patient_name,ARRAY_AGG(tc.code) tests FROM samples s JOIN patients p ON p.id=s.patient_id JOIN users u ON u.id=p.user_id LEFT JOIN sample_tests st ON st.sample_id=s.id LEFT JOIN test_catalogue tc ON tc.id=st.test_id WHERE s.priority='Urgent' AND s.status NOT IN ('Dispatched','Cancelled') GROUP BY s.id,s.sample_no,u.name"),
        query(
          "SELECT COALESCE(SUM(total),0) revenue, COALESCE(SUM(total) FILTER(WHERE paid=true),0) collected FROM invoices WHERE DATE(created_at)=$1",
          [today]),
      ]);
    res.json({ stats, pipeline, urgent, revenueToday: rev });
  } catch (err) { next(err); }
});

module.exports = {
  testCatalogRoutes:  router1,
  staffRoutes:        router2,
  notificationRoutes: router3,
  familyRoutes:       router4,
  homeCollectRoutes:  router5,
  dashboardRoutes:    router6,
};