-- Drop and recreate the pharmacy_contract_compliance view
-- Updated to only count prescriptions written within 60 days prior to the last prescription date
-- This accounts for claims filing lag time

DROP VIEW IF EXISTS public.pharmacy_contract_compliance;

CREATE OR REPLACE VIEW public.pharmacy_contract_compliance AS
WITH pharmacy_last_script AS (
  -- First, get the last prescription date for each pharmacy
  SELECT 
    pharmacy_id,
    MAX(prescribed_date) AS last_prescription_date
  FROM prescriptions
  GROUP BY pharmacy_id
),
pharmacy_scripts AS (
  SELECT 
    ph.id AS pharmacy_id,
    ph.pharmacy_name,
    ph.chain_pharmacy,
    ph.npi_number,
    ph.nabp_number,
    COUNT(DISTINCT p.id) AS prescriptions_written,
    COUNT(DISTINCT p.patient_id) AS unique_patients,
    COUNT(DISTINCT p.prescriber_id) AS unique_prescribers,
    MIN(p.prescribed_date) AS first_prescription_date,
    MAX(p.prescribed_date) AS last_prescription_date
  FROM pharmacies ph
  LEFT JOIN pharmacy_last_script pls ON ph.id = pls.pharmacy_id
  LEFT JOIN prescriptions p ON ph.id = p.pharmacy_id 
    AND p.prescribed_date >= (pls.last_prescription_date - INTERVAL '60 days')
  GROUP BY ph.id, ph.pharmacy_name, ph.chain_pharmacy, ph.npi_number, ph.nabp_number
),
pharmacy_claims AS (
  SELECT 
    c.pharmacy_id,
    ph.pharmacy_name,
    COUNT(DISTINCT c.id) AS total_claims,
    COUNT(DISTINCT c.prescription_number) AS prescriptions_filled,
    SUM(c.total_payment) AS total_payments,
    SUM(c.drug_cost_340b) AS total_340b_cost,
    SUM(c.retail_drug_cost) AS total_retail_cost,
    MIN(c.fill_date) AS first_claim_date,
    MAX(c.fill_date) AS last_claim_date,
    COUNT(DISTINCT c.drug_id) AS unique_drugs_dispensed,
    COUNT(DISTINCT c.prescriber_id) AS unique_prescribers_served
  FROM claims c
  LEFT JOIN pharmacies ph ON c.pharmacy_id = ph.id
  GROUP BY c.pharmacy_id, ph.pharmacy_name
)
SELECT 
  ps.pharmacy_id,
  ps.pharmacy_name,
  ps.chain_pharmacy,
  ps.npi_number,
  ps.nabp_number,
  ps.prescriptions_written,
  ps.unique_patients AS patients_with_scripts,
  ps.unique_prescribers AS prescribers_writing,
  ps.first_prescription_date,
  ps.last_prescription_date,
  COALESCE(pc.total_claims, 0) AS total_claims,
  COALESCE(pc.prescriptions_filled, 0) AS prescriptions_filled,
  COALESCE(pc.total_payments, 0) AS total_payments,
  COALESCE(pc.total_340b_cost, 0) AS total_340b_cost,
  COALESCE(pc.total_retail_cost, 0) AS total_retail_cost,
  COALESCE(pc.total_retail_cost, 0) - COALESCE(pc.total_340b_cost, 0) AS gross_savings,
  pc.first_claim_date,
  pc.last_claim_date,
  COALESCE(pc.unique_drugs_dispensed, 0) AS unique_drugs_dispensed,
  COALESCE(pc.unique_prescribers_served, 0) AS unique_prescribers_served,
  CASE 
    WHEN pc.total_claims IS NULL OR pc.total_claims = 0 THEN 'No Claims - Likely Uncontracted'
    WHEN pc.last_claim_date < (CURRENT_DATE - INTERVAL '90 days') THEN 'Inactive (No claims in 90 days)'
    WHEN ps.prescriptions_written > 0 AND (pc.prescriptions_filled::numeric / ps.prescriptions_written::numeric) < 0.1 THEN 'Low Activity - Review Needed'
    ELSE 'Active'
  END AS contract_status,
  CASE 
    WHEN ps.prescriptions_written > 0 THEN ROUND((COALESCE(pc.prescriptions_filled, 0)::numeric / ps.prescriptions_written::numeric) * 100, 1)
    ELSE 0
  END AS capture_rate_pct,
  CASE 
    WHEN ps.prescriptions_written > COALESCE(pc.prescriptions_filled, 0) AND pc.prescriptions_filled > 0 
    THEN (ps.prescriptions_written - pc.prescriptions_filled)::numeric * (pc.total_payments / pc.prescriptions_filled::numeric)
    ELSE 0
  END AS estimated_lost_revenue,
  CASE 
    WHEN pc.last_claim_date IS NOT NULL THEN CURRENT_DATE - pc.last_claim_date
    ELSE NULL
  END AS days_since_last_claim
FROM pharmacy_scripts ps
LEFT JOIN pharmacy_claims pc ON ps.pharmacy_id = pc.pharmacy_id;

-- Grant access to authenticated users
GRANT SELECT ON public.pharmacy_contract_compliance TO authenticated;