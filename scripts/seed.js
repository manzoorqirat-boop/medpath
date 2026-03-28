require("dotenv").config();
const { Pool } = require("pg");
const bcrypt   = require("bcryptjs");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:lkyPnnqpIMbAViDTXmVUEJSclBOlGydv@gondola.proxy.rlwy.net:32399/railway",
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  console.log("Seeding database...");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tests = [
      ["CBC","Complete Blood Count","Hematology",350,4,false],
      ["LFT","Liver Function Test","Biochemistry",650,6,true],
      ["KFT","Kidney Function Test","Biochemistry",600,6,true],
      ["TSH","Thyroid Profile (T3/T4/TSH)","Endocrinology",800,12,true],
      ["LIPID","Lipid Profile","Biochemistry",550,6,true],
      ["HBA1C","HbA1c (Glycated Hemoglobin)","Diabetes",480,4,false],
      ["URINE","Urine Routine & Microscopy","Microbiology",200,2,false],
      ["ECG","Electrocardiogram (ECG)","Cardiology",300,1,false],
      ["DENG","Dengue NS1 / IgM / IgG","Serology",900,6,false],
      ["COVID","COVID-19 RT-PCR","Molecular",500,12,false],
      ["VIT","Vitamin D & B12 Panel","Nutrition",1100,24,false],
      ["CRP","C-Reactive Protein","Immunology",420,4,false],
    ];

    for (const [code,name,cat,price,eta,fasting] of tests) {
      await client.query(`
        INSERT INTO test_catalogue(code,name,category,price,turnaround_hrs,fasting_required)
        VALUES($1,$2,$3,$4,$5,$6)
        ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name`,
        [code,name,cat,price,eta,fasting]);
    }
    console.log("Tests seeded");

    const adminHash = await bcrypt.hash("admin", 12);
    await client.query(`
      INSERT INTO users(name,email,phone,password_hash,role)
      VALUES('Admin User','admin@medpath.com','+910000000000',$1,'admin')
      ON CONFLICT(email) DO NOTHING`, [adminHash]);
    const { rows: [adminUser] } = await client.query(
      "SELECT id FROM users WHERE email='admin@medpath.com'");
    await client.query(`
      INSERT INTO staff(user_id,staff_no,designation,department,joined_date)
      VALUES($1,'STF-0001','Administrator','Management','2020-01-01')
      ON CONFLICT(staff_no) DO NOTHING`, [adminUser.id]);

    const docHash = await bcrypt.hash("doc123", 12);
    await client.query(`
      INSERT INTO users(name,email,phone,password_hash,role)
      VALUES('Dr. Anita Sharma','anita@medpath.com','+910000000001',$1,'doctor')
      ON CONFLICT(email) DO NOTHING`, [docHash]);
    const { rows: [docUser] } = await client.query(
      "SELECT id FROM users WHERE email='anita@medpath.com'");
    await client.query(`
      INSERT INTO staff(user_id,staff_no,designation,department,qualification,joined_date)
      VALUES($1,'STF-0002','Senior Pathologist','Pathology','MD Pathology','2020-06-01')
      ON CONFLICT(staff_no) DO NOTHING`, [docUser.id]);

    const techHash = await bcrypt.hash("tech123", 12);
    await client.query(`
      INSERT INTO users(name,email,phone,password_hash,role)
      VALUES('Suresh Teknical','suresh@medpath.com','+910000000002',$1,'technician')
      ON CONFLICT(email) DO NOTHING`, [techHash]);
    const { rows: [techUser] } = await client.query(
      "SELECT id FROM users WHERE email='suresh@medpath.com'");
    await client.query(`
      INSERT INTO staff(user_id,staff_no,designation,department,joined_date)
      VALUES($1,'STF-0003','Lab Technician','Biochemistry','2021-06-15')
      ON CONFLICT(staff_no) DO NOTHING`, [techUser.id]);

    const patHash = await bcrypt.hash("0000", 12);
    await client.query(`
      INSERT INTO users(name,email,phone,password_hash,role)
      VALUES('Rajesh Kumar','rajesh@email.com','+919876543210',$1,'patient')
      ON CONFLICT(email) DO NOTHING`, [patHash]);
    const { rows: [patUser] } = await client.query(
      "SELECT id FROM users WHERE email='rajesh@email.com'");
    const { rows: [{ val }] } = await client.query(
      "SELECT nextval('seq_patient_no') AS val");
    const patNo = "PAT-"+String(val).padStart(4,"0");
    await client.query(`
      INSERT INTO patients(user_id,patient_no,date_of_birth,gender,blood_group,address)
      VALUES($1,$2,'1983-06-15','Male','B+','12 Gandhi Nagar, Pune')
      ON CONFLICT(user_id) DO NOTHING`, [patUser.id, patNo]);

    await client.query("COMMIT");
    console.log("Seed complete!");
    console.log("Patient: +919876543210  OTP: 123456");
    console.log("Admin: admin@medpath.com / admin");
    console.log("Doctor: anita@medpath.com / doc123");
    console.log("Tech: suresh@medpath.com / tech123");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });