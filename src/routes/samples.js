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

    // Fetch selected params per test
    var selParams = await query(
      "SELECT param_id::text, test_id::text FROM sample_test_params WHERE sample_id=$1",
      [req.params.id]);
    sample.selected_param_ids = selParams.rows.map(function(p){ return p.param_id; });
    sample.selected_params_by_test = {};
    selParams.rows.forEach(function(p){
      if(!sample.selected_params_by_test[p.test_id]) sample.selected_params_by_test[p.test_id]=[];
      sample.selected_params_by_test[p.test_id].push(p.param_id);
    });

    res.json({ sample: sample });
  } catch(err) { next(err); }
});

/* POST /api/samples — create sample
   Body: {
     patient_id, priority, collection_type,
     bookings: [
       { test_id, mode: "full" | "params", selected_param_ids: [...] }
     ]
   }
   Legacy: { patient_id, test_ids: [...] } still supported
*/
router.post("/", authorize("admin","patient"), async function(req, res, next) {
  try {
    var patient_id = req.body.patient_id;
    var priority = req.body.priority || "Normal";
    var collection_type = req.body.collection_type || "Walk-in";

    // Support legacy test_ids format
    var bookings = req.body.bookings;
    if (!bookings && req.body.test_ids && req.body.test_ids.length) {
      bookings = req.body.test_ids.map(function(id) {
        return { test_id: id, mode: "full", selected_param_ids: [] };
      });
    }
    if (!patient_id || !bookings || !bookings.length) {
      return res.status(400).json({ error: "patient_id and bookings required" });
    }

    // Calculate subtotal
    var subtotal = 0;
    var testRows = [];
    for (var b of bookings) {
      var tr = await query(
        "SELECT * FROM test_catalogue WHERE id=$1 AND is_active=true", [b.test_id]);
      if (!tr.rows[0]) continue;
      var test = tr.rows[0];
      testRows.push({ test: test, booking: b });

      if (b.mode === "params" && b.selected_param_ids && b.selected_param_ids.length) {
        // Sum selected parameter prices
        var pr = await query(
          "SELECT COALESCE(SUM(price),0) total FROM test_parameters WHERE id=ANY($1::uuid[])",
          [b.selected_param_ids]);
        var paramTotal = Number(pr.rows[0].total);
        // If all param prices are 0, fall back to test price
        subtotal += paramTotal > 0 ? paramTotal : Number(test.price);
      } else {
        subtotal += Number(test.price);
      }
    }

    // Create invoice
    var invSeq = await query("SELECT nextval('seq_invoice_no') AS val");
    var invNo = "INV-" + new Date().getFullYear() + "-" + String(invSeq.rows[0].val).padStart(5,"0");
    var invoice = await query(
      "INSERT INTO invoices(invoice_no,patient_id,subtotal,total,created_by) VALUES($1,$2,$3,$3,$4) RETURNING *",
      [invNo, patient_id, subtotal, req.user.id]
    );

    // Create invoice items
    for (var row of testRows) {
      var itemPrice = Number(row.test.price);
      if (row.booking.mode === "params" && row.booking.selected_param_ids && row.booking.selected_param_ids.length) {
        var pr2 = await query(
          "SELECT COALESCE(SUM(price),0) total FROM test_parameters WHERE id=ANY($1::uuid[])",
          [row.booking.selected_param_ids]);
        var pp = Number(pr2.rows[0].total);
        if (pp > 0) itemPrice = pp;
      }
      var label = row.test.name;
      if (row.booking.mode === "params" && row.booking.selected_param_ids && row.booking.selected_param_ids.length) {
        var pnames = await query(
          "SELECT param_name FROM test_parameters WHERE id=ANY($1::uuid[]) ORDER BY display_order",
          [row.booking.selected_param_ids]);
        label = row.test.name + " (" + pnames.rows.map(function(p){return p.param_name;}).join(", ") + ")";
      }
      await query(
        "INSERT INTO invoice_items(invoice_id,test_id,test_name,unit_price,net_price) VALUES($1,$2,$3,$4,$4)",
        [invoice.rows[0].id, row.test.id, label, itemPrice]);
    }

    // Create sample
    var smpSeq = await query("SELECT nextval('seq_sample_no') AS val");
    var smpNo = "SMP-" + new Date().getFullYear() + "-" + String(smpSeq.rows[0].val).padStart(5,"0");
    var sample = await query(
      "INSERT INTO samples(sample_no,invoice_id,patient_id,collection_type,priority) VALUES($1,$2,$3,$4,$5) RETURNING *",
      [smpNo, invoice.rows[0].id, patient_id, collection_type, priority]
    );

    // ✅ FIXED: LINK TESTS TO SAMPLE — THIS IS THE KEY FIX
    // This ensures sample_tests records are created for ALL bookings
    // so technicians can see and record results for each test
    for (var row2 of testRows) {
      await query("INSERT INTO sample_tests(sample_id,test_id) VALUES($1,$2)",
        [sample.rows[0].id, row2.test.id]);
      // Store selected params if using param mode
      if (row2.booking.selected_param_ids && row2.booking.selected_param_ids.length) {
        for (var pid of row2.booking.selected_param_ids) {
          await query(
            "INSERT INTO sample_test_params(sample_id,test_id,param_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [sample.rows[0].id, row2.test.id, pid]);
        }
      }
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