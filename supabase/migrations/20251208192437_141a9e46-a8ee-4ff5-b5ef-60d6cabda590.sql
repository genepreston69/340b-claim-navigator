-- Create filter options view for adjudication_status
CREATE VIEW public.adjudication_filter_options 
WITH (security_invoker = true) AS
SELECT 
  'pharmacy' as filter_type,
  pharmacy_name as filter_value
FROM adjudication_status
WHERE pharmacy_name IS NOT NULL
GROUP BY pharmacy_name
UNION ALL
SELECT 
  'status' as filter_type,
  adjudication_status as filter_value
FROM adjudication_status
WHERE adjudication_status IS NOT NULL
GROUP BY adjudication_status
ORDER BY filter_type, filter_value;

-- Create filter options view for prescription_adherence_analysis
CREATE VIEW public.adherence_filter_options 
WITH (security_invoker = true) AS
SELECT 
  'status' as filter_type,
  adherence_status as filter_value
FROM prescription_adherence_analysis
WHERE adherence_status IS NOT NULL
GROUP BY adherence_status
UNION ALL
SELECT 
  'time_category' as filter_type,
  time_to_fill_category as filter_value
FROM prescription_adherence_analysis
WHERE time_to_fill_category IS NOT NULL
GROUP BY time_to_fill_category
ORDER BY filter_type, filter_value;