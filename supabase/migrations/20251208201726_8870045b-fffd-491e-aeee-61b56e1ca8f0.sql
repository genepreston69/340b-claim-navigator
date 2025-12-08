-- Drop the existing view
DROP VIEW IF EXISTS public.pharmacy_contract_compliance;

-- Create new view that identifies pharmacies with prescriptions that are NOT contracted
CREATE OR REPLACE VIEW public.pharmacy_contract_compliance AS
WITH prescription_pharmacies AS (
  -- Get all pharmacies from prescriptions (written 60+ days ago to allow adjudication time)
  SELECT DISTINCT
    p.pharmacy_id,
    ph.pharmacy_name,
    ph.chain_pharmacy,
    ph.nabp_number,
    ph.npi_number
  FROM prescriptions p
  JOIN pharmacies ph ON p.pharmacy_id = ph.id
  WHERE p.prescribed_date <= CURRENT_DATE - INTERVAL '60 days'
    AND p.pharmacy_id IS NOT NULL
),
pharmacy_metrics AS (
  SELECT
    pp.pharmacy_id,
    pp.pharmacy_name,
    pp.chain_pharmacy,
    pp.nabp_number,
    pp.npi_number,
    -- Prescription metrics
    COUNT(DISTINCT pr.id) AS prescriptions_written,
    COUNT(DISTINCT pr.patient_id) AS patients_with_scripts,
    COUNT(DISTINCT pr.prescriber_id) AS prescribers_writing,
    MIN(pr.prescribed_date) AS first_prescription_date,
    MAX(pr.prescribed_date) AS last_prescription_date,
    -- Claim metrics
    COUNT(DISTINCT c.id) AS total_claims,
    COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN pr.id END) AS prescriptions_filled,
    COALESCE(SUM(c.total_payment), 0) AS total_payments,
    COALESCE(SUM(c.drug_cost_340b), 0) AS total_340b_cost,
    COALESCE(SUM(c.retail_drug_cost), 0) AS total_retail_cost,
    COALESCE(SUM(c.retail_drug_cost) - SUM(c.drug_cost_340b), 0) AS gross_savings,
    MIN(c.fill_date) AS first_claim_date,
    MAX(c.fill_date) AS last_claim_date,
    COUNT(DISTINCT c.drug_id) AS unique_drugs_dispensed,
    COUNT(DISTINCT c.prescriber_id) AS unique_prescribers_served,
    -- Check if pharmacy is contracted (match by name or nabp)
    MAX(CASE WHEN cp.id IS NOT NULL THEN 1 ELSE 0 END) AS is_contracted
  FROM prescription_pharmacies pp
  LEFT JOIN prescriptions pr ON pr.pharmacy_id = pp.pharmacy_id
    AND pr.prescribed_date <= CURRENT_DATE - INTERVAL '60 days'
  LEFT JOIN claims c ON c.pharmacy_id = pp.pharmacy_id
  LEFT JOIN contract_pharmacies cp ON UPPER(TRIM(pp.pharmacy_name)) = UPPER(TRIM(cp.pharmacy_name))
    OR pp.nabp_number = cp.pharmacy_id
  GROUP BY pp.pharmacy_id, pp.pharmacy_name, pp.chain_pharmacy, pp.nabp_number, pp.npi_number
)
SELECT
  pm.pharmacy_id,
  pm.pharmacy_name,
  pm.chain_pharmacy,
  pm.nabp_number,
  pm.npi_number,
  pm.prescriptions_written,
  pm.patients_with_scripts,
  pm.prescribers_writing,
  pm.first_prescription_date,
  pm.last_prescription_date,
  pm.total_claims,
  pm.prescriptions_filled,
  pm.total_payments,
  pm.total_340b_cost,
  pm.total_retail_cost,
  pm.gross_savings,
  pm.first_claim_date,
  pm.last_claim_date,
  pm.unique_drugs_dispensed,
  pm.unique_prescribers_served,
  -- Capture rate calculation
  CASE 
    WHEN pm.prescriptions_written > 0 
    THEN ROUND((pm.prescriptions_filled::numeric / pm.prescriptions_written::numeric) * 100, 2)
    ELSE 0 
  END AS capture_rate_pct,
  -- Estimated lost revenue (prescriptions not filled * avg payment)
  CASE 
    WHEN pm.total_claims > 0 
    THEN ROUND((pm.prescriptions_written - pm.prescriptions_filled) * (pm.total_payments / NULLIF(pm.total_claims, 0)), 2)
    ELSE 0 
  END AS estimated_lost_revenue,
  -- Days since last claim
  CASE 
    WHEN pm.last_claim_date IS NOT NULL 
    THEN (CURRENT_DATE - pm.last_claim_date)::integer
    ELSE NULL 
  END AS days_since_last_claim,
  -- Contract status based on contract_pharmacies table
  CASE 
    WHEN pm.is_contracted = 1 THEN 'Contracted'
    ELSE 'Not Contracted'
  END AS contract_status
FROM pharmacy_metrics pm
WHERE pm.is_contracted = 0  -- Only show non-contracted pharmacies
ORDER BY pm.prescriptions_written DESC;