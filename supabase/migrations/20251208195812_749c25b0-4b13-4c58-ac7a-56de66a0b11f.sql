-- Drop and recreate the pharmacy_contract_compliance view to only include prescriptions 
-- written at least 60 days ago (giving time for claims to be adjudicated by the processor)
DROP VIEW IF EXISTS pharmacy_contract_compliance;

CREATE OR REPLACE VIEW pharmacy_contract_compliance AS
WITH pharmacy_scripts AS (
    -- Only look at prescriptions written at least 60 days ago
    SELECT 
        ph.id AS pharmacy_id,
        ph.pharmacy_name,
        ph.chain_pharmacy,
        ph.npi_number,
        ph.nabp_number,
        count(DISTINCT p.id) AS prescriptions_written,
        count(DISTINCT p.patient_id) AS unique_patients,
        count(DISTINCT p.prescriber_id) AS unique_prescribers,
        min(p.prescribed_date) AS first_prescription_date,
        max(p.prescribed_date) AS last_prescription_date
    FROM pharmacies ph
    LEFT JOIN prescriptions p ON ph.id = p.pharmacy_id 
        AND p.prescribed_date <= (CURRENT_DATE - INTERVAL '60 days')
    GROUP BY ph.id, ph.pharmacy_name, ph.chain_pharmacy, ph.npi_number, ph.nabp_number
), pharmacy_claims AS (
    SELECT 
        c.pharmacy_id,
        ph.pharmacy_name,
        count(DISTINCT c.id) AS total_claims,
        count(DISTINCT c.prescription_number) AS prescriptions_filled,
        sum(c.total_payment) AS total_payments,
        sum(c.drug_cost_340b) AS total_340b_cost,
        sum(c.retail_drug_cost) AS total_retail_cost,
        min(c.fill_date) AS first_claim_date,
        max(c.fill_date) AS last_claim_date,
        count(DISTINCT c.drug_id) AS unique_drugs_dispensed,
        count(DISTINCT c.prescriber_id) AS unique_prescribers_served
    FROM claims c
    LEFT JOIN pharmacies ph ON c.pharmacy_id = ph.id
    GROUP BY c.pharmacy_id, ph.pharmacy_name
)
SELECT 
    ps.pharmacy_id,
    ps.pharmacy_name,
    ps.chain_pharmacy,
    ps.npi_number,
    ps.nabp_number,
    ps.prescriptions_written,
    ps.unique_patients AS patients_with_scripts,
    ps.unique_prescribers AS prescribers_writing,
    ps.first_prescription_date,
    ps.last_prescription_date,
    COALESCE(pc.total_claims, 0::bigint) AS total_claims,
    COALESCE(pc.prescriptions_filled, 0::bigint) AS prescriptions_filled,
    COALESCE(pc.total_payments, 0::numeric) AS total_payments,
    COALESCE(pc.total_340b_cost, 0::numeric) AS total_340b_cost,
    COALESCE(pc.total_retail_cost, 0::numeric) AS total_retail_cost,
    COALESCE(pc.total_retail_cost, 0::numeric) - COALESCE(pc.total_340b_cost, 0::numeric) AS gross_savings,
    pc.first_claim_date,
    pc.last_claim_date,
    COALESCE(pc.unique_drugs_dispensed, 0::bigint) AS unique_drugs_dispensed,
    COALESCE(pc.unique_prescribers_served, 0::bigint) AS unique_prescribers_served,
    CASE
        WHEN pc.total_claims IS NULL OR pc.total_claims = 0 THEN 'No Claims - Likely Uncontracted'::text
        WHEN pc.last_claim_date < (CURRENT_DATE - INTERVAL '90 days') THEN 'Inactive (No claims in 90 days)'::text
        WHEN ps.prescriptions_written > 0 AND (pc.prescriptions_filled::numeric / ps.prescriptions_written::numeric) < 0.1 THEN 'Low Activity - Review Needed'::text
        ELSE 'Active'::text
    END AS contract_status,
    CASE
        WHEN ps.prescriptions_written > 0 THEN round(COALESCE(pc.prescriptions_filled, 0::bigint)::numeric / ps.prescriptions_written::numeric * 100::numeric, 1)
        ELSE 0::numeric
    END AS capture_rate_pct,
    CASE
        WHEN ps.prescriptions_written > COALESCE(pc.prescriptions_filled, 0::bigint) AND pc.prescriptions_filled > 0 
        THEN (ps.prescriptions_written - pc.prescriptions_filled)::numeric * (pc.total_payments / pc.prescriptions_filled::numeric)
        ELSE 0::numeric
    END AS estimated_lost_revenue,
    CASE
        WHEN pc.last_claim_date IS NOT NULL THEN CURRENT_DATE - pc.last_claim_date
        ELSE NULL::integer
    END AS days_since_last_claim
FROM pharmacy_scripts ps
LEFT JOIN pharmacy_claims pc ON ps.pharmacy_id = pc.pharmacy_id;

-- Grant access to authenticated users
GRANT SELECT ON pharmacy_contract_compliance TO authenticated;