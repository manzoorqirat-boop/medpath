const { query } = require("../db");
const { authenticate, authorize } = require("../middleware/auth");
const { sendEmail, sendSMS, notifyHomeCollection } = require("../utils/notify");
const bcrypt = require("bcryptjs");

// ── testCatalog ───────────────────────────────────────────────
const router1 = require("express").Router();

router1.get("/", async (req, res, next) => {
  try {
    const { cat, search="" } = req.query;
    const { rows } = await query(`
      SELECT tc.*,
        COALESCE(json_agg(tp ORDER BY tp.display_order) FILTER(WHERE tp.id IS NOT NULL),'[]') parameters
      FROM test_catalogue tc
      LEFT JOIN test_parameters tp ON tp.test_id=tc.id
      WHERE tc.is_active=true
        AND ($1::text IS NULL OR tc.category=$1)
        AND (tc.name ILIKE $2 OR tc.code ILIKE $2 OR tc.category ILIKE $2)
      GROUP BY tc.id ORDER BY tc.category,tc.name`,
      [cat||null, `%${search}%`]);
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
    const { rows: [test] } = await query(`
      INSERT INTO test_catalogue(code,name,category,price,turnaround_hrs,fasting_required,description)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code,name,category,price,turnaround_hrs||6,fasting_required||false,description||null]);
    res.status(201).json({ test });
  } catch (err) { next(err); }
});

router1.put("/:id", authenticate, authorize("admin"), async (req, res, next) => {
  try {
    const { name,category,price,turnaround_hrs,fasting_required,description,is_active } = req.body;
    const { rows: [test] } = await query(`
      UPDATE test_catalogue SET name=$1,category=$2,price=$3,turnaround_hrs=$4,
        fasting_required=$5,description=$6,is_active=$7
      WHERE id=$8 RETURNING *`,
      [name,category,price,turnaround_hrs,fasting_required,description,​​​​​​​​​​​​​​​​
