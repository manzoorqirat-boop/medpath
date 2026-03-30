const router   = require("express").Router();
const { query, transaction } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { sendEmail } = require("../utils/notify");

router.use(authenticate);

/* GET /api/reports/my — Patient: own reports */
router.get("/my", async (req, res, next) => {
  try {
    const { rows: [pat] } = await query("SELECT id FROM patients WHERE user_id=$1", [req.user.id]);
    if (!pat) return res.json({ reports: [] });
    const { rows } = await query(`
      SELECT r.id,r.report_no,r.is_signed,r.signed_at,r.created_at,r.sent_email,r.sent_whatsapp,
             tc.name test_name,tc.code,
             s.sample_no,s.collected_at,s.status sample_status,
             pu.name pathologist_name
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      WHERE s.patient_id=$1 ORDER BY r.created_at DESC`, [pat.id]);
    res.json({ reports: rows });
  } catch (err) { next(err); }
});

/* GET /api/reports/sample/:sampleId — Reports + results for a sample */
router.get("/sample/:sampleId", async (req, res, next) => {
  try {
    const { rows: reports } = await query(`
      SELECT r.*,tc.name test_name,tc.code,tc.category,
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

/* GET /api/reports/all — Admin/Doctor: all reports with results */
router.get("/all", authorize("admin","doctor"), async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT r.id,r.report_no,r.is_signed,r.signed_at,r.created_at,
             r.tech_notes,r.pathologist_note,
             tc.name test_name,tc.code,tc.category,
             s.sample_no,s.id sample_id,
             u.name patient_name,u.phone patient_phone,u.email patient_email,
             p.patient_no,p.date_of_birth,p.gender,p.blood_group,
             pu.name pathologist_name,
             tu.name tech_name
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      LEFT JOIN users tu ON tu.id=r.technician_id
      ORDER BY r.created_at DESC LIMIT 100`);
    for (const rpt of rows) {
      const { rows: results } = await query(
        "SELECT * FROM report_results WHERE report_id=$1 ORDER BY created_at",
        [rpt.id]);
      rpt.results = results;
    }
    res.json({ reports: rows });
  } catch (err) { next(err); }
});

/* POST /api/reports/sample/:sampleId/test/:testId — Technician: save results */
router.post("/sample/:sampleId/test/:testId", authorize("technician","admin"), async (req, res, next) => {
  try {
    const { results=[], tech_notes } = req.body;
    
    // ✅ FIXED: Verify sample exists
    const { rows: [sample] } = await query(
      "SELECT id FROM samples WHERE id=$1",
      [req.params.sampleId]);
    if (!sample) {
      return res.status(404).json({ error: "Sample not found" });
    }
    
    // Check at least one result has a value
    const filledResults = results.filter(r => r.value && r.value.toString().trim() !== "");
    if (!filledResults.length) {
      return res.status(400).json({ error: "Enter at least one value" });
    }
    
    let report;
    await transaction(async (client) => {
      // Get or create report (ON CONFLICT keeps existing report_id)
      const { rows: [existing] } = await client.query(
        "SELECT id,report_no FROM reports WHERE sample_id=$1 AND test_id=$2",
        [req.params.sampleId, req.params.testId]);
      
      let rpt;
      if (existing) {
        // Update existing report
        const { rows: [updated] } = await client.query(
          "UPDATE reports SET tech_notes=$1,technician_id=$2,updated_at=NOW() WHERE id=$3 RETURNING *",
          [tech_notes||null, req.user.id, existing.id]);
        rpt = updated;
      } else {
        // Create new report with sequence number
        const { rows: [{ val }] } = await client.query("SELECT nextval('seq_report_no') AS val");
        const reportNo = "RPT-"+new Date().getFullYear()+"-"+String(val).padStart(5,"0");
        const { rows: [created] } = await client.query(
          "INSERT INTO reports(sample_id,test_id,technician_id,tech_notes,report_no) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [req.params.sampleId, req.params.testId, req.user.id, tech_notes||null, reportNo]);
        rpt = created;
      }

      // Clear old results and insert new ones (only filled)
      await client.query("DELETE FROM report_results WHERE report_id=$1", [rpt.id]);
      for (const r of filledResults) {
        await client.query(
          "INSERT INTO report_results(report_id,param_name,value,unit,flag,ref_range) VALUES($1,$2,$3,$4,$5,$6)",
          [rpt.id, r.param_name, r.value, r.unit||"", r.flag||"Normal", r.ref_range||""]);
      }
      // Also insert pending (empty) params so doctor sees full list
      const emptyResults = results.filter(r => !r.value || r.value.toString().trim() === "");
      for (const r of emptyResults) {
        await client.query(
          "INSERT INTO report_results(report_id,param_name,value,unit,flag,ref_range) VALUES($1,$2,$3,$4,$5,$6)",
          [rpt.id, r.param_name, "", r.unit||"", "Pending", r.ref_range||""]);
      }
      await client.query(
        "UPDATE samples SET status='Reported' WHERE id=$1",
        [req.params.sampleId]);
      report = rpt;
    });

    // Fetch fresh results from DB to confirm save
    const { rows: savedResults } = await query(
      "SELECT * FROM report_results WHERE report_id=$1 ORDER BY created_at", [report.id]);
    res.json({ report: { ...report, results: savedResults } });
  } catch (err) { next(err); }
});

/* PATCH /api/reports/:reportId/sign — Doctor: sign report */
router.patch("/:reportId/sign", authorize("doctor","admin"), async (req, res, next) => {
  try {
    const { pathologist_note } = req.body;
    const { rows: [report] } = await query(`
      UPDATE reports
      SET pathologist_id=$1,pathologist_note=$2,is_signed=true,signed_at=NOW(),updated_at=NOW()
      WHERE id=$3 RETURNING *`,
      [req.user.id,pathologist_note||null,req.params.reportId]);
    if (!report) return res.status(404).json({ error: "Report not found" });
    await query("UPDATE samples SET status='Dispatched' WHERE id=$1",[report.sample_id]);
    res.json({ report });
  } catch (err) { next(err); }
});

/* GET /api/reports/:reportId/full — Full report with all details */
router.get("/:reportId/full", async (req, res, next) => {
  try {
    const { rows: [report] } = await query(`
      SELECT r.*,tc.name test_name,tc.code,tc.category,
             tu.name tech_name,pu.name pathologist_name,
             ps.designation pathologist_designation, ps.qualification pathologist_qualification,
             u.name patient_name,u.phone patient_phone,u.email patient_email,
             p.patient_no,p.date_of_birth,p.gender,p.blood_group,
             s.sample_no,s.collected_at,s.collection_type
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN users tu ON tu.id=r.technician_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      LEFT JOIN staff ps ON ps.user_id=r.pathologist_id
      WHERE r.id=$1`,[req.params.reportId]);
    if (!report) return res.status(404).json({ error:"Report not found" });
    const { rows: results } = await query(
      "SELECT * FROM report_results WHERE report_id=$1 AND value IS NOT NULL AND value<>'' ORDER BY created_at",
      [req.params.reportId]);
    res.json({ report, results });
  } catch (err) { next(err); }
});

/* POST /api/reports/:reportId/send-email — Email report notification */
router.post("/:reportId/send-email", authorize("admin","doctor"), async (req, res, next) => {
  try {
    const { rows: [r] } = await query(`
      SELECT rep.report_no,rep.is_signed,rep.signed_at,tc.name test_name,
             u.name patient_name,u.email patient_email,p.patient_no,s.sample_no,
             pu.name pathologist_name
      FROM reports rep
      JOIN test_catalogue tc ON tc.id=rep.test_id
      JOIN samples s ON s.id=rep.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN users pu ON pu.id=rep.pathologist_id
      WHERE rep.id=$1`,[req.params.reportId]);
    if (!r) return res.status(404).json({ error:"Report not found" });
    if (!r.patient_email) return res.status(400).json({ error:"Patient email not on file" });

    const sent = await sendEmail({
      to: r.patient_email,
      subject: `Lab Report Ready – ${r.report_no} | MedPath`,
      html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f7f6;">
  <div style="background:linear-gradient(135deg,#0A5C47,#0F7A5E);padding:28px 32px;border-radius:12px 12px 0 0;">
    <div style="color:#fff;font-size:20px;font-weight:700;">🔬 MedPath Laboratory</div>
    <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:4px;">NABL ACCREDITED · ISO 15189</div>
  </div>
  <div style="background:#fff;padding:28px 32px;border:1px solid #e0e8e4;border-top:none;border-radius:0 0 12px 12px;">
    <p style="font-size:15px;color:#1C2320;">Dear <strong>${r.patient_name}</strong>,</p>
    <p style="font-size:13px;color:#5A6560;margin-bottom:20px;">Your lab report is ready and has been verified by our pathologist.</p>
    <div style="background:#f0f4f8;border-radius:8px;padding:16px 20px;margin-bottom:20px;font-size:13px;">
      <div style="margin-bottom:6px;"><span style="color:#8A9590;width:130px;display:inline-block;">Report No</span> <strong style="color:#0A5C47;">${r.report_no}</strong></div>
      <div style="margin-bottom:6px;"><span style="color:#8A9590;width:130px;display:inline-block;">Test</span> <strong>${r.test_name}</strong></div>
      <div style="margin-bottom:6px;"><span style="color:#8A9590;width:130px;display:inline-block;">Patient ID</span> <strong>${r.patient_no}</strong></div>
      <div style="margin-bottom:6px;"><span style="color:#8A9590;width:130px;display:inline-block;">Verified By</span> <strong>${r.pathologist_name||"Lab Pathologist"}</strong></div>
    </div>
    <p style="font-size:13px;color:#5A6560;margin-bottom:20px;">
      <a href="${process.env.APP_URL || "https://medpath-production.up.railway.app"}/reports/${r.report_no}" 
         style="background:#0A5C47;color:#fff;padding:10px 20px;text-decoration:none;border-radius:4px;display:inline-block;margin-top:10px;">
        View My Report
      </a>
    </p>
  </div>
</div>`
    });
    if (sent) {
      await query("UPDATE reports SET sent_email=true WHERE id=$1",[req.params.reportId]);
      res.json({ message:"Email sent successfully." });
    } else {
      res.status(500).json({ error:"Email failed. Check SMTP config in .env" });
    }
  } catch (err) { next(err); }
});

/* GET /api/reports/:reportId/whatsapp-link — Generate wa.me link */
router.get("/:reportId/whatsapp-link", authorize("admin","doctor","technician"), async (req, res, next) => {
  try {
    const { rows: [r] } = await query(`
      SELECT rep.report_no,tc.name test_name,
             u.name patient_name,u.phone patient_phone,p.patient_no
      FROM reports rep
      JOIN test_catalogue tc ON tc.id=rep.test_id
      JOIN samples s ON s.id=rep.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      WHERE rep.id=$1`,[req.params.reportId]);
    if (!r) return res.status(404).json({ error:"Report not found" });

    const phone = (r.patient_phone||"").replace(/\D/g,"");
    const msg =
      `Dear ${r.patient_name},\n\n`+
      `Your MedPath Lab Report is ready.\n\n`+
      `🔬 Report No: ${r.report_no}\n`+
      `🧪 Test: ${r.test_name}\n`+
      `🆔 Patient No: ${r.patient_no}\n\n`+
      `Please log in to the patient portal to view, download or print your report.\n\n`+
      `– MedPath Laboratory`;
    const link = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    await query("UPDATE reports SET sent_whatsapp=true WHERE id=$1",[req.params.reportId]);
    res.json({ link, phone, message:msg });
  } catch (err) { next(err); }
});

/* GET /api/reports/:reportId/pdf — Stream PDF (public with token in query) */
router.get("/:reportId/pdf", async (req, res, next) => {
  // Allow token from query string for window.open PDF downloads
  if (!req.user && req.query.token) {
    try {
      const jwt = require("jsonwebtoken");
      const SECRET = process.env.JWT_SECRET || "change-me-in-production";
      req.user = jwt.verify(req.query.token, SECRET);
    } catch(e) {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  if (!req.user) return res.status(401).json({ error: "No token provided" });
  try {
    let PDFDocument;
    try { PDFDocument = require("pdfkit"); }
    catch (e) { 
      return res.status(503).send("PDF generation unavailable. pdfkit not installed.");
    }

    const { rows: [rpt] } = await query(`
      SELECT r.*,tc.name test_name,tc.code,
             tu.name tech_name,pu.name pathologist_name,
             ps.designation pathologist_designation,ps.qualification pathologist_qualification,
             u.name patient_name,u.phone patient_phone,
             p.patient_no,p.date_of_birth,p.gender,p.blood_group,
             s.sample_no,s.collected_at
      FROM reports r
      JOIN test_catalogue tc ON tc.id=r.test_id
      JOIN samples s ON s.id=r.sample_id
      JOIN patients p ON p.id=s.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN users tu ON tu.id=r.technician_id
      LEFT JOIN users pu ON pu.id=r.pathologist_id
      LEFT JOIN staff ps ON ps.user_id=r.pathologist_id
      WHERE r.id=$1`,[req.params.reportId]);
    if (!rpt) return res.status(404).json({ error:"Report not found" });

    const { rows: results } = await query(
      "SELECT * FROM report_results WHERE report_id=$1 AND value IS NOT NULL AND value<>'' ORDER BY created_at",
      [req.params.reportId]);

    const doc = new PDFDocument({ margin:50, size:"A4" });
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",`attachment; filename="${rpt.report_no||"report"}.pdf"`);
    doc.pipe(res);

    const W = doc.page.width - 100;
    const G = "#0A5C47";

    // Header bar
    doc.rect(0,0,doc.page.width,70).fill(G);
    doc.fill("#fff").font("Helvetica-Bold").fontSize(18).text("MedPath Laboratory",50,16);
    doc.font("Helvetica").fontSize(8.5).fill("rgba(255,255,255,0.7)")
       .text("NABL Accredited · ISO 15189 · 24×7 Laboratory Services",50,38);
    doc.fill("#fff").fontSize(8.5)
       .text(`Report: ${rpt.report_no||"—"}   |   Date: ${new Date(rpt.signed_at||rpt.created_at).toLocaleDateString("en-IN")}`,50,52,{align:"right",width:W});

    // Report title
    doc.fill(G).font("Helvetica-Bold").fontSize(10.5)
       .text("LABORATORY INVESTIGATION REPORT",50,85,{align:"center",width:W});
    doc.moveTo(50,100).lineTo(50+W,100).lineWidth(1).stroke(G);

    // Patient info grid
    const age = rpt.date_of_birth
      ? new Date().getFullYear()-new Date(rpt.date_of_birth).getFullYear()+" Yrs" : "—";
    const infoRows = [
      [["Patient Name",rpt.patient_name],["Report No",rpt.report_no||"—"]],
      [["Patient ID",rpt.patient_no],["Sample No",rpt.sample_no]],
      [["Age / Sex",`${age} / ${rpt.gender||"—"}`],["Collected",rpt.collected_at?new Date(rpt.collected_at).toLocaleDateString("en-IN"):"—"]],
      [["Blood Group",rpt.blood_group||"—"],["Report Date",new Date(rpt.signed_at||rpt.created_at).toLocaleDateString("en-IN")]],
    ];
    let y = 110;
    for (const row of infoRows) {
      doc.fill("#888").font("Helvetica").fontSize(7.5).text(row[0][0],50,y);
      doc.fill("#000").font("Helvetica-Bold").fontSize(9).text(row[0][1],130,y);
      doc.fill("#888").font("Helvetica").fontSize(7.5).text(row[1][0],320,y);
      doc.fill("#000").font("Helvetica-Bold").fontSize(9).text(row[1][1],400,y);
      y += 14;
    }
    doc.moveTo(50,y+4).lineTo(50+W,y+4).stroke("#ddd");
    y += 14;

    // Test header
    doc.fill(G).font("Helvetica-Bold").fontSize(10)
       .text(`TEST: ${rpt.test_name} (${rpt.code})`,50,y);
    y += 16;

    // Table header
    const C = {p:50,r:240,u:305,ref:365,f:510};
    doc.rect(50,y,W,18).fill("#f0f4f8");
    doc.fill("#555").font("Helvetica-Bold").fontSize(8);
    ["PARAMETER","RESULT","UNIT","REFERENCE RANGE","FLAG"].forEach((h,i)=>{
      const x=[C.p,C.r,C.u,C.ref,C.f][i];
      doc.text(h,x+4,y+5);
    });
    y += 20;

    for (const res of results) {
      const flag = res.flag||"Normal";
      const fc = flag==="High"||flag==="Critical"?"#C0392B":flag==="Low"?"#C67C1A":"#1A7F5A";
      doc.fill("#000").font("Helvetica").fontSize(9).text(res.param_name,C.p+4,y,{width:185});
      doc.font("Helvetica-Bold").text(res.value,C.r+4,y);
      doc.font("Helvetica").fill("#555").text(res.unit||"—",C.u+4,y);
      doc.fill("#333").text(res.ref_range||"—",C.ref+4,y,{width:138});
      doc.fill(fc).font("Helvetica-Bold").text(flag,C.f+4,y);
      doc.moveTo(50,y+14).lineTo(50+W,y+14).lineWidth(0.3).stroke("#ddd");
      y += 18;
      if (y>720){doc.addPage();y=50;}
    }
    y += 10;

    if (rpt.tech_notes) {
      doc.fill("#444").font("Helvetica").fontSize(9).text("Technician Notes:",50,y);
      doc.fill("#666").text(rpt.tech_notes,50,y+12,{width:W});
      y += 32;
    }
    if (rpt.pathologist_note) {
      doc.fill("#444").font("Helvetica").fontSize(9).text("Pathologist Remarks:",50,y);
      doc.fill("#666").text(rpt.pathologist_note,50,y+12,{width:W});
      y += 32;
    }

    // Signature
    y += 16;
    doc.moveTo(330,y).lineTo(550,y).lineWidth(0.8).stroke("#000");
    doc.fill("#000").font("Helvetica-Bold").fontSize(9.5).text(rpt.pathologist_name||"—",330,y+6,{width:220});
    doc.fill("#444").font("Helvetica").fontSize(8.5)
       .text(rpt.pathologist_designation||"Pathologist",330,y+20,{width:220});
    if(rpt.pathologist_qualification){
      doc.fill("#666").font("Helvetica").fontSize(8)
         .text(rpt.pathologist_qualification,330,y+32,{width:220});
    }
    doc.fill("#666").font("Helvetica").fontSize(8)
       .text(new Date(rpt.signed_at||rpt.created_at).toLocaleDateString("en-IN")+" "+new Date(rpt.signed_at||rpt.created_at).toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"}),330,y+44,{width:220});

    // Footer
    const fy = doc.page.height-42;
    doc.moveTo(50,fy-8).lineTo(50+W,fy-8).stroke("#ccc");
    doc.fill("#aaa").font("Helvetica").fontSize(7.5)
       .text("This report is generated electronically by MedPath Laboratory. Results should be interpreted in clinical context. support@medpath.in",
         50,fy,{align:"center",width:W});
    doc.end();
  } catch (err) { next(err); }
});

module.exports = router;