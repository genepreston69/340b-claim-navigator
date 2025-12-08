-- Monthly financial summary view (total across all pharmacies)
CREATE OR REPLACE VIEW public.monthly_financial_summary AS
SELECT 
  DATE_TRUNC('month', fill_date)::date AS month,
  COUNT(*) AS total_claims,
  COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
  COALESCE(SUM(retail_drug_cost), 0) AS total_retail_cost,
  COALESCE(SUM(retail_drug_cost), 0) - COALESCE(SUM(drug_cost_340b), 0) AS gross_savings,
  COALESCE(SUM(total_payment), 0) AS total_payments,
  COALESCE(SUM(total_payment), 0) - COALESCE(SUM(drug_cost_340b), 0) AS net_margin,
  COALESCE(SUM(patient_pay), 0) AS total_patient_pay,
  COALESCE(SUM(third_party_payment), 0) AS total_third_party_payment,
  COALESCE(SUM(dispensing_fee), 0) AS total_dispensing_fees,
  COALESCE(AVG(days_supply), 0) AS avg_days_supply
FROM public.claims
WHERE fill_date IS NOT NULL
GROUP BY DATE_TRUNC('month', fill_date)
ORDER BY month DESC;

-- Monthly financial summary by pharmacy
CREATE OR REPLACE VIEW public.monthly_pharmacy_summary AS
SELECT 
  DATE_TRUNC('month', fill_date)::date AS month,
  pharmacy_id,
  pharmacy_name,
  COUNT(*) AS total_claims,
  COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
  COALESCE(SUM(retail_drug_cost), 0) AS total_retail_cost,
  COALESCE(SUM(retail_drug_cost), 0) - COALESCE(SUM(drug_cost_340b), 0) AS gross_savings,
  COALESCE(SUM(total_payment), 0) AS total_payments,
  COALESCE(SUM(total_payment), 0) - COALESCE(SUM(drug_cost_340b), 0) AS net_margin,
  COALESCE(SUM(patient_pay), 0) AS total_patient_pay,
  COALESCE(SUM(third_party_payment), 0) AS total_third_party_payment,
  COALESCE(AVG(CASE WHEN date_rx_written IS NOT NULL AND fill_date IS NOT NULL 
    THEN fill_date - date_rx_written ELSE NULL END), 0) AS avg_days_to_fill
FROM public.claims
WHERE fill_date IS NOT NULL
GROUP BY DATE_TRUNC('month', fill_date), pharmacy_id, pharmacy_name
ORDER BY month DESC, total_claims DESC;

-- Monthly payer mix summary
CREATE OR REPLACE VIEW public.monthly_payer_summary AS
SELECT 
  DATE_TRUNC('month', fill_date)::date AS month,
  COALESCE(reason, 'Unknown') AS payer_type,
  COUNT(*) AS claim_count,
  COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
  COALESCE(SUM(total_payment), 0) AS total_payments,
  COALESCE(AVG(total_payment), 0) AS avg_payment,
  COALESCE(AVG(drug_cost_340b), 0) AS avg_340b_cost
FROM public.claims
WHERE fill_date IS NOT NULL
GROUP BY DATE_TRUNC('month', fill_date), reason
ORDER BY month DESC, claim_count DESC;