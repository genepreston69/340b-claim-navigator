-- =====================================================
-- Migration: Contract Pharmacy Exclusion & Medicaid Carve Analysis
-- Date: 2024-12-10
-- Description:
--   1. Contract Pharmacy Exclusion Analysis - Identify drugs where
--      one pharmacy shows 340B benefit and another doesn't (manufacturer restrictions)
--   2. Medicaid Carve-In vs Carve-Out Report - Separate Medicaid claims
--      by 340B eligibility status
-- =====================================================

-- =====================================================
-- 1. CONTRACT PHARMACY EXCLUSION ANALYSIS
-- Identifies drugs where performance varies significantly across pharmacies
-- indicating potential manufacturer exclusions
-- =====================================================

CREATE OR REPLACE VIEW contract_pharmacy_exclusion_analysis
WITH (security_invoker = true) AS

WITH drug_pharmacy_performance AS (
    -- Get performance metrics for each drug at each pharmacy
    SELECT
        ndc,
        drug_name,
        pharmacy_id,
        pharmacy_name,
        COUNT(*) AS claim_count,
        COALESCE(SUM(drug_cost_340b), 0) AS total_340b_cost,
        COALESCE(SUM(retail_drug_cost), 0) AS total_retail_cost,
        COALESCE(SUM(profit_or_loss), 0) AS total_profit_loss,
        COALESCE(AVG(profit_or_loss), 0) AS avg_profit_per_claim,
        -- Flag if this pharmacy shows 340B benefit for this drug
        CASE
            WHEN COALESCE(AVG(profit_or_loss), 0) > 1 THEN true
            ELSE false
        END AS has_340b_benefit
    FROM claims
    WHERE ndc IS NOT NULL
      AND pharmacy_name IS NOT NULL
      AND fill_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY ndc, drug_name, pharmacy_id, pharmacy_name
    HAVING COUNT(*) >= 3  -- Minimum claims for meaningful analysis
),

drug_summary AS (
    -- Summarize each drug across all pharmacies
    SELECT
        ndc,
        drug_name,
        COUNT(DISTINCT pharmacy_id) AS pharmacy_count,
        SUM(claim_count) AS total_claims,
        SUM(CASE WHEN has_340b_benefit THEN 1 ELSE 0 END) AS pharmacies_with_benefit,
        SUM(CASE WHEN NOT has_340b_benefit THEN 1 ELSE 0 END) AS pharmacies_without_benefit,
        -- Flag drugs where some pharmacies have benefit and others don't
        CASE
            WHEN SUM(CASE WHEN has_340b_benefit THEN 1 ELSE 0 END) > 0
             AND SUM(CASE WHEN NOT has_340b_benefit THEN 1 ELSE 0 END) > 0
            THEN true
            ELSE false
        END AS has_exclusion_pattern
    FROM drug_pharmacy_performance
    GROUP BY ndc, drug_name
)

SELECT
    dpp.ndc,
    dpp.drug_name,
    dpp.pharmacy_id,
    dpp.pharmacy_name,
    dpp.claim_count,
    dpp.total_340b_cost,
    dpp.total_retail_cost,
    dpp.total_profit_loss,
    dpp.avg_profit_per_claim,
    dpp.has_340b_benefit,
    ds.pharmacy_count AS total_pharmacies_dispensing,
    ds.pharmacies_with_benefit,
    ds.pharmacies_without_benefit,
    ds.has_exclusion_pattern,
    -- Estimated lost revenue if this pharmacy is excluded
    CASE
        WHEN NOT dpp.has_340b_benefit AND ds.pharmacies_with_benefit > 0 THEN
            -- Estimate based on average benefit at other pharmacies
            dpp.claim_count * (
                SELECT COALESCE(AVG(avg_profit_per_claim), 0)
                FROM drug_pharmacy_performance dpp2
                WHERE dpp2.ndc = dpp.ndc AND dpp2.has_340b_benefit = true
            )
        ELSE 0
    END AS estimated_lost_revenue,
    -- Exclusion status
    CASE
        WHEN ds.has_exclusion_pattern AND NOT dpp.has_340b_benefit THEN 'Potentially Excluded'
        WHEN ds.has_exclusion_pattern AND dpp.has_340b_benefit THEN 'Active 340B'
        WHEN NOT ds.has_exclusion_pattern AND dpp.has_340b_benefit THEN 'Active 340B (All Pharmacies)'
        ELSE 'No 340B Benefit (All Pharmacies)'
    END AS exclusion_status
FROM drug_pharmacy_performance dpp
JOIN drug_summary ds ON dpp.ndc = ds.ndc
ORDER BY ds.has_exclusion_pattern DESC, dpp.drug_name, dpp.pharmacy_name;

-- =====================================================
-- 2. EXCLUSION SUMMARY BY DRUG
-- High-level view of drugs with potential exclusions
-- =====================================================

CREATE OR REPLACE VIEW drug_exclusion_summary
WITH (security_invoker = true) AS

SELECT
    ndc,
    drug_name,
    COUNT(DISTINCT pharmacy_id) AS total_pharmacies,
    COUNT(DISTINCT CASE WHEN has_340b_benefit THEN pharmacy_id END) AS pharmacies_with_benefit,
    COUNT(DISTINCT CASE WHEN NOT has_340b_benefit THEN pharmacy_id END) AS pharmacies_excluded,
    SUM(claim_count) AS total_claims,
    SUM(CASE WHEN has_340b_benefit THEN claim_count ELSE 0 END) AS claims_with_benefit,
    SUM(CASE WHEN NOT has_340b_benefit THEN claim_count ELSE 0 END) AS claims_without_benefit,
    SUM(total_profit_loss) AS total_profit_loss,
    SUM(CASE WHEN NOT has_340b_benefit THEN estimated_lost_revenue ELSE 0 END) AS total_estimated_lost_revenue,
    CASE
        WHEN COUNT(DISTINCT CASE WHEN has_340b_benefit THEN pharmacy_id END) > 0
         AND COUNT(DISTINCT CASE WHEN NOT has_340b_benefit THEN pharmacy_id END) > 0
        THEN 'Partial Exclusion'
        WHEN COUNT(DISTINCT CASE WHEN has_340b_benefit THEN pharmacy_id END) = 0
        THEN 'Fully Excluded'
        ELSE 'No Exclusion'
    END AS exclusion_status
FROM contract_pharmacy_exclusion_analysis
GROUP BY ndc, drug_name
ORDER BY
    CASE
        WHEN COUNT(DISTINCT CASE WHEN has_340b_benefit THEN pharmacy_id END) > 0
         AND COUNT(DISTINCT CASE WHEN NOT has_340b_benefit THEN pharmacy_id END) > 0
        THEN 1  -- Partial exclusions first
        WHEN COUNT(DISTINCT CASE WHEN has_340b_benefit THEN pharmacy_id END) = 0
        THEN 2  -- Fully excluded second
        ELSE 3  -- No exclusion last
    END,
    SUM(CASE WHEN NOT has_340b_benefit THEN estimated_lost_revenue ELSE 0 END) DESC;

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
-- 5. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON contract_pharmacy_exclusion_analysis TO authenticated;
GRANT SELECT ON drug_exclusion_summary TO authenticated;
GRANT SELECT ON medicaid_carve_analysis TO authenticated;
GRANT SELECT ON medicaid_carve_summary TO authenticated;
