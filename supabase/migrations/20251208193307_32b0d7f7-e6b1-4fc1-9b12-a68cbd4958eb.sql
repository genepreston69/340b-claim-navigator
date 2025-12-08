-- Fix security definer view by setting security_invoker = true
-- This ensures RLS policies of the querying user are respected

DROP VIEW IF EXISTS monthly_financial_summary;

CREATE VIEW monthly_financial_summary 
WITH (security_invoker = true) AS
SELECT 
  date_trunc('month', fill_date)::date as month,
  COUNT(*) as total_claims,
  COALESCE(SUM(drug_cost_340b), 0) as total_340b_cost,
  COALESCE(SUM(retail_drug_cost), 0) as total_retail_cost,
  COALESCE(SUM(retail_drug_cost), 0) - COALESCE(SUM(drug_cost_340b), 0) as gross_savings,
  COALESCE(SUM(total_payment), 0) as total_payments,
  COALESCE(SUM(total_payment), 0) - COALESCE(SUM(drug_cost_340b), 0) - COALESCE(SUM(dispensing_fee), 0) as net_margin,
  COALESCE(SUM(patient_pay), 0) as total_patient_pay,
  COALESCE(SUM(third_party_payment), 0) as total_third_party_payment,
  COALESCE(SUM(dispensing_fee), 0) as total_dispensing_fees,
  AVG(days_supply) as avg_days_supply
FROM claims
WHERE fill_date IS NOT NULL
GROUP BY date_trunc('month', fill_date)
ORDER BY month;

GRANT SELECT ON monthly_financial_summary TO authenticated;