-- Drop dependent views first, then recreate with correct matching logic
DROP VIEW IF EXISTS adherence_filter_options;
DROP VIEW IF EXISTS monthly_adherence_trends;
DROP VIEW IF EXISTS drug_adherence_summary;
DROP VIEW IF EXISTS prescription_adherence_analysis CASCADE;

-- Recreate prescription_adherence_analysis with correct matching logic
-- Match prescriptions to claims via patient MRN + NDC code
CREATE VIEW prescription_adherence_analysis 
WITH (security_invoker = true) AS
WITH prescription_fills AS (
  SELECT 
    p.id AS prescription_id,
    p.prescription_identifier,
    p.prescribed_date,
    p.patient_id,
    p.patient_mrn,
    p.drug_id,
    p.ndc_code,
    p.medication_name,
    p.days_supply AS prescribed_days_supply,
    p.refills_authorized,
    p.prescriber_id,
    p.pharmacy_id,
    (pat.first_name || ' ' || pat.last_name) AS patient_name,
    d.drug_name AS drug_display_name,
    COUNT(c.id) AS total_fills,
    COALESCE(SUM(c.days_supply), 0) AS total_days_supplied,
    MIN(c.fill_date) AS first_fill_date,
    MAX(c.fill_date) AS last_fill_date,
    MIN(c.fill_date) - p.prescribed_date AS days_to_first_fill,
    COALESCE(SUM(c.total_payment), 0) AS total_payments,
    COALESCE(SUM(c.drug_cost_340b), 0) AS total_340b_cost
  FROM prescriptions p
  LEFT JOIN patients pat ON p.patient_id = pat.id
  LEFT JOIN drugs d ON p.drug_id = d.id
  LEFT JOIN claims c ON 
    p.patient_mrn = c.medical_record_number 
    AND p.ndc_code = c.ndc::text
    AND c.fill_date >= p.prescribed_date
  GROUP BY 
    p.id, p.prescription_identifier, p.prescribed_date, p.patient_id, p.patient_mrn,
    p.drug_id, p.ndc_code, p.medication_name, p.days_supply, p.refills_authorized,
    p.prescriber_id, p.pharmacy_id, pat.first_name, pat.last_name, d.drug_name
)
SELECT 
  prescription_id,
  prescription_identifier,
  prescribed_date,
  patient_id,
  patient_mrn,
  patient_name,
  drug_id,
  ndc_code,
  COALESCE(drug_display_name, medication_name) AS drug_name,
  prescribed_days_supply,
  refills_authorized,
  prescriber_id,
  pharmacy_id,
  total_fills,
  total_days_supplied,
  first_fill_date,
  last_fill_date,
  days_to_first_fill,
  total_payments,
  total_340b_cost,
  (COALESCE(refills_authorized, 0) + 1) AS expected_fills,
  CASE 
    WHEN (COALESCE(refills_authorized, 0) + 1) > 0 
    THEN ROUND(total_fills::numeric / (COALESCE(refills_authorized, 0) + 1)::numeric * 100, 1)
    ELSE 0 
  END AS fill_rate_pct,
  CASE 
    WHEN total_fills = 0 THEN 'Never Filled'
    WHEN total_fills < (COALESCE(refills_authorized, 0) + 1) THEN 'Partially Adherent'
    ELSE 'Fully Adherent'
  END AS adherence_status,
  CASE 
    WHEN days_to_first_fill IS NULL THEN 'Never Filled'
    WHEN days_to_first_fill <= 3 THEN 'Prompt (0-3 days)'
    WHEN days_to_first_fill <= 7 THEN 'Normal (4-7 days)'
    WHEN days_to_first_fill <= 14 THEN 'Delayed (8-14 days)'
    ELSE 'Very Delayed (>14 days)'
  END AS time_to_fill_category
FROM prescription_fills;

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
  date_trunc('month', prescribed_date)::date AS month,
  COUNT(*) AS total_prescriptions,
  COUNT(*) FILTER (WHERE total_fills > 0) AS prescriptions_filled,
  SUM(total_fills) AS total_claims,
  COUNT(DISTINCT patient_id) AS unique_patients,
  COUNT(DISTINCT prescriber_id) AS unique_prescribers,
  COUNT(DISTINCT pharmacy_id) AS unique_pharmacies,
  ROUND(AVG(fill_rate_pct), 1) AS fill_rate_pct,
  ROUND(AVG(days_to_first_fill) FILTER (WHERE days_to_first_fill IS NOT NULL), 1) AS avg_days_to_fill,
  COALESCE(SUM(total_payments), 0) AS total_payments,
  COALESCE(SUM(total_340b_cost), 0) AS total_340b_cost,
  COALESCE(SUM(total_payments), 0) - COALESCE(SUM(total_340b_cost), 0) AS gross_savings,
  0 AS total_retail_cost
FROM prescription_adherence_analysis
WHERE prescribed_date IS NOT NULL
GROUP BY date_trunc('month', prescribed_date)
ORDER BY month;

-- Recreate drug_adherence_summary view  
CREATE VIEW drug_adherence_summary 
WITH (security_invoker = true) AS
SELECT 
  drug_id,
  drug_name,
  ndc_code,
  NULL AS manufacturer_name,
  COUNT(*) AS total_prescriptions,
  SUM(total_fills) AS total_claims,
  COUNT(DISTINCT patient_id) AS unique_patients,
  COUNT(DISTINCT prescriber_id) AS unique_prescribers,
  COUNT(DISTINCT pharmacy_id) AS pharmacies_dispensing,
  SUM(total_days_supplied) AS total_qty_dispensed,
  ROUND(AVG(fill_rate_pct), 1) AS fill_rate_pct,
  ROUND(AVG(days_to_first_fill) FILTER (WHERE days_to_first_fill IS NOT NULL), 1) AS avg_days_to_fill,
  COALESCE(SUM(total_payments), 0) AS total_payments,
  COALESCE(SUM(total_340b_cost), 0) AS total_340b_cost,
  0 AS total_retail_cost,
  COALESCE(SUM(total_payments), 0) - COALESCE(SUM(total_340b_cost), 0) AS gross_savings,
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