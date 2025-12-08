-- Drop and recreate the view without SECURITY DEFINER
-- Views by default use SECURITY INVOKER which respects caller's RLS
DROP VIEW IF EXISTS public.claims_filter_options;

CREATE VIEW public.claims_filter_options 
WITH (security_invoker = true) AS
SELECT 
  'pharmacy' as filter_type,
  pharmacy_name as filter_value
FROM claims
WHERE pharmacy_name IS NOT NULL
GROUP BY pharmacy_name
UNION ALL
SELECT 
  'claim_type' as filter_type,
  claim_type as filter_value
FROM claims
WHERE claim_type IS NOT NULL
GROUP BY claim_type
UNION ALL
SELECT 
  'reason' as filter_type,
  reason as filter_value
FROM claims
WHERE reason IS NOT NULL
GROUP BY reason
ORDER BY filter_type, filter_value;