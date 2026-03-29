-- Fix existing samples that have no sample_tests records
-- Link tests from invoice_items back to sample_tests

INSERT INTO sample_tests (sample_id, test_id)
SELECT DISTINCT s.id AS sample_id, ii.test_id
FROM samples s
JOIN invoices inv ON inv.id = s.invoice_id
JOIN invoice_items ii ON ii.invoice_id = inv.id
WHERE ii.test_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sample_tests st
    WHERE st.sample_id = s.id AND st.test_id = ii.test_id
  );