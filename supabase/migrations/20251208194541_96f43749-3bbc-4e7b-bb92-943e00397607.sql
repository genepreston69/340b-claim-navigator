-- Create a summary view for adherence metrics
CREATE VIEW adherence_metrics_summary 
WITH (security_invoker = true) AS
SELECT 
  COUNT(*) AS total_prescriptions,
  COUNT(*) FILTER (WHERE adherence_status = 'Fully Adherent') AS fully_adherent,
  COUNT(*) FILTER (WHERE adherence_status = 'Partially Adherent') AS partially_adherent,
  COUNT(*) FILTER (WHERE adherence_status = 'Never Filled') AS never_filled,
  ROUND(AVG(fill_rate_pct), 1) AS avg_fill_rate,
  COALESCE(SUM(total_payments), 0) AS total_payments,
  ROUND(AVG(days_to_first_fill) FILTER (WHERE days_to_first_fill IS NOT NULL), 1) AS avg_days_to_fill
FROM prescription_adherence_analysis;

GRANT SELECT ON adherence_metrics_summary TO authenticated;