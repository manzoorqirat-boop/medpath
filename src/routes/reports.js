const router = require("express").Router();
const { query, transaction } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");

router.use(authenticate);

router.get("/my", async (req, res, next) => {
  try {
    const { rows: [pat] } = await query("SELECT id FROM patients WHERE user_id=$1", [req.user.id]);
    if (!pat) return res.json({ reports: [] });
    const { rows } = await query(`
      SELECT r.id,r.is_signed,r.signed_at,r.created_at,
             tc.name test_name,tc.code,
             s.sample_no,s.collected_at,s.status sample_status
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      WHERE s.patient_id=$1
      ORDER BY r.created_at DESC`, [pat.id]);
    res.json({ reports: rows });
  } catch (err) { next(err); }
});

router.get("/sample/:sampleId", async (req, res, next) => {
  try {
    const { rows: reports } = await query(`
      SELECT r.*,tc.name test_name,tc.code,
             tu.name tech_name,pu.name pathologist_name
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      LEFT JOIN users tu ON tu.id=r.technician_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      WHERE r.sample_id=$1 ORDER BY r.created_at`, [req.params.sampleId]);

    for (const rpt of reports) {
      const { rows } = await query(
        "SELECT * FROM report_results WHERE report_id=$1 ORDER BY created_at", [rpt.id]);
      rpt.results = rows;
    }
    res.json({ reports });
  } catch (err) { next(err); }
});

router.post("/sample/:sampleId/test/:testId", authorize("technician","admin"), async (req, res, next) => {
  try {
    const { results, tech_notes } = req.body;
    await transaction(async (client) => {
      const { rows: [report] } = await client.query(`
        INSERT INTO reports(sample_id,test_id,technician_id,tech_notes)
        VALUES($1,$2,$3,$4)
        ON CONFLICT(sample_id,test_id)
        DO UPDATE SET tech_notes=EXCLUDED.tech_notes,updated_at=NOW()
        RETURNING *`,
        [req.params.sampleId, req.params.testId, req.user.id, tech_notes||null]);

      await client.query("DELETE FROM report_results WHERE report_id=$1", [report.id]);
      for (const r of results) {
        await client.query(`
          INSERT INTO report_results(report_id,param_name,value,unit,flag,ref_range)
          VALUES($1,$2,$3,$4,$5,$6)`,
          [report.id, r.param_name, r.value, r.unit||null, r.flag||"Normal", r.ref_range||null]);
      }
      await client.query(
        "UPDATE sample_tests SET status='Reported' WHERE sample_id=$1 AND test_id=$2",
        [req.params.sampleId, req.params.testId]);

      return res.json({ report, results });
    });
  } catch (err) { next(err); }
});

router.patch("/:reportId/sign", authorize("doctor","admin"), async (req, res, next) => {
  try {
    const { pathologist_note } = req.body;
    const { rows: [report] } = await query(`
      UPDATE reports SET pathologist_id=$1,pathologist_note=$2,is_signed=true,signed_at=NOW()
      WHERE id=$3 RETURNING *`,
      [req.user.id, pathologist_note||null, req.params.reportId]);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json({ report });
  } catch (err) { next(err); }
});

router.get("/:reportId/full", async (req, res, next) => {
  try {
    const { rows: [report] } = await query(`
      SELECT r.*,tc.name test_name,tc.code,
             tu.name tech_name,pu.name pathologist_name,
             u.name patient_name,u.phone,p.patient_no,
             p.date_of_birth,p.gender,p.blood_group,
             s.sample_no,s.collected_at,s.collection_type
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN users tu ON tu.id=r.technician_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      WHERE r.id=$1`, [req.params.reportId]);
    if (!report) return res.status(404).json({ error: "Report not found" });
    const { rows: results } = await query(
      "SELECT * FROM report_results WHERE report_id=$1 ORDER BY created_at", [req.params.reportId]);
    res.json({ report: { ...report, results } });
  } catch (err) { next(err); }
});

module.exports = router;
