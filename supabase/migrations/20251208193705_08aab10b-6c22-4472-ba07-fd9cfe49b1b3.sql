-- Update monthly_financial_summary view to rename net_margin to benefit_340b
-- Calculation: payments - 340B drug cost - dispensing fees (equals profit_or_loss)

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
  COALESCE(SUM(total_payment), 0) - COALESCE(SUM(drug_cost_340b), 0) - COALESCE(SUM(dispensing_fee), 0) as benefit_340b,
  COALESCE(SUM(patient_pay), 0) as total_patient_pay,
  COALESCE(SUM(third_party_payment), 0) as total_third_party_payment,
  COALESCE(SUM(dispensing_fee), 0) as total_dispensing_fees,
  AVG(days_supply) as avg_days_supply
FROM claims
WHERE fill_date IS NOT NULL
GROUP BY date_trunc('month', fill_date)
ORDER BY month;

GRANT SELECT ON monthly_financial_summary TO authenticated;

-- Update monthly_pharmacy_summary view to rename net_margin to benefit_340b

DROP VIEW IF EXISTS monthly_pharmacy_summary;

CREATE VIEW monthly_pharmacy_summary
WITH (security_invoker = true) AS
SELECT 
  date_trunc('month', c.fill_date)::date as month,
  c.pharmacy_id,
  c.pharmacy_name,
  COUNT(*) as total_claims,
  COALESCE(SUM(c.drug_cost_340b), 0) as total_340b_cost,
  COALESCE(SUM(c.retail_drug_cost), 0) as total_retail_cost,
  COALESCE(SUM(c.retail_drug_cost), 0) - COALESCE(SUM(c.drug_cost_340b), 0) as gross_savings,
  COALESCE(SUM(c.total_payment), 0) as total_payments,
  COALESCE(SUM(c.total_payment), 0) - COALESCE(SUM(c.drug_cost_340b), 0) - COALESCE(SUM(c.dispensing_fee), 0) as benefit_340b,
  COALESCE(SUM(c.patient_pay), 0) as total_patient_pay,
  COALESCE(SUM(c.third_party_payment), 0) as total_third_party_payment,
  AVG(c.fill_date - c.date_rx_written) as avg_days_to_fill
FROM claims c
WHERE c.fill_date IS NOT NULL
GROUP BY date_trunc('month', c.fill_date), c.pharmacy_id, c.pharmacy_name
ORDER BY month DESC, total_claims DESC;

GRANT SELECT ON monthly_pharmacy_summary TO authenticated;