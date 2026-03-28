const router = require("express").Router();
const crypto = require("crypto");
const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { notifyPaymentSuccess } = require("../utils/notify");

router.use(authenticate);

/* ─── Admin Summary ─── */
router.get("/admin/summary", authorize("admin"), async (req, res, next) => {
  try {
    const { rows: [summary] } = await query(`
      SELECT COUNT(*) total_invoices,
        COALESCE(SUM(total),0) total_revenue,
        COALESCE(SUM(total) FILTER(WHERE paid=true),0) collected,
        COALESCE(SUM(total) FILTER(WHERE paid=false),0) outstanding,
        COUNT(*) FILTER(WHERE paid=false) pending_count
      FROM invoices`);
    const { rows: byTest } = await query(`
      SELECT tc.name,COUNT(*) orders,SUM(ii.net_price) revenue
      FROM invoice_items ii JOIN test_catalogue tc ON tc.id=ii.test_id
      GROUP BY tc.name ORDER BY revenue DESC LIMIT 10`);
    res.json({ summary, byTest });
  } catch (err) { next(err); }
});

/* ─── List Invoices ─── */
router.get("/", async (req, res, next) => {
  try {
    const { paid, patientId, page=1, limit=20 } = req.query;
    const offset = (page-1)*limit;
    const conds=[]; const params=[]; let i=1;

    if (req.user.role === "patient") {
      const { rows: [pat] } = await query("SELECT id FROM patients WHERE user_id=$1", [req.user.id]);
      if (!pat) return res.json({ invoices: [], total: 0 });
      conds.push(`inv.patient_id=$${i++}`); params.push(pat.id);
    } else if (patientId) {
      conds.push(`inv.patient_id=$${i++}`); params.push(patientId);
    }
    if (paid !== undefined) { conds.push(`inv.paid=$${i++}`); params.push(paid==="true"); }

    const where = conds.length ? "WHERE "+conds.join(" AND ") : "";
    const { rows } = await query(`
      SELECT inv.*,u.name patient_name,p.patient_no,
             ARRAY_AGG(ii.test_name) test_names
      FROM invoices inv
      JOIN patients p ON p.id=inv.patient_id
      JOIN users u ON u.id=p.user_id
      LEFT JOIN invoice_items ii ON ii.invoice_id=inv.id
      ${where}
      GROUP BY inv.id,u.name,p.patient_no
      ORDER BY inv.created_at DESC
      LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]);

    const { rows: [{ count }] } = await query(
      `SELECT COUNT(*) FROM invoices inv ${where}`, params);
    res.json({ invoices: rows, total: Number(count) });
  } catch (err) { next(err); }
});

/* ─── Single Invoice ─── */
router.get("/:id", async (req, res, next) => {
  try {
    const { rows: [inv] } = await query(`
      SELECT inv.*,u.name patient_name,u.phone,u.email,p.patient_no
      FROM invoices inv
      JOIN patients p ON p.id=inv.patient_id
      JOIN users u ON u.id=p.user_id
      WHERE inv.id=$1`, [req.params.id]);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    const { rows: items } = await query(
      "SELECT * FROM invoice_items WHERE invoice_id=$1", [req.params.id]);
    res.json({ invoice: inv, items });
  } catch (err) { next(err); }
});

/* ─── Apply Discount (Admin) ─── */
router.patch("/:id/discount", authorize("admin"), async (req, res, next) => {
  try {
    const { discount, reason } = req.body;
    const { rows: [inv] } = await query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    const newTotal = Math.max(0, inv.subtotal - discount + inv.tax);
    const { rows: [updated] } = await query(
      "UPDATE invoices SET discount=$1,total=$2,notes=$3 WHERE id=$4 RETURNING *",
      [discount, newTotal, reason||null, req.params.id]);
    res.json({ invoice: updated });
  } catch (err) { next(err); }
});

/* ─── Mark Paid (Cash/Manual — for staff use) ─── */
router.patch("/:id/pay", async (req, res, next) => {
  try {
    const { payment_mode, payment_ref } = req.body;
    const { rows: [inv] } = await query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    if (inv.paid) return res.status(400).json({ error: "Already paid" });

    const { rows: [updated] } = await query(`
      UPDATE invoices SET paid=true,payment_mode=$1,payment_ref=$2,payment_time=NOW()
      WHERE id=$3 RETURNING *`,
      [payment_mode||"Cash", payment_ref||null, req.params.id]);

    const { rows: [pat] } = await query(`
      SELECT u.name,u.phone,u.email FROM patients p
      JOIN users u ON u.id=p.user_id WHERE p.id=$1`, [inv.patient_id]);
    if (pat) notifyPaymentSuccess({ ...pat, invoiceNo: inv.invoice_no, amount: inv.total }).catch(()=>{});

    res.json({ invoice: updated });
  } catch (err) { next(err); }
});

/* ─────────────────────────────────────────────────────────
   ONLINE PAYMENT — RAZORPAY INTEGRATION
   ─────────────────────────────────────────────────────────
   Set these environment variables to enable online payment:
     RAZORPAY_KEY_ID      — from Razorpay dashboard
     RAZORPAY_KEY_SECRET  — from Razorpay dashboard
   ───────────────────────────────────────────────────────── */

/**
 * POST /api/billing/:id/initiate-payment
 * Creates a Razorpay order for the given invoice.
 * Returns: { order_id, amount, currency, key_id }
 */
router.post("/:id/initiate-payment", async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Online payment is not configured. Please contact reception." });
    }

    const { rows: [inv] } = await query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    if (inv.paid) return res.status(400).json({ error: "This invoice has already been paid." });

    // Dynamically require Razorpay — graceful fallback if package not installed
    let Razorpay;
    try { Razorpay = require("razorpay"); }
    catch (e) { return res.status(503).json({ error: "Razorpay package not installed. Run: npm install razorpay" }); }

    const rzp = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await rzp.orders.create({
      amount: Math.round(Number(inv.total) * 100), // Razorpay expects paise
      currency: "INR",
      receipt: inv.invoice_no,
      notes: { invoice_id: inv.id, invoice_no: inv.invoice_no },
    });

    res.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
    });
  } catch (err) { next(err); }
});

/**
 * POST /api/billing/:id/verify-payment
 * Verifies the Razorpay payment signature and marks invoice as paid.
 * Body: { razorpay_payment_id, razorpay_order_id, razorpay_signature }
 */
router.post("/:id/verify-payment", async (req, res, next) => {
  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment verification fields." });
    }

    if (!process.env.RAZORPAY_KEY_SECRET) {
      return res.status(503).json({ error: "Payment gateway not configured." });
    }

    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: "Payment verification failed. Invalid signature." });
    }

    // Fetch invoice
    const { rows: [inv] } = await query("SELECT * FROM invoices WHERE id=$1", [req.params.id]);
    if (!inv) return res.status(404).json({ error: "Invoice not found" });
    if (inv.paid) return res.status(400).json({ error: "Invoice already marked as paid." });

    // Mark invoice as paid
    const { rows: [updated] } = await query(`
      UPDATE invoices
      SET paid=true, payment_mode='Online', payment_ref=$1, payment_time=NOW()
      WHERE id=$2 RETURNING *`,
      [razorpay_payment_id, req.params.id]);

    // Notify patient
    const { rows: [pat] } = await query(`
      SELECT u.name, u.phone, u.email
      FROM patients p JOIN users u ON u.id=p.user_id
      WHERE p.id=$1`, [inv.patient_id]);
    if (pat) notifyPaymentSuccess({ ...pat, invoiceNo: inv.invoice_no, amount: inv.total }).catch(()=>{});

    res.json({ invoice: updated, message: "Payment verified and recorded successfully." });
  } catch (err) { next(err); }
});

module.exports = router;