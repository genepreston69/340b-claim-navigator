-- =====================================================
-- Migration: Pharmacy Benefit Comparison & Medicaid Carve Analysis
-- Date: 2024-12-10
-- Description:
--   1. Pharmacy Benefit Comparison - Show drugs where one pharmacy
--      dispenses with 340B benefit but another doesn't
--   2. Medicaid Carve-In vs Carve-Out Report - Separate Medicaid claims
--      by 340B eligibility status
-- =====================================================

-- =====================================================
-- 1. PHARMACY BENEFIT COMPARISON
-- Shows drugs dispensed with 340B benefit at one pharmacy
-- but without benefit at another - indicates potential exclusion
-- =====================================================

CREATE OR REPLACE VIEW pharmacy_benefit_comparison
WITH (security_invoker = true) AS

WITH drug_pharmacy_stats AS (
    -- Calculate benefit stats for each drug at each pharmacy
    SELECT
        ndc,
        drug_name,
        pharmacy_id,
        pharmacy_name,
        COUNT(*) AS claim_count,
        COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
        COALESCE(SUM(retail_drug_cost), 0) AS total_retail_cost,
        COALESCE(SUM(profit_or_loss), 0) AS total_benefit,
        COALESCE(AVG(profit_or_loss), 0) AS avg_benefit_per_claim,
        -- Has benefit if average profit is positive
        CASE WHEN COALESCE(AVG(profit_or_loss), 0) > 0 THEN true ELSE false END AS has_benefit
    FROM claims
    WHERE ndc IS NOT NULL
      AND pharmacy_name IS NOT NULL
      AND fill_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY ndc, drug_name, pharmacy_id, pharmacy_name
    HAVING COUNT(*) >= 2  -- At least 2 claims
),

drugs_with_mixed_benefit AS (
    -- Find drugs that have benefit at some pharmacies but not others
    SELECT DISTINCT ndc
    FROM drug_pharmacy_stats
    GROUP BY ndc
    HAVING
        SUM(CASE WHEN has_benefit THEN 1 ELSE 0 END) > 0  -- At least one pharmacy with benefit
        AND SUM(CASE WHEN NOT has_benefit THEN 1 ELSE 0 END) > 0  -- At least one without
)

SELECT
    dps.ndc,
    dps.drug_name,
    dps.pharmacy_id,
    dps.pharmacy_name,
    dps.claim_count,
    dps.total_340b_cost,
    dps.total_retail_cost,
    dps.total_benefit,
    dps.avg_benefit_per_claim,
    dps.has_benefit,
    CASE
        WHEN dps.has_benefit THEN 'With 340B Benefit'
        ELSE 'No 340B Benefit'
    END AS benefit_status,
    -- Count of pharmacies for this drug
    (SELECT COUNT(DISTINCT pharmacy_id) FROM drug_pharmacy_stats WHERE ndc = dps.ndc) AS total_pharmacies,
    (SELECT COUNT(DISTINCT pharmacy_id) FROM drug_pharmacy_stats WHERE ndc = dps.ndc AND has_benefit) AS pharmacies_with_benefit,
    (SELECT COUNT(DISTINCT pharmacy_id) FROM drug_pharmacy_stats WHERE ndc = dps.ndc AND NOT has_benefit) AS pharmacies_without_benefit
FROM drug_pharmacy_stats dps
WHERE dps.ndc IN (SELECT ndc FROM drugs_with_mixed_benefit)
ORDER BY dps.drug_name, dps.has_benefit DESC, dps.claim_count DESC;

-- =====================================================
-- 2. DRUG BENEFIT SUMMARY
-- Summary view showing drugs with inconsistent benefit across pharmacies
-- =====================================================

CREATE OR REPLACE VIEW drug_benefit_summary
WITH (security_invoker = true) AS

WITH drug_pharmacy_stats AS (
    SELECT
        ndc,
        drug_name,
        pharmacy_id,
        pharmacy_name,
        COUNT(*) AS claim_count,
        COALESCE(SUM(profit_or_loss), 0) AS total_benefit,
        CASE WHEN COALESCE(AVG(profit_or_loss), 0) > 0 THEN true ELSE false END AS has_benefit
    FROM claims
    WHERE ndc IS NOT NULL
      AND pharmacy_name IS NOT NULL
      AND fill_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY ndc, drug_name, pharmacy_id, pharmacy_name
    HAVING COUNT(*) >= 2
)

SELECT
    ndc,
    drug_name,
    COUNT(DISTINCT pharmacy_id) AS total_pharmacies,
    COUNT(DISTINCT CASE WHEN has_benefit THEN pharmacy_id END) AS pharmacies_with_benefit,
    COUNT(DISTINCT CASE WHEN NOT has_benefit THEN pharmacy_id END) AS pharmacies_without_benefit,
    SUM(claim_count) AS total_claims,
    SUM(CASE WHEN has_benefit THEN claim_count ELSE 0 END) AS claims_with_benefit,
    SUM(CASE WHEN NOT has_benefit THEN claim_count ELSE 0 END) AS claims_without_benefit,
    SUM(total_benefit) AS total_benefit,
    -- List pharmacies with benefit
    STRING_AGG(DISTINCT CASE WHEN has_benefit THEN pharmacy_name END, ', ') AS pharmacies_with_benefit_list,
    -- List pharmacies without benefit
    STRING_AGG(DISTINCT CASE WHEN NOT has_benefit THEN pharmacy_name END, ', ') AS pharmacies_without_benefit_list
FROM drug_pharmacy_stats
GROUP BY ndc, drug_name
HAVING
    COUNT(DISTINCT CASE WHEN has_benefit THEN pharmacy_id END) > 0
    AND COUNT(DISTINCT CASE WHEN NOT has_benefit THEN pharmacy_id END) > 0
ORDER BY
    SUM(CASE WHEN NOT has_benefit THEN claim_count ELSE 0 END) DESC,
    drug_name;

-- =====================================================
-- 3. MEDICAID CARVE-IN VS CARVE-OUT ANALYSIS
-- Separates Medicaid claims by 340B eligibility
-- =====================================================

CREATE OR REPLACE VIEW medicaid_carve_analysis
WITH (security_invoker = true) AS

SELECT
    DATE_TRUNC('month', fill_date)::date AS month,
    ndc,
    drug_name,
    pharmacy_name,
    -- Carve status determination:
    -- Carved-IN: Medicaid claim that received 340B pricing (has 340B cost, shows benefit)
    -- Carved-OUT: Medicaid claim that did NOT receive 340B pricing
    CASE
        WHEN LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
          OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
          OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%'
        THEN
            CASE
                WHEN drug_cost_340b IS NOT NULL AND drug_cost_340b > 0
                 AND COALESCE(profit_or_loss, 0) > 0
                THEN 'Carved-In (340B Eligible)'
                ELSE 'Carved-Out (Not 340B Eligible)'
            END
        ELSE 'Non-Medicaid'
    END AS carve_status,
    COUNT(*) AS claim_count,
    COALESCE(SUM(qty_dispensed), 0) AS total_quantity,
    COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
    COALESCE(SUM(retail_drug_cost), 0) AS total_retail_cost,
    COALESCE(SUM(total_payment), 0) AS total_payments,
    COALESCE(SUM(profit_or_loss), 0) AS total_profit_loss,
    COALESCE(SUM(patient_pay), 0) AS total_patient_pay,
    COALESCE(SUM(third_party_payment), 0) AS total_third_party_pay
FROM claims
WHERE fill_date IS NOT NULL
  AND fill_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY
    DATE_TRUNC('month', fill_date),
    ndc,
    drug_name,
    pharmacy_name,
    CASE
        WHEN LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
          OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
          OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%'
        THEN
            CASE
                WHEN drug_cost_340b IS NOT NULL AND drug_cost_340b > 0
                 AND COALESCE(profit_or_loss, 0) > 0
                THEN 'Carved-In (340B Eligible)'
                ELSE 'Carved-Out (Not 340B Eligible)'
            END
        ELSE 'Non-Medicaid'
    END
ORDER BY month DESC, carve_status, drug_name;

-- =====================================================
-- 4. MEDICAID CARVE SUMMARY (Monthly Totals)
-- High-level monthly summary of Medicaid carve status
-- =====================================================

CREATE OR REPLACE VIEW medicaid_carve_summary
WITH (security_invoker = true) AS

SELECT
    DATE_TRUNC('month', fill_date)::date AS month,
    -- Carved-In totals
    COUNT(*) FILTER (
        WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
          AND drug_cost_340b IS NOT NULL AND drug_cost_340b > 0
          AND COALESCE(profit_or_loss, 0) > 0
    ) AS carved_in_claims,
    COALESCE(SUM(total_payment) FILTER (
        WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
          AND drug_cost_340b IS NOT NULL AND drug_cost_340b > 0
          AND COALESCE(profit_or_loss, 0) > 0
    ), 0) AS carved_in_payments,
    COALESCE(SUM(profit_or_loss) FILTER (
        WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
          AND drug_cost_340b IS NOT NULL AND drug_cost_340b > 0
          AND COALESCE(profit_or_loss, 0) > 0
    ), 0) AS carved_in_benefit,

    -- Carved-Out totals
    COUNT(*) FILTER (
        WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
          AND (drug_cost_340b IS NULL OR drug_cost_340b = 0
            OR COALESCE(profit_or_loss, 0) <= 0)
    ) AS carved_out_claims,
    COALESCE(SUM(total_payment) FILTER (
        WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
            OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
          AND (drug_cost_340b IS NULL OR drug_cost_340b = 0
            OR COALESCE(profit_or_loss, 0) <= 0)
    ), 0) AS carved_out_payments,

    -- Total Medicaid
    COUNT(*) FILTER (
        WHERE LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
           OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
           OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%'
    ) AS total_medicaid_claims,

    -- Non-Medicaid for comparison
    COUNT(*) FILTER (
        WHERE NOT (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
    ) AS non_medicaid_claims,
    COALESCE(SUM(profit_or_loss) FILTER (
        WHERE NOT (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
    ), 0) AS non_medicaid_benefit,

    -- Carve rate percentage
    CASE
        WHEN COUNT(*) FILTER (
            WHERE LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
               OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%'
        ) > 0
        THEN ROUND(
            100.0 * COUNT(*) FILTER (
                WHERE (LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
                    OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
                    OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%')
                  AND (drug_cost_340b IS NULL OR drug_cost_340b = 0
                    OR COALESCE(profit_or_loss, 0) <= 0)
            ) / COUNT(*) FILTER (
                WHERE LOWER(COALESCE(reason, '')) LIKE '%medicaid%'
                   OR LOWER(COALESCE(sub_reason, '')) LIKE '%medicaid%'
                   OR LOWER(COALESCE(claim_type, '')) LIKE '%medicaid%'
            ), 1
        )
        ELSE 0
    END AS carve_out_rate_pct
FROM claims
WHERE fill_date IS NOT NULL
  AND fill_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', fill_date)
ORDER BY month DESC;

-- =====================================================
-- 5. DROP OLD VIEWS (if they exist)
-- =====================================================

DROP VIEW IF EXISTS contract_pharmacy_exclusion_analysis CASCADE;
DROP VIEW IF EXISTS drug_exclusion_summary CASCADE;

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON pharmacy_benefit_comparison TO authenticated;
GRANT SELECT ON drug_benefit_summary TO authenticated;
GRANT SELECT ON medicaid_carve_analysis TO authenticated;
GRANT SELECT ON medicaid_carve_summary TO authenticated;
