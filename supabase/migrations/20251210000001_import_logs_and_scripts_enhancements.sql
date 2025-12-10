-- =====================================================
-- Migration: Import Logs, Scripts Filter Options, Claims Unique Constraint
-- Date: 2024-12-10
-- Description:
--   1. Creates import_logs table for audit trail of file imports
--   2. Creates scripts_filter_options view for dynamic filtering
--   3. Adds unique constraint to claims table to prevent duplicates
-- =====================================================

-- =====================================================
-- 1. CREATE IMPORT_LOGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS import_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User tracking
    user_id UUID REFERENCES auth.users(id),

    -- File information
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('Scripts', 'Claims')),
    file_size_bytes BIGINT,

    -- Import results
    status VARCHAR(20) NOT NULL DEFAULT 'Processing' CHECK (status IN ('Processing', 'Success', 'Failed', 'Partial')),
    total_records INTEGER DEFAULT 0,
    records_imported INTEGER DEFAULT 0,
    records_skipped INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,

    -- Reference data created during import
    covered_entities_created INTEGER DEFAULT 0,
    pharmacies_created INTEGER DEFAULT 0,
    prescribers_created INTEGER DEFAULT 0,
    patients_created INTEGER DEFAULT 0,
    drugs_created INTEGER DEFAULT 0,
    locations_created INTEGER DEFAULT 0,
    insurance_plans_created INTEGER DEFAULT 0,

    -- Error tracking
    error_message TEXT,
    errors_json JSONB DEFAULT '[]'::jsonb,

    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Standard timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX idx_import_logs_user_id ON import_logs(user_id);
CREATE INDEX idx_import_logs_file_type ON import_logs(file_type);
CREATE INDEX idx_import_logs_status ON import_logs(status);
CREATE INDEX idx_import_logs_created_at ON import_logs(created_at DESC);

-- Enable RLS
ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see their own imports (or admins see all)
CREATE POLICY "Users can view their own import logs"
    ON import_logs FOR SELECT
    TO authenticated
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_roles
            WHERE user_roles.user_id = auth.uid()
            AND user_roles.role = 'admin'
        )
    );

CREATE POLICY "Authenticated users can insert import logs"
    ON import_logs FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own import logs"
    ON import_logs FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

-- Apply updated_at trigger
CREATE TRIGGER update_import_logs_updated_at
    BEFORE UPDATE ON import_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. CREATE SCRIPTS_FILTER_OPTIONS VIEW
-- =====================================================

CREATE OR REPLACE VIEW scripts_filter_options
WITH (security_invoker = true) AS

-- Adjudication status options
SELECT
    'adjudication_status' AS filter_type,
    adjudication_status AS filter_value,
    COUNT(*) AS count
FROM adjudication_status
GROUP BY adjudication_status

UNION ALL

-- Pharmacy options (from prescriptions with pharmacy assigned)
SELECT
    'pharmacy' AS filter_type,
    pharmacy_name AS filter_value,
    COUNT(*) AS count
FROM adjudication_status
WHERE pharmacy_name IS NOT NULL
GROUP BY pharmacy_name

UNION ALL

-- Prescriber options
SELECT
    'prescriber' AS filter_type,
    prescriber_name AS filter_value,
    COUNT(*) AS count
FROM adjudication_status
WHERE prescriber_name IS NOT NULL
GROUP BY prescriber_name

ORDER BY filter_type, count DESC;

-- =====================================================
-- 3. ADD UNIQUE CONSTRAINT TO CLAIMS TABLE
-- =====================================================

-- First, check for and handle any existing duplicates
-- This creates a temporary approach to identify duplicates before adding constraint
DO $$
DECLARE
    duplicate_count INTEGER;
BEGIN
    -- Count duplicates
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT prescription_number, refill_number, fill_date, COUNT(*) as cnt
        FROM claims
        GROUP BY prescription_number, refill_number, fill_date
        HAVING COUNT(*) > 1
    ) dupes;

    IF duplicate_count > 0 THEN
        RAISE NOTICE 'Found % duplicate claim combinations. Keeping newest records.', duplicate_count;

        -- Delete older duplicates, keeping the most recent one (by created_at)
        DELETE FROM claims c1
        WHERE EXISTS (
            SELECT 1 FROM claims c2
            WHERE c2.prescription_number = c1.prescription_number
            AND c2.refill_number = c1.refill_number
            AND c2.fill_date = c1.fill_date
            AND c2.created_at > c1.created_at
        );
    END IF;
END $$;

-- Now add the unique constraint
ALTER TABLE claims
ADD CONSTRAINT claims_unique_prescription_refill_fill
UNIQUE (prescription_number, refill_number, fill_date);

-- Create index to support the constraint (if not automatically created)
CREATE INDEX IF NOT EXISTS idx_claims_unique_key
ON claims(prescription_number, refill_number, fill_date);

-- =====================================================
-- 4. GRANT PERMISSIONS
-- =====================================================

-- Ensure the view is accessible
GRANT SELECT ON scripts_filter_options TO authenticated;
GRANT SELECT ON import_logs TO authenticated;
GRANT INSERT ON import_logs TO authenticated;
GRANT UPDATE ON import_logs TO authenticated;
