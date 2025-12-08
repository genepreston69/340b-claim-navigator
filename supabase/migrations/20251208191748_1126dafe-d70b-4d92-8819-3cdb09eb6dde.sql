-- Advanced Analytics Views for 340B Claim Navigator
-- This migration adds views for prescription adherence, physician capture rates,
-- pharmacy comparison, and contract compliance analytics

-- =============================================================================
-- 1. PRESCRIPTION ADHERENCE VIEW
-- =============================================================================
CREATE OR REPLACE VIEW prescription_adherence_analysis AS
WITH prescription_fills AS (
    SELECT
        p.id AS prescription_id,
        p.prescription_identifier,
        p.prescribed_date,
        p.patient_id,
        p.patient_mrn,
        p.drug_id,
        p.ndc_code,
        p.medication_name,
        p.days_supply AS prescribed_days_supply,
        p.refills_authorized,
        p.prescriber_id,
        p.pharmacy_id,
        pat.first_name || ' ' || pat.last_name AS patient_name,
        d.drug_name AS drug_display_name,
        COUNT(c.id) AS total_fills,
        COALESCE(SUM(c.days_supply), 0) AS total_days_supplied,
        MIN(c.fill_date) AS first_fill_date,
        MAX(c.fill_date) AS last_fill_date,
        MIN(c.fill_date) - p.prescribed_date AS days_to_first_fill,
        COALESCE(SUM(c.total_payment), 0) AS total_payments,
        COALESCE(SUM(c.drug_cost_340b), 0) AS total_340b_cost
    FROM prescriptions p
    LEFT JOIN patients pat ON p.patient_id = pat.id
    LEFT JOIN drugs d ON p.drug_id = d.id
    LEFT JOIN claims c ON p.prescription_identifier = c.prescription_number
    GROUP BY
        p.id, p.prescription_identifier, p.prescribed_date, p.patient_id,
        p.patient_mrn, p.drug_id, p.ndc_code, p.medication_name,
        p.days_supply, p.refills_authorized, p.prescriber_id, p.pharmacy_id,
        pat.first_name, pat.last_name, d.drug_name
)
SELECT
    prescription_id,
    prescription_identifier,
    prescribed_date,
    patient_id,
    patient_mrn,
    patient_name,
    drug_id,
    ndc_code,
    COALESCE(drug_display_name, medication_name) AS drug_name,
    prescribed_days_supply,
    refills_authorized,
    prescriber_id,
    pharmacy_id,
    total_fills,
    total_days_supplied,
    first_fill_date,
    last_fill_date,
    days_to_first_fill,
    total_payments,
    total_340b_cost,
    COALESCE(refills_authorized, 0) + 1 AS expected_fills,
    CASE
        WHEN COALESCE(refills_authorized, 0) + 1 > 0
        THEN ROUND((total_fills::NUMERIC / (COALESCE(refills_authorized, 0) + 1)) * 100, 1)
        ELSE 0
    END AS fill_rate_pct,
    CASE
        WHEN total_fills = 0 THEN 'Never Filled'
        WHEN total_fills < (COALESCE(refills_authorized, 0) + 1) THEN 'Partially Adherent'
        ELSE 'Fully Adherent'
    END AS adherence_status,
    CASE
        WHEN days_to_first_fill IS NULL THEN 'Never Filled'
        WHEN days_to_first_fill <= 3 THEN 'Prompt (0-3 days)'
        WHEN days_to_first_fill <= 7 THEN 'Normal (4-7 days)'
        WHEN days_to_first_fill <= 14 THEN 'Delayed (8-14 days)'
        ELSE 'Very Delayed (>14 days)'
    END AS time_to_fill_category
FROM prescription_fills;

-- =============================================================================
-- 2. PHYSICIAN CAPTURE RATE VIEW
-- =============================================================================
CREATE OR REPLACE VIEW physician_capture_rates AS
WITH prescriber_scripts AS (
    SELECT
        p.prescriber_id,
        pr.first_name AS prescriber_first_name,
        pr.last_name AS prescriber_last_name,
        pr.npi AS prescriber_npi,
        pr.dea_number AS prescriber_dea,
        COUNT(DISTINCT p.id) AS total_prescriptions,
        COUNT(DISTINCT p.patient_id) AS unique_patients,
        COUNT(DISTINCT p.drug_id) AS unique_drugs
    FROM prescriptions p
    JOIN prescribers pr ON p.prescriber_id = pr.id
    GROUP BY p.prescriber_id, pr.first_name, pr.last_name, pr.npi, pr.dea_number
),
prescriber_claims AS (
    SELECT
        c.prescriber_id,
        COUNT(DISTINCT c.id) AS total_claims,
        COUNT(DISTINCT c.prescription_number) AS prescriptions_filled,
        SUM(c.total_payment) AS total_payments,
        SUM(c.drug_cost_340b) AS total_340b_cost,
        SUM(c.retail_drug_cost) AS total_retail_cost,
        AVG(c.fill_date - c.date_rx_written) AS avg_days_to_fill,
        COUNT(DISTINCT c.pharmacy_id) AS pharmacies_used
    FROM claims c
    WHERE c.prescriber_id IS NOT NULL
    GROUP BY c.prescriber_id
)
SELECT
    ps.prescriber_id,
    ps.prescriber_first_name,
    ps.prescriber_last_name,
    COALESCE(ps.prescriber_first_name || ' ', '') || ps.prescriber_last_name AS prescriber_full_name,
    ps.prescriber_npi,
    ps.prescriber_dea,
    ps.total_prescriptions,
    ps.unique_patients,
    ps.unique_drugs,
    COALESCE(pc.total_claims, 0) AS total_claims,
    COALESCE(pc.prescriptions_filled, 0) AS prescriptions_filled,
    COALESCE(pc.total_payments, 0) AS total_payments,
    COALESCE(pc.total_340b_cost, 0) AS total_340b_cost,
    COALESCE(pc.total_retail_cost, 0) AS total_retail_cost,
    COALESCE(pc.total_retail_cost, 0) - COALESCE(pc.total_340b_cost, 0) AS gross_savings,
    COALESCE(pc.avg_days_to_fill, 0) AS avg_days_to_fill,
    COALESCE(pc.pharmacies_used, 0) AS pharmacies_used,
    CASE
        WHEN ps.total_prescriptions > 0
        THEN ROUND((COALESCE(pc.prescriptions_filled, 0)::NUMERIC / ps.total_prescriptions) * 100, 1)
        ELSE 0
    END AS capture_rate_pct,
    CASE
        WHEN ps.total_prescriptions = 0 THEN 'No Scripts'
        WHEN (COALESCE(pc.prescriptions_filled, 0)::NUMERIC / ps.total_prescriptions) >= 0.8 THEN 'High Performer'
        WHEN (COALESCE(pc.prescriptions_filled, 0)::NUMERIC / ps.total_prescriptions) >= 0.5 THEN 'Moderate'
        WHEN (COALESCE(pc.prescriptions_filled, 0)::NUMERIC / ps.total_prescriptions) >= 0.2 THEN 'Low'
        ELSE 'Very Low'
    END AS performance_tier,
    (ps.total_prescriptions - COALESCE(pc.prescriptions_filled, 0)) *
        COALESCE(NULLIF(pc.total_payments, 0) / NULLIF(pc.prescriptions_filled, 0), 0) AS estimated_lost_revenue
FROM prescriber_scripts ps
LEFT JOIN prescriber_claims pc ON ps.prescriber_id = pc.prescriber_id;

-- =============================================================================
-- 3. DRUG PHARMACY COMPARISON VIEW
-- =============================================================================
CREATE OR REPLACE VIEW drug_pharmacy_comparison AS
WITH drug_pharmacy_matrix AS (
    SELECT
        c.drug_id,
        d.ndc_code,
        COALESCE(d.drug_name, c.drug_name) AS drug_name,
        d.manufacturer_name,
        c.pharmacy_id,
        ph.pharmacy_name,
        ph.chain_pharmacy,
        COUNT(*) AS claim_count,
        SUM(c.qty_dispensed) AS total_qty_dispensed,
        SUM(c.total_payment) AS total_payments,
        SUM(c.drug_cost_340b) AS total_340b_cost,
        SUM(c.retail_drug_cost) AS total_retail_cost,
        AVG(c.total_payment) AS avg_payment_per_claim,
        AVG(c.profit_or_loss) AS avg_profit_per_claim,
        MIN(c.fill_date) AS first_fill_date,
        MAX(c.fill_date) AS last_fill_date
    FROM claims c
    LEFT JOIN drugs d ON c.drug_id = d.id
    LEFT JOIN pharmacies ph ON c.pharmacy_id = ph.id
    WHERE c.drug_id IS NOT NULL OR c.ndc IS NOT NULL
    GROUP BY c.drug_id, d.ndc_code, d.drug_name, c.drug_name,
             d.manufacturer_name, c.pharmacy_id, ph.pharmacy_name, ph.chain_pharmacy
),
drug_totals AS (
    SELECT
        drug_id,
        ndc_code,
        drug_name,
        COUNT(DISTINCT pharmacy_id) AS pharmacy_count,
        SUM(claim_count) AS total_claims,
        SUM(total_payments) AS drug_total_payments,
        SUM(total_340b_cost) AS drug_total_340b_cost
    FROM drug_pharmacy_matrix
    GROUP BY drug_id, ndc_code, drug_name
)
SELECT
    dpm.drug_id,
    dpm.ndc_code,
    dpm.drug_name,
    dpm.manufacturer_name,
    dpm.pharmacy_id,
    dpm.pharmacy_name,
    dpm.chain_pharmacy,
    dpm.claim_count,
    dpm.total_qty_dispensed,
    dpm.total_payments,
    dpm.total_340b_cost,
    dpm.total_retail_cost,
    COALESCE(dpm.total_retail_cost, 0) - COALESCE(dpm.total_340b_cost, 0) AS gross_savings,
    dpm.avg_payment_per_claim,
    dpm.avg_profit_per_claim,
    dpm.first_fill_date,
    dpm.last_fill_date,
    dt.pharmacy_count AS total_pharmacies_dispensing,
    dt.total_claims AS drug_total_claims,
    CASE
        WHEN dt.total_claims > 0
        THEN ROUND((dpm.claim_count::NUMERIC / dt.total_claims) * 100, 1)
        ELSE 0
    END AS pharmacy_market_share_pct,
    CASE WHEN dt.pharmacy_count = 1 THEN TRUE ELSE FALSE END AS single_pharmacy_drug
FROM drug_pharmacy_matrix dpm
JOIN drug_totals dt ON dpm.drug_id = dt.drug_id OR
    (dpm.drug_id IS NULL AND dpm.ndc_code = dt.ndc_code);

-- =============================================================================
-- 4. PHARMACY CONTRACT COMPLIANCE VIEW
-- =============================================================================
CREATE OR REPLACE VIEW pharmacy_contract_compliance AS
WITH pharmacy_scripts AS (
    SELECT
        ph.id AS pharmacy_id,
        ph.pharmacy_name,
        ph.chain_pharmacy,
        ph.npi_number,
        ph.nabp_number,
        COUNT(DISTINCT p.id) AS prescriptions_written,
        COUNT(DISTINCT p.patient_id) AS unique_patients,
        COUNT(DISTINCT p.prescriber_id) AS unique_prescribers,
        MIN(p.prescribed_date) AS first_prescription_date,
        MAX(p.prescribed_date) AS last_prescription_date
    FROM pharmacies ph
    LEFT JOIN prescriptions p ON ph.id = p.pharmacy_id
    GROUP BY ph.id, ph.pharmacy_name, ph.chain_pharmacy, ph.npi_number, ph.nabp_number
),
pharmacy_claims AS (
    SELECT
        c.pharmacy_id,
        ph.pharmacy_name,
        COUNT(DISTINCT c.id) AS total_claims,
        COUNT(DISTINCT c.prescription_number) AS prescriptions_filled,
        SUM(c.total_payment) AS total_payments,
        SUM(c.drug_cost_340b) AS total_340b_cost,
        SUM(c.retail_drug_cost) AS total_retail_cost,
        MIN(c.fill_date) AS first_claim_date,
        MAX(c.fill_date) AS last_claim_date,
        COUNT(DISTINCT c.drug_id) AS unique_drugs_dispensed,
        COUNT(DISTINCT c.prescriber_id) AS unique_prescribers_served
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
    COALESCE(pc.total_claims, 0) AS total_claims,
    COALESCE(pc.prescriptions_filled, 0) AS prescriptions_filled,
    COALESCE(pc.total_payments, 0) AS total_payments,
    COALESCE(pc.total_340b_cost, 0) AS total_340b_cost,
    COALESCE(pc.total_retail_cost, 0) AS total_retail_cost,
    COALESCE(pc.total_retail_cost, 0) - COALESCE(pc.total_340b_cost, 0) AS gross_savings,
    pc.first_claim_date,
    pc.last_claim_date,
    COALESCE(pc.unique_drugs_dispensed, 0) AS unique_drugs_dispensed,
    COALESCE(pc.unique_prescribers_served, 0) AS unique_prescribers_served,
    CASE
        WHEN pc.total_claims IS NULL OR pc.total_claims = 0 THEN 'No Claims - Likely Uncontracted'
        WHEN pc.last_claim_date < CURRENT_DATE - INTERVAL '90 days' THEN 'Inactive (No claims in 90 days)'
        WHEN ps.prescriptions_written > 0 AND
             (pc.prescriptions_filled::NUMERIC / ps.prescriptions_written) < 0.1 THEN 'Low Activity - Review Needed'
        ELSE 'Active'
    END AS contract_status,
    CASE
        WHEN ps.prescriptions_written > 0
        THEN ROUND((COALESCE(pc.prescriptions_filled, 0)::NUMERIC / ps.prescriptions_written) * 100, 1)
        ELSE 0
    END AS capture_rate_pct,
    CASE
        WHEN ps.prescriptions_written > COALESCE(pc.prescriptions_filled, 0) AND pc.prescriptions_filled > 0
        THEN (ps.prescriptions_written - pc.prescriptions_filled) * (pc.total_payments / pc.prescriptions_filled)
        ELSE 0
    END AS estimated_lost_revenue,
    CASE
        WHEN pc.last_claim_date IS NOT NULL
        THEN CURRENT_DATE - pc.last_claim_date
        ELSE NULL
    END AS days_since_last_claim
FROM pharmacy_scripts ps
LEFT JOIN pharmacy_claims pc ON ps.pharmacy_id = pc.pharmacy_id;

-- =============================================================================
-- 5. MONTHLY ADHERENCE TRENDS VIEW
-- =============================================================================
CREATE OR REPLACE VIEW monthly_adherence_trends AS
SELECT
    DATE_TRUNC('month', p.prescribed_date)::DATE AS month,
    COUNT(DISTINCT p.id) AS total_prescriptions,
    COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN p.id END) AS prescriptions_filled,
    COUNT(DISTINCT c.id) AS total_claims,
    ROUND(
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN p.id END)::NUMERIC /
        NULLIF(COUNT(DISTINCT p.id), 0) * 100, 1
    ) AS fill_rate_pct,
    AVG(CASE WHEN c.fill_date IS NOT NULL THEN c.fill_date - p.prescribed_date END) AS avg_days_to_fill,
    SUM(c.total_payment) AS total_payments,
    SUM(c.drug_cost_340b) AS total_340b_cost,
    SUM(c.retail_drug_cost) AS total_retail_cost,
    SUM(c.retail_drug_cost) - SUM(c.drug_cost_340b) AS gross_savings,
    COUNT(DISTINCT p.patient_id) AS unique_patients,
    COUNT(DISTINCT p.prescriber_id) AS unique_prescribers,
    COUNT(DISTINCT p.pharmacy_id) AS unique_pharmacies
FROM prescriptions p
LEFT JOIN claims c ON p.prescription_identifier = c.prescription_number
WHERE p.prescribed_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', p.prescribed_date)
ORDER BY month DESC;

-- =============================================================================
-- 6. DRUG ADHERENCE SUMMARY VIEW
-- =============================================================================
CREATE OR REPLACE VIEW drug_adherence_summary AS
SELECT
    COALESCE(d.id, p.drug_id) AS drug_id,
    COALESCE(d.ndc_code, p.ndc_code) AS ndc_code,
    COALESCE(d.drug_name, p.medication_name) AS drug_name,
    d.manufacturer_name,
    COUNT(DISTINCT p.id) AS total_prescriptions,
    COUNT(DISTINCT p.patient_id) AS unique_patients,
    COUNT(DISTINCT p.prescriber_id) AS unique_prescribers,
    COUNT(DISTINCT c.id) AS total_claims,
    SUM(c.qty_dispensed) AS total_qty_dispensed,
    ROUND(
        COUNT(DISTINCT CASE WHEN c.id IS NOT NULL THEN p.id END)::NUMERIC /
        NULLIF(COUNT(DISTINCT p.id), 0) * 100, 1
    ) AS fill_rate_pct,
    AVG(CASE WHEN c.fill_date IS NOT NULL THEN c.fill_date - p.prescribed_date END) AS avg_days_to_fill,
    SUM(c.total_payment) AS total_payments,
    SUM(c.drug_cost_340b) AS total_340b_cost,
    SUM(c.retail_drug_cost) AS total_retail_cost,
    SUM(c.retail_drug_cost) - SUM(c.drug_cost_340b) AS gross_savings,
    AVG(c.total_payment) AS avg_payment_per_claim,
    AVG(c.drug_cost_340b) AS avg_340b_cost_per_claim,
    COUNT(DISTINCT c.pharmacy_id) AS pharmacies_dispensing
FROM prescriptions p
LEFT JOIN drugs d ON p.drug_id = d.id
LEFT JOIN claims c ON p.prescription_identifier = c.prescription_number
GROUP BY COALESCE(d.id, p.drug_id), COALESCE(d.ndc_code, p.ndc_code),
         COALESCE(d.drug_name, p.medication_name), d.manufacturer_name
HAVING COUNT(DISTINCT p.id) > 0
ORDER BY total_prescriptions DESC;

-- =============================================================================
-- SET SECURITY INVOKER ON ALL NEW VIEWS
-- =============================================================================
ALTER VIEW prescription_adherence_analysis SET (security_invoker = true);
ALTER VIEW physician_capture_rates SET (security_invoker = true);
ALTER VIEW drug_pharmacy_comparison SET (security_invoker = true);
ALTER VIEW pharmacy_contract_compliance SET (security_invoker = true);
ALTER VIEW monthly_adherence_trends SET (security_invoker = true);
ALTER VIEW drug_adherence_summary SET (security_invoker = true);

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_claims_drug_pharmacy ON claims(drug_id, pharmacy_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_prescriber ON prescriptions(prescriber_id);
CREATE INDEX IF NOT EXISTS idx_claims_prescriber ON claims(prescriber_id);
CREATE INDEX IF NOT EXISTS idx_prescriptions_pharmacy ON prescriptions(pharmacy_id);