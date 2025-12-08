-- Create a view for distinct filter options (full dataset)
CREATE OR REPLACE VIEW public.claims_filter_options AS
SELECT 
  'pharmacy' as filter_type,
  pharmacy_name as filter_value
FROM claims
WHERE pharmacy_name IS NOT NULL
GROUP BY pharmacy_name
UNION ALL
SELECT 
  'claim_type' as filter_type,
  claim_type as filter_value
FROM claims
WHERE claim_type IS NOT NULL
GROUP BY claim_type
UNION ALL
SELECT 
  'reason' as filter_type,
  reason as filter_value
FROM claims
WHERE reason IS NOT NULL
GROUP BY reason
ORDER BY filter_type, filter_value;

-- Create index to speed up filtering queries
CREATE INDEX IF NOT EXISTS idx_claims_fill_date ON claims(fill_date DESC);
CREATE INDEX IF NOT EXISTS idx_claims_pharmacy_name ON claims(pharmacy_name);
CREATE INDEX IF NOT EXISTS idx_claims_claim_type ON claims(claim_type);
CREATE INDEX IF NOT EXISTS idx_claims_reason ON claims(reason);
CREATE INDEX IF NOT EXISTS idx_claims_drug_name ON claims(drug_name);
CREATE INDEX IF NOT EXISTS idx_claims_prescription_number ON claims(prescription_number);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_claims_date_pharmacy ON claims(fill_date DESC, pharmacy_name);

-- Add RLS policy for the view (inherits from claims table)
-- Views automatically inherit RLS from underlying tables