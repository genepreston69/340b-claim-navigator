-- Grant SELECT on all analytics views to authenticated users
GRANT SELECT ON public.physician_capture_rates TO authenticated;
GRANT SELECT ON public.pharmacy_contract_compliance TO authenticated;
GRANT SELECT ON public.drug_pharmacy_comparison TO authenticated;
GRANT SELECT ON public.prescription_adherence_analysis TO authenticated;
GRANT SELECT ON public.drug_adherence_summary TO authenticated;
GRANT SELECT ON public.monthly_adherence_trends TO authenticated;
GRANT SELECT ON public.adherence_metrics_summary TO authenticated;
GRANT SELECT ON public.adherence_filter_options TO authenticated;
GRANT SELECT ON public.adjudication_status TO authenticated;
GRANT SELECT ON public.adjudication_filter_options TO authenticated;
GRANT SELECT ON public.claims_filter_options TO authenticated;
GRANT SELECT ON public.monthly_financial_summary TO authenticated;
GRANT SELECT ON public.monthly_payer_summary TO authenticated;
GRANT SELECT ON public.monthly_pharmacy_summary TO authenticated;