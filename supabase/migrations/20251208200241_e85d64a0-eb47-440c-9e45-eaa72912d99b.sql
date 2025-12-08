-- Fix capture rate calculation by properly matching claims to prescriptions
-- Only count prescriptions (not refills) that have at least one claim
DROP VIEW IF EXISTS pharmacy_contract_compliance;

CREATE OR REPLACE VIEW pharmacy_contract_compliance AS
WITH eligible_prescriptions AS (
    -- Prescriptions written at least 60 days ago
    SELECT 
        p.id AS prescription_id,
        p.prescription_identifier,
        p.pharmacy_id,
        p.patient_id,
        p.prescriber_id,
        p.prescribed_date
    FROM prescriptions p
    WHERE p.prescribed_date <= (CURRENT_DATE - INTERVAL '60 days')
),
prescription_fill_status AS (
    -- Check which eligible prescriptions have at least one claim
    SELECT 
        ep.prescription_id,
        ep.prescription_identifier,
        ep.pharmacy_id,
        ep.patient_id,
        ep.prescriber_id,
        ep.prescribed_date,
        CASE WHEN EXISTS (
            SELECT 1 FROM claims c 
            WHERE c.prescription_number = ep.prescription_identifier
        ) THEN 1 ELSE 0 END AS is_filled
    FROM eligible_prescriptions ep
),
pharmacy_scripts AS (
    SELECT 
        ph.id AS pharmacy_id,
        ph.pharmacy_name,
        ph.chain_pharmacy,
        ph.npi_number,
        ph.nabp_number,
        count(pfs.prescription_id) AS prescriptions_written,
        sum(pfs.is_filled) AS prescriptions_filled,
        count(DISTINCT pfs.patient_id) AS unique_patients,
        count(DISTINCT pfs.prescriber_id) AS unique_prescribers,
        min(pfs.prescribed_date) AS first_prescription_date,
        max(pfs.prescribed_date) AS last_prescription_date
    FROM pharmacies ph
    LEFT JOIN prescription_fill_status pfs ON ph.id = pfs.pharmacy_id
    GROUP BY ph.id, ph.pharmacy_name, ph.chain_pharmacy, ph.npi_number, ph.nabp_number
),
pharmacy_claims AS (
    -- Claims for eligible prescriptions only
    SELECT 
        c.pharmacy_id,
        count(DISTINCT c.id) AS total_claims,
        sum(c.total_payment) AS total_payments,
        sum(c.drug_cost_340b) AS total_340b_cost,
        sum(c.retail_drug_cost) AS total_retail_cost,
        min(c.fill_date) AS first_claim_date,
        max(c.fill_date) AS last_claim_date,
        count(DISTINCT c.drug_id) AS unique_drugs_dispensed,
        count(DISTINCT c.prescriber_id) AS unique_prescribers_served
    FROM claims c
    INNER JOIN eligible_prescriptions ep ON c.prescription_number = ep.prescription_identifier
    GROUP BY c.pharmacy_id
)
SELECT 
    ps.pharmacy_id,
    ps.pharmacy_name,
    ps.chain_pharmacy,
    ps.npi_number,
    ps.nabp_number,
    COALESCE(ps.prescriptions_written, 0) AS prescriptions_written,
    ps.unique_patients AS patients_with_scripts,
    ps.unique_prescribers AS prescribers_writing,
    ps.first_prescription_date,
    ps.last_prescription_date,
    COALESCE(pc.total_claims, 0::bigint) AS total_claims,
    COALESCE(ps.prescriptions_filled, 0) AS prescriptions_filled,
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
        WHEN ps.prescriptions_written > 0 AND (ps.prescriptions_filled::numeric / ps.prescriptions_written::numeric) < 0.1 THEN 'Low Activity - Review Needed'::text
        ELSE 'Active'::text
    END AS contract_status,
    CASE
        WHEN ps.prescriptions_written > 0 THEN round(COALESCE(ps.prescriptions_filled, 0)::numeric / ps.prescriptions_written::numeric * 100::numeric, 1)
        ELSE 0::numeric
    END AS capture_rate_pct,
    CASE
        WHEN ps.prescriptions_written > COALESCE(ps.prescriptions_filled, 0) AND ps.prescriptions_filled > 0 
        THEN (ps.prescriptions_written - ps.prescriptions_filled)::numeric * (pc.total_payments / ps.prescriptions_filled::numeric)
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