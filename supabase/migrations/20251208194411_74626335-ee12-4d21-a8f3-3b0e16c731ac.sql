-- Rebuild adherence views based on CLAIMS data (not prescriptions)
-- Find first script fill and track subsequent refills

DROP VIEW IF EXISTS adherence_filter_options;
DROP VIEW IF EXISTS monthly_adherence_trends;
DROP VIEW IF EXISTS drug_adherence_summary;
DROP VIEW IF EXISTS prescription_adherence_analysis CASCADE;

-- Create prescription_adherence_analysis based on claims data
-- Groups claims by prescription_number to track original fill + refills
CREATE VIEW prescription_adherence_analysis 
WITH (security_invoker = true) AS
WITH claim_summary AS (
  SELECT 
    c.prescription_number,
    c.date_rx_written AS prescribed_date,
    c.medical_record_number AS patient_mrn,
    c.first_name || ' ' || c.last_name AS patient_name,
    c.drug_id,
    c.ndc::text AS ndc_code,
    c.drug_name,
    c.prescriber_id,
    c.prescriber_name,
    c.pharmacy_id,
    c.pharmacy_name,
    COUNT(*) AS total_fills,
    MAX(c.refill_number) AS max_refill_number,
    COALESCE(SUM(c.days_supply), 0) AS total_days_supplied,
    MIN(c.fill_date) AS first_fill_date,
    MAX(c.fill_date) AS last_fill_date,
    MIN(c.fill_date) - c.date_rx_written AS days_to_first_fill,
    COALESCE(SUM(c.total_payment), 0) AS total_payments,
    COALESCE(SUM(c.drug_cost_340b), 0) AS total_340b_cost,
    COALESCE(SUM(c.retail_drug_cost), 0) AS total_retail_cost,
    COALESCE(SUM(c.profit_or_loss), 0) AS total_benefit_340b
  FROM claims c
  WHERE c.prescription_number IS NOT NULL
  GROUP BY 
    c.prescription_number, c.date_rx_written, c.medical_record_number,
    c.first_name, c.last_name, c.drug_id, c.ndc, c.drug_name,
    c.prescriber_id, c.prescriber_name, c.pharmacy_id, c.pharmacy_name
)
SELECT 
  gen_random_uuid() AS prescription_id,
  prescription_number AS prescription_identifier,
  prescribed_date,
  NULL::uuid AS patient_id,
  patient_mrn,
  patient_name,
  drug_id,
  ndc_code,
  drug_name,
  NULL::integer AS prescribed_days_supply,
  max_refill_number AS refills_authorized,
  prescriber_id,
  pharmacy_id,
  total_fills,
  total_days_supplied,
  first_fill_date,
  last_fill_date,
  days_to_first_fill,
  total_payments,
  total_340b_cost,
  total_retail_cost,
  total_benefit_340b,
  (max_refill_number + 1) AS expected_fills,
  CASE 
    WHEN (max_refill_number + 1) > 0 
    THEN ROUND(total_fills::numeric / (max_refill_number + 1)::numeric * 100, 1)
    ELSE 100 
  END AS fill_rate_pct,
  CASE 
    WHEN total_fills >= (max_refill_number + 1) THEN 'Fully Adherent'
    WHEN total_fills > 0 AND total_fills < (max_refill_number + 1) THEN 'Partially Adherent'
    ELSE 'Never Filled'
  END AS adherence_status,
  CASE 
    WHEN days_to_first_fill IS NULL THEN 'Never Filled'
    WHEN days_to_first_fill <= 3 THEN 'Prompt (0-3 days)'
    WHEN days_to_first_fill <= 7 THEN 'Normal (4-7 days)'
    WHEN days_to_first_fill <= 14 THEN 'Delayed (8-14 days)'
    ELSE 'Very Delayed (>14 days)'
  END AS time_to_fill_category
FROM claim_summary;

-- Recreate adherence_filter_options view
CREATE VIEW adherence_filter_options 
WITH (security_invoker = true) AS
SELECT DISTINCT 'status' AS filter_type, adherence_status AS filter_value
FROM prescription_adherence_analysis
WHERE adherence_status IS NOT NULL
UNION ALL
SELECT DISTINCT 'time_category' AS filter_type, time_to_fill_category AS filter_value
FROM prescription_adherence_analysis
WHERE time_to_fill_category IS NOT NULL;

-- Recreate monthly_adherence_trends view
CREATE VIEW monthly_adherence_trends 
WITH (security_invoker = true) AS
SELECT 
  date_trunc('month', first_fill_date)::date AS month,
  COUNT(*) AS total_prescriptions,
  COUNT(*) FILTER (WHERE total_fills > 0) AS prescriptions_filled,
  SUM(total_fills) AS total_claims,
  COUNT(DISTINCT patient_mrn) AS unique_patients,
  COUNT(DISTINCT prescriber_id) AS unique_prescribers,
  COUNT(DISTINCT pharmacy_id) AS unique_pharmacies,
  ROUND(AVG(fill_rate_pct), 1) AS fill_rate_pct,
  ROUND(AVG(days_to_first_fill) FILTER (WHERE days_to_first_fill IS NOT NULL), 1) AS avg_days_to_fill,
  COALESCE(SUM(total_payments), 0) AS total_payments,
  COALESCE(SUM(total_340b_cost), 0) AS total_340b_cost,
  COALESCE(SUM(total_retail_cost), 0) AS total_retail_cost,
  COALESCE(SUM(total_payments - total_340b_cost), 0) AS gross_savings
FROM prescription_adherence_analysis
WHERE first_fill_date IS NOT NULL
GROUP BY date_trunc('month', first_fill_date)
ORDER BY month;

-- Recreate drug_adherence_summary view  
CREATE VIEW drug_adherence_summary 
WITH (security_invoker = true) AS
SELECT 
  drug_id,
  drug_name,
  ndc_code,
  NULL::varchar AS manufacturer_name,
  COUNT(*) AS total_prescriptions,
  SUM(total_fills) AS total_claims,
  COUNT(DISTINCT patient_mrn) AS unique_patients,
  COUNT(DISTINCT prescriber_id) AS unique_prescribers,
  COUNT(DISTINCT pharmacy_id) AS pharmacies_dispensing,
  SUM(total_days_supplied) AS total_qty_dispensed,
  ROUND(AVG(fill_rate_pct), 1) AS fill_rate_pct,
  ROUND(AVG(days_to_first_fill) FILTER (WHERE days_to_first_fill IS NOT NULL), 1) AS avg_days_to_fill,
  COALESCE(SUM(total_payments), 0) AS total_payments,
  COALESCE(SUM(total_340b_cost), 0) AS total_340b_cost,
  COALESCE(SUM(total_retail_cost), 0) AS total_retail_cost,
  COALESCE(SUM(total_payments - total_340b_cost), 0) AS gross_savings,
  CASE WHEN SUM(total_fills) > 0 
    THEN ROUND(SUM(total_340b_cost) / SUM(total_fills), 2) 
    ELSE 0 
  END AS avg_340b_cost_per_claim,
  CASE WHEN SUM(total_fills) > 0 
    THEN ROUND(SUM(total_payments) / SUM(total_fills), 2) 
    ELSE 0 
  END AS avg_payment_per_claim
FROM prescription_adherence_analysis
WHERE drug_name IS NOT NULL
GROUP BY drug_id, drug_name, ndc_code
ORDER BY total_prescriptions DESC;

-- Grant permissions
GRANT SELECT ON prescription_adherence_analysis TO authenticated;
GRANT SELECT ON adherence_filter_options TO authenticated;
GRANT SELECT ON monthly_adherence_trends TO authenticated;
GRANT SELECT ON drug_adherence_summary TO authenticated;