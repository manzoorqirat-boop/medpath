const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

const router = require("express").Router();
router.use(authenticate);

/* GET /api/samples — list samples */
router.get("/", async function(req, res, next) {
  try {
    var limit = parseInt(req.query.limit) || 20;
    var extraWhere = "";
    var params = [limit];

    if (req.user.role === "patient") {
      extraWhere = "WHERE s.patient_id=(SELECT id FROM patients WHERE user_id=$2)";
      params.push(req.user.id);
    }

    var { rows } = await query(
      `SELECT s.*, u.name patient_name,
        COALESCE(ARRAY_AGG(DISTINCT tc.code) FILTER(WHERE tc.id IS NOT NULL), '{}') AS test_codes,
        COALESCE(ARRAY_AGG(DISTINCT tc.name) FILTER(WHERE tc.id IS NOT NULL), '{}') AS test_names,
        COALESCE(ARRAY_AGG(DISTINCT st.test_id::text) FILTER(WHERE st.test_id IS NOT NULL), '{}') AS test_ids
       FROM samples s
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN sample_tests st ON st.sample_id = s.id
       LEFT JOIN test_catalogue tc ON tc.id = st.test_id
       ` + extraWhere + `
       GROUP BY s.id, u.name
       ORDER BY s.created_at DESC
       LIMIT $1`,
      params);
    res.json({ samples: rows });
  } catch(err) { next(err); }
});

/* GET /api/samples/:id — single sample with tests + parameters */
router.get("/:id", async function(req, res, next) {
  try {
    var r = await query(
      `SELECT s.*, u.name patient_name, p.patient_no,
        COALESCE(ARRAY_AGG(DISTINCT st.test_id::text) FILTER(WHERE st.test_id IS NOT NULL), '{}') AS test_ids
       FROM samples s
       JOIN patients p ON p.id = s.patient_id
       JOIN users u ON u.id = p.user_id
       LEFT JOIN sample_tests st ON st.sample_id = s.id
       WHERE s.id = $1
       GROUP BY s.id, u.name, p.patient_no`,
      [req.params.id]);

    if (!r.rows[0]) return res.status(404).json({ error: "Sample not found" });
    var sample = r.rows[0];

    var testsResult = await query(
      `SELECT tc.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', tp.id, 'param_name', tp.param_name, 'unit', tp.unit,
              'price', tp.price, 'range_text', tp.range_text,
              'range_male_min', tp.range_male_min, 'range_male_max', tp.range_male_max,
              'range_female_min', tp.range_female_min, 'range_female_max', tp.range_female_max,
              'display_order', tp.display_order
            ) ORDER BY tp.display_order
          ) FILTER(WHERE tp.id IS NOT NULL), '[]'::json
        ) AS parameters
       FROM sample_tests st
       JOIN test_catalogue tc ON tc.id = st.test_id
       LEFT JOIN test_parameters tp ON tp.test_id = tc.id
       WHERE st.sample_id = $1
       GROUP BY tc.id, tc.name, tc.code, tc.category, tc.price, tc.turnaround_hrs,
                tc.fasting_required, tc.description, tc.is_active, tc.created_at`,
      [req.params.id]);

    sample.tests = testsResult.rows;
    sample.test_ids = testsResult.rows.map(function(t) { return t.id; });
    res.json({ sample: sample });
  } catch(err) { next(err); }
});

/* POST /api/samples — book tests */
router.post("/", authorize("admin","patient"), async function(req, res, next) {
  try {
    var patient_id = req.body.patient_id;
    var priority = req.body.priority || "Normal";
    var collection_type = req.body.collection_type || "Walk-in";

    // Accept both bookings[] and test_ids[] formats
    var test_ids = [];
    if (req.body.bookings && req.body.bookings.length) {
      test_ids = req.body.bookings.map(function(b) { return b.test_id; }).filter(Boolean);
    } else if (req.body.test_ids && req.body.test_ids.length) {
      test_ids = req.body.test_ids;
    }

    if (!patient_id) return res.status(400).json({ error: "patient_id required" });
    if (!test_ids.length) return res.status(400).json({ error: "No tests selected" });

    // Load tests
    var testsResult = await query(
      "SELECT * FROM test_catalogue WHERE id = ANY($1::uuid[]) AND is_active = true",
      [test_ids]);
    var tests = testsResult.rows;
    if (!tests.length) return res.status(400).json({ error: "No valid tests found" });

    var subtotal = tests.reduce(function(s, t) { return s + Number(t.price); }, 0);

    // Invoice
    var invSeq = await query("SELECT nextval('seq_invoice_no') AS val");
    var invNo = "INV-" + new Date().getFullYear() + "-" + String(invSeq.rows[0].val).padStart(5,"0");
    var invoice = await query(
      "INSERT INTO invoices(invoice_no,patient_id,subtotal,total,created_by) VALUES($1,$2,$3,$3,$4) RETURNING *",
      [invNo, patient_id, subtotal, req.user.id]);

    for (var t of tests) {
      await query(
        "INSERT INTO invoice_items(invoice_id,test_id,test_name,unit_price,net_price) VALUES($1,$2,$3,$4,$4)",
        [invoice.rows[0].id, t.id, t.name, Number(t.price)]);
    }

    // Sample
    var smpSeq = await query("SELECT nextval('seq_sample_no') AS val");
    var smpNo = "SMP-" + new Date().getFullYear() + "-" + String(smpSeq.rows[0].val).padStart(5,"0");
    var sample = await query(
      "INSERT INTO samples(sample_no,invoice_id,patient_id,collection_type,priority) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [smpNo, invoice.rows[0].id, patient_id, collection_type, priority]);

    // Link tests → sample
    for (var t2 of tests) {
      await query(
        "INSERT INTO sample_tests(sample_id,test_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [sample.rows[0].id, t2.id]);
    }

    await query(
      "INSERT INTO sample_status_log(sample_id,to_status,changed_by) VALUES($1,'Pending',$2)",
      [sample.rows[0].id, req.user.id]);

    res.status(201).json({ sample: sample.rows[0], invoice: invoice.rows[0] });
  } catch(err) { next(err); }
});

/* PATCH /api/samples/:id/status */
router.patch("/:id/status", authorize("admin","technician","doctor"), async function(req, res, next) {
  try {
    var status = req.body.status;
    var cur = await query("SELECT status FROM samples WHERE id=$1", [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: "Sample not found" });
    var s = await query(
      "UPDATE samples SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *",
      [status, req.params.id]);
    await query(
      "INSERT INTO sample_status_log(sample_id,from_status,to_status,changed_by,notes) VALUES($1,$2,$3,$4,$5)",
      [req.params.id, cur.rows[0].status, status, req.user.id, req.body.notes||null]);
    res.json({ sample: s.rows[0] });
  } catch(err) { next(err); }
});

module.exports = router;