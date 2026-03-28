CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TYPE user_role AS ENUM ('patient','admin','technician','doctor');
CREATE TYPE gender_type AS ENUM ('Male','Female','Other');
CREATE TYPE blood_group AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE sample_status AS ENUM ('Pending','Collected','Processing','Reported','Dispatched','Cancelled');
CREATE TYPE priority_level AS ENUM ('Normal','Urgent','STAT');
CREATE TYPE payment_mode AS ENUM ('Cash','Card','UPI','Net Banking','Manual','Waived');
CREATE TYPE notif_type AS ENUM ('report','billing','collection','reminder','system','alert');
CREATE TYPE collect_type AS ENUM ('Walk-in','Home Collection');
CREATE TYPE param_flag AS ENUM ('Normal','Low','High','Critical','Borderline');

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  email         CITEXT UNIQUE,
  phone         TEXT UNIQUE,
  password_hash TEXT,
  role          user_role NOT NULL DEFAULT 'patient',
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  phone      TEXT NOT NULL,
  code       TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

CREATE TABLE IF NOT EXISTS patients (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  patient_no           TEXT UNIQUE NOT NULL,
  date_of_birth        DATE,
  gender               gender_type,
  blood_group          blood_group,
  address              TEXT,
  emergency_contact    TEXT,
  emergency_phone      TEXT,
  referred_by          TEXT,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_user ON patients(user_id);

CREATE TABLE IF NOT EXISTS family_members (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id    UUID REFERENCES patients(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  relation      TEXT NOT NULL,
  date_of_birth DATE,
  gender        gender_type,
  blood_group   blood_group,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_catalogue (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  category         TEXT NOT NULL,
  price            NUMERIC(10,2) NOT NULL,
  turnaround_hrs   INT NOT NULL DEFAULT 6,
  fasting_required BOOLEAN NOT NULL DEFAULT false,
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS test_parameters (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  test_id          UUID REFERENCES test_catalogue(id) ON DELETE CASCADE,
  param_name       TEXT NOT NULL,
  unit             TEXT,
  range_male_min   NUMERIC,
  range_male_max   NUMERIC,
  range_female_min NUMERIC,
  range_female_max NUMERIC,
  range_text       TEXT,
  display_order    INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS staff (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES users(id) ON DELETE CASCADE,
  staff_no      TEXT UNIQUE NOT NULL,
  designation   TEXT NOT NULL,
  department    TEXT,
  qualification TEXT,
  joined_date   DATE,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_no       TEXT UNIQUE NOT NULL,
  patient_id       UUID REFERENCES patients(id),
  family_member_id UUID REFERENCES family_members(id),
  subtotal         NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax              NUMERIC(10,2) NOT NULL DEFAULT 0,
  total            NUMERIC(10,2) NOT NULL DEFAULT 0,
  paid             BOOLEAN NOT NULL DEFAULT false,
  payment_mode     payment_mode,
  payment_time     TIMESTAMPTZ,
  payment_ref      TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  test_id    UUID REFERENCES test_catalogue(id),
  test_name  TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount   NUMERIC(10,2) NOT NULL DEFAULT 0,
  net_price  NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS samples (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_no        TEXT UNIQUE NOT NULL,
  invoice_id       UUID REFERENCES invoices(id),
  patient_id       UUID REFERENCES patients(id),
  family_member_id UUID REFERENCES family_members(id),
  collection_type  collect_type NOT NULL DEFAULT 'Walk-in',
  status           sample_status NOT NULL DEFAULT 'Pending',
  priority         priority_level NOT NULL DEFAULT 'Normal',
  collected_at     TIMESTAMPTZ,
  collected_by     UUID REFERENCES users(id),
  processed_by     UUID REFERENCES users(id),
  referred_by      TEXT,
  barcode          TEXT UNIQUE,
  notes            TEXT,
  home_address     TEXT,
  home_slot        TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_samples_patient ON samples(patient_id);
CREATE INDEX IF NOT EXISTS idx_samples_status  ON samples(status);

CREATE TABLE IF NOT EXISTS sample_tests (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id  UUID REFERENCES samples(id) ON DELETE CASCADE,
  test_id    UUID REFERENCES test_catalogue(id),
  status     sample_status NOT NULL DEFAULT 'Pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sample_status_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id   UUID REFERENCES samples(id) ON DELETE CASCADE,
  from_status sample_status,
  to_status   sample_status NOT NULL,
  changed_by  UUID REFERENCES users(id),
  notes       TEXT,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id        UUID REFERENCES samples(id) ON DELETE CASCADE,
  test_id          UUID REFERENCES test_catalogue(id),
  technician_id    UUID REFERENCES users(id),
  pathologist_id   UUID REFERENCES users(id),
  tech_notes       TEXT,
  pathologist_note TEXT,
  is_signed        BOOLEAN NOT NULL DEFAULT false,
  signed_at        TIMESTAMPTZ,
  is_dispatched    BOOLEAN NOT NULL DEFAULT false,
  dispatched_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sample_id, test_id)
);

CREATE TABLE IF NOT EXISTS report_results (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id    UUID REFERENCES reports(id) ON DELETE CASCADE,
  parameter_id UUID REFERENCES test_parameters(id),
  param_name   TEXT NOT NULL,
  value        TEXT NOT NULL,
  unit         TEXT,
  flag         param_flag NOT NULL DEFAULT 'Normal',
  ref_range    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  type       notif_type NOT NULL DEFAULT 'system',
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  is_read    BOOLEAN NOT NULL DEFAULT false,
  sent_sms   BOOLEAN NOT NULL DEFAULT false,
  sent_email BOOLEAN NOT NULL DEFAULT false,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id);

CREATE TABLE IF NOT EXISTS home_collections (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id        UUID REFERENCES samples(id),
  patient_id       UUID REFERENCES patients(id),
  address          TEXT NOT NULL,
  scheduled_date   DATE NOT NULL,
  scheduled_slot   TEXT NOT NULL,
  phlebotomist_id  UUID REFERENCES users(id),
  status           TEXT NOT NULL DEFAULT 'Scheduled',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['users','patients','invoices','samples','reports']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_updated_%1$s ON %1$s;
       CREATE TRIGGER trg_updated_%1$s
       BEFORE UPDATE ON %1$s FOR EACH ROW EXECUTE FUNCTION set_updated_at();', tbl);
  END LOOP;
END $$;

CREATE SEQUENCE IF NOT EXISTS seq_patient_no START 1;
CREATE SEQUENCE IF NOT EXISTS seq_invoice_no START 1;
CREATE SEQUENCE IF NOT EXISTS seq_sample_no  START 1;
CREATE SEQUENCE IF NOT EXISTS seq_staff_no   START 1;
