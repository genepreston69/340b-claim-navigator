-- Create adjudication status view
CREATE OR REPLACE VIEW adjudication_status AS
SELECT 
    p.id AS prescription_id,
    p.prescription_identifier,
    p.prescribed_date,
    p.patient_mrn,
    p.medication_name,
    p.ndc_code,
    p.dispense_quantity,
    p.refills_authorized,
    p.days_supply,
    p.status AS prescription_status,
    COALESCE(pat.first_name || ' ' || pat.last_name, 'Unknown') AS patient_name,
    pr.last_name AS prescriber_name,
    ph.pharmacy_name,
    COALESCE(claim_agg.fills_count, 0) AS fills_adjudicated,
    COALESCE(p.refills_authorized, 0) + 1 - COALESCE(claim_agg.fills_count, 0) AS fills_remaining,
    CASE 
        WHEN claim_agg.fills_count IS NULL THEN 'Never Filled'
        WHEN claim_agg.fills_count < (COALESCE(p.refills_authorized, 0) + 1) THEN 'Partial'
        ELSE 'Complete'
    END AS adjudication_status,
    claim_agg.last_fill_date,
    claim_agg.total_payments,
    claim_agg.total_340b_cost
FROM prescriptions p
LEFT JOIN patients pat ON p.patient_id = pat.id
LEFT JOIN prescribers pr ON p.prescriber_id = pr.id
LEFT JOIN pharmacies ph ON p.pharmacy_id = ph.id
LEFT JOIN (
    SELECT 
        prescription_number,
        COUNT(*) AS fills_count,
        MAX(fill_date) AS last_fill_date,
        SUM(total_payment) AS total_payments,
        SUM(drug_cost_340b) AS total_340b_cost
    FROM claims
    GROUP BY prescription_number
) claim_agg ON p.prescription_identifier = claim_agg.prescription_number;