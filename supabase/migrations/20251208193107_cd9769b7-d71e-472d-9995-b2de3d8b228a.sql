-- Enable RLS on the views and add read policies for authenticated users
-- Note: Views in PostgreSQL don't have RLS directly, but they inherit from base tables
-- The issue is these are materialized as views, so we need to ensure the security definer is set

-- For views, we need to grant SELECT permissions to authenticated users
-- The views are already in the public schema, so we just need to ensure access

GRANT SELECT ON monthly_financial_summary TO authenticated;
GRANT SELECT ON monthly_pharmacy_summary TO authenticated;
GRANT SELECT ON monthly_payer_summary TO authenticated;
GRANT SELECT ON adherence_filter_options TO authenticated;
GRANT SELECT ON adjudication_filter_options TO authenticated;
GRANT SELECT ON adjudication_status TO authenticated;
GRANT SELECT ON claims_filter_options TO authenticated;
GRANT SELECT ON drug_adherence_summary TO authenticated;
GRANT SELECT ON drug_pharmacy_comparison TO authenticated;
GRANT SELECT ON monthly_adherence_trends TO authenticated;
GRANT SELECT ON pharmacy_contract_compliance TO authenticated;
GRANT SELECT ON physician_capture_rates TO authenticated;
GRANT SELECT ON prescription_adherence_analysis TO authenticated;