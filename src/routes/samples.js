const router = require("express").Router();
const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

/* GET /api/samples — list samples */
router.get("/", async function(req, res, next) {
  try {
    var conditions = [];
    var params = [];
    var i = 1;
    if (req.user.role === "patient") {
      var pr = await query("SELECT id FROM patients WHERE user_id=$1", [req.user.id]);
      var pat = pr.rows[0];
      if (!pat) return res.json({ samples: [], total: 0 });
      conditions.push("s.patient_id=$" + i++);
      params.push(pat.id);
    }
    var where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
    var result = await query(
      `SELECT s.*,u.name patient_name,p.patient_no,
              ARRAY_AGG(DISTINCT tc.name) FILTER(WHERE tc.name IS NOT NULL) AS test_names,
              ARRAY_AGG(DISTINCT st.test_id::text) FILTER(WHERE st.test_id IS NOT NULL) AS test_ids
       FROM samples s
       JOIN patients p ON p.id=s.patient_id
       JOIN users u ON u.id=p.user_id
       LEFT JOIN sample_tests st ON st.sample_id=s.id
       LEFT JOIN test_catalogue tc ON tc.id=st.test_id
       ${where}
       GROUP BY s.id,u.name,p.patient_no
       ORDER BY s.created_at DESC LIMIT $${i} OFFSET $${i+1}`,
      params.concat([50, 0])
    );
    res.json({ samples: result.rows, total: result.rows.length });
  } catch(err) { next(err); }
});

/* GET /api/samples/:id — single sample WITH test_ids, test names and parameters */
router.get("/:id", async function(req, res, next) {
  try {
    var r = await query(
      `SELECT s.*,u.name patient_name,p.patient_no
       FROM samples s
       JOIN patients p ON p.id=s.patient_id
       JOIN users u ON u.id=p.user_id
       WHERE s.id=$1`,
      [req.params.id]
    );
    if (!r.rows[0]) return res.status(404).json({ error: "Sample not found" });

    var testsResult = await query(
      `SELECT tc.id, tc.name, tc.code, tc.category,
              COALESCE(
                JSON_AGG(
                  JSON_BUILD_OBJECT(
                    'id', tp.id,
                    'param_name', tp.param_name,
                    'unit', tp.unit,
                    'range_text', tp.range_text,
                    'range_male_min', tp.range_male_min,
                    'range_male_max', tp.range_male_max,
                    'range_female_min', tp.range_female_min,
                    'range_female_max', tp.range_female_max,
                    'display_order', tp.display_order
                  ) ORDER BY tp.display_order
                ) FILTER(WHERE tp.id IS NOT NULL),
                '[]'
              ) AS parameters
       FROM sample_tests st
       JOIN test_catalogue tc ON tc.id=st.test_id
       LEFT JOIN test_parameters tp ON tp.test_id=tc.id
       WHERE st.sample_id=$1
       GROUP BY tc.id,tc.name,tc.code,tc.category`,
      [req.params.id]
    );

    var sample = r.rows[0];
    sample.test_ids = testsResult.rows.map(function(t) { return t.id; });
    sample.tests = testsResult.rows;

    res.json({ sample: sample });
  } catch(err) { next(err); }
});

/* POST /api/samples — create sample */
router.post("/", authorize("admin","patient"), async function(req, res, next) {
  try {
    var patient_id = req.body.patient_id;
    var test_ids = req.body.test_ids;
    var priority = req.body.priority || "Normal";
    var collection_type = req.body.collection_type || "Walk-in";
    if (!patient_id || !test_ids || !test_ids.length) {
      return res.status(400).json({ error: "patient_id and test_ids required" });
    }
    var tests = await query(
      "SELECT * FROM test_catalogue WHERE id=ANY($1::uuid[]) AND is_active=true", [test_ids]);
    var subtotal = tests.rows.reduce(function(s,t){ return s + Number(t.price); }, 0);
    var invSeq = await query("SELECT nextval('seq_invoice_no') AS val");
    var invNo = "INV-" + new Date().getFullYear() + "-" + String(invSeq.rows[0].val).padStart(5,"0");
    var invoice = await query(
      "INSERT INTO invoices(invoice_no,patient_id,subtotal,total,created_by) VALUES($1,$2,$3,$3,$4) RETURNING *",
      [invNo, patient_id, subtotal, req.user.id]
    );
    for (var t of tests.rows) {
      await query(
        "INSERT INTO invoice_items(invoice_id,test_id,test_name,unit_price,net_price) VALUES($1,$2,$3,$4,$4)",
        [invoice.rows[0].id, t.id, t.name, t.price]);
    }
    var smpSeq = await query("SELECT nextval('seq_sample_no') AS val");
    var smpNo = "SMP-" + new Date().getFullYear() + "-" + String(smpSeq.rows[0].val).padStart(5,"0");
    var sample = await query(
      "INSERT INTO samples(sample_no,invoice_id,patient_id,collection_type,priority) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [smpNo, invoice.rows[0].id, patient_id, collection_type, priority]
    );
    for (var t2 of tests.rows) {
      await query("INSERT INTO sample_tests(sample_id,test_id) VALUES($1,$2)", [sample.rows[0].id, t2.id]);
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
    var notes = req.body.notes;
    var r = await query("SELECT * FROM samples WHERE id=$1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Sample not found" });
    var updated = await query(
      "UPDATE samples SET status=$1 WHERE id=$2 RETURNING *",
      [status, req.params.id]
    );
    await query(
      "INSERT INTO sample_status_log(sample_id,from_status,to_status,changed_by,notes) VALUES($1,$2,$3,$4,$5)",
      [req.params.id, r.rows[0].status, status, req.user.id, notes||null]
    );
    res.json({ sample: updated.rows[0] });
  } catch(err) { next(err); }
});

/* PATCH /api/samples/:id/assign */
router.patch("/:id/assign", authorize("admin"), async function(req, res, next) {
  try {
    var r = await query(
      "UPDATE samples SET processed_by=$1 WHERE id=$2 RETURNING *",
      [req.body.technician_id, req.params.id]
    );
    res.json({ sample: r.rows[0] });
  } catch(err) { next(err); }
});

module.exports = router;