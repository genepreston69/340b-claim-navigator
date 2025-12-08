-- Drop the existing slow view
DROP VIEW IF EXISTS public.pharmacy_contract_compliance;

-- Create a much simpler and faster view
CREATE OR REPLACE VIEW public.pharmacy_contract_compliance AS
SELECT
  ph.id AS pharmacy_id,
  ph.pharmacy_name,
  ph.chain_pharmacy,
  ph.nabp_number,
  ph.npi_number,
  COUNT(DISTINCT p.id) AS prescriptions_written,
  COUNT(DISTINCT p.patient_id) AS patients_with_scripts,
  COUNT(DISTINCT p.prescriber_id) AS prescribers_writing,
  MIN(p.prescribed_date) AS first_prescription_date,
  MAX(p.prescribed_date) AS last_prescription_date,
  'Not Contracted' AS contract_status
FROM pharmacies ph
INNER JOIN prescriptions p ON p.pharmacy_id = ph.id
  AND p.prescribed_date <= CURRENT_DATE - INTERVAL '60 days'
WHERE NOT EXISTS (
  SELECT 1 FROM contract_pharmacies cp 
  WHERE UPPER(TRIM(ph.pharmacy_name)) = UPPER(TRIM(cp.pharmacy_name))
)
GROUP BY ph.id, ph.pharmacy_name, ph.chain_pharmacy, ph.nabp_number, ph.npi_number
ORDER BY COUNT(DISTINCT p.id) DESC;