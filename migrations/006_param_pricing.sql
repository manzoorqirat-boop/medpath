-- Add price to test_parameters
ALTER TABLE test_parameters
  ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Track which specific parameters were selected per sample
CREATE TABLE IF NOT EXISTS sample_test_params (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sample_id  UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
  test_id    UUID NOT NULL REFERENCES test_catalogue(id),
  param_id   UUID NOT NULL REFERENCES test_parameters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sample_id, param_id)
);
CREATE INDEX IF NOT EXISTS idx_stp_sample ON sample_test_params(sample_id);