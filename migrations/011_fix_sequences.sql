-- Fix staff_no sequence out of sync
SELECT setval('seq_staff_no', (SELECT MAX(CAST(SPLIT_PART(staff_no, '-', 2) AS INTEGER)) FROM staff WHERE staff_no LIKE 'STF-%'), true);

-- Fix other sequences too just in case
SELECT setval('seq_patient_no', COALESCE((SELECT MAX(CAST(SPLIT_PART(patient_no, '-', 2) AS INTEGER)) FROM patients WHERE patient_no LIKE 'PAT-%'), 0) + 1, false);

SELECT setval('seq_invoice_no', COALESCE((SELECT MAX(CAST(SPLIT_PART(invoice_no, '-', 4) AS INTEGER)) FROM invoices WHERE invoice_no LIKE 'INV-%'), 0) + 1, false);

SELECT setval('seq_sample_no', COALESCE((SELECT MAX(CAST(SPLIT_PART(sample_no, '-', 4) AS INTEGER)) FROM samples WHERE sample_no LIKE 'SMP-%'), 0) + 1, false);

SELECT setval('seq_report_no', COALESCE((SELECT MAX(CAST(SPLIT_PART(report_no, '-', 4) AS INTEGER)) FROM reports WHERE report_no LIKE 'RPT-%'), 0) + 1, false);