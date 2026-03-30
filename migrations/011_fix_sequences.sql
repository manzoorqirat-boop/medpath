-- Fix all sequences safely using DO blocks

DO $$
DECLARE max_staff INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(staff_no,'-',2) AS INTEGER)),0)
  INTO max_staff FROM staff WHERE staff_no ~ '^STF-[0-9]+$';
  PERFORM setval('seq_staff_no', max_staff+1, false);
END $$;

DO $$
DECLARE max_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(patient_no,'-',2) AS INTEGER)),0)
  INTO max_val FROM patients WHERE patient_no ~ '^PAT-[0-9]+$';
  PERFORM setval('seq_patient_no', max_val+1, false);
END $$;

DO $$
DECLARE max_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_no,'-',3) AS INTEGER)),0)
  INTO max_val FROM invoices WHERE invoice_no ~ '^INV-[0-9]+-[0-9]+$';
  PERFORM setval('seq_invoice_no', max_val+1, false);
END $$;

DO $$
DECLARE max_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(sample_no,'-',3) AS INTEGER)),0)
  INTO max_val FROM samples WHERE sample_no ~ '^SMP-[0-9]+-[0-9]+$';
  PERFORM setval('seq_sample_no', max_val+1, false);
END $$;

DO $$
DECLARE max_val INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SPLIT_PART(report_no,'-',3) AS INTEGER)),0)
  INTO max_val FROM reports WHERE report_no ~ '^RPT-[0-9]+-[0-9]+$';
  PERFORM setval('seq_report_no', max_val+1, false);
END $$;