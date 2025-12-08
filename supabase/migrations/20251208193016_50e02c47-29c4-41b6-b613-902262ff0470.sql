-- Add unique constraint on claims to prevent duplicate imports
-- This ensures the same claim (prescription + refill + fill_date) cannot be imported twice
CREATE UNIQUE INDEX IF NOT EXISTS idx_claims_unique_rx_refill_date 
ON claims (prescription_number, refill_number, fill_date);