-- Prescriptions (scripts written, may not be filled yet)
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_file VARCHAR(255),
    organization_identifier VARCHAR(50),
    covered_entity_id UUID REFERENCES covered_entities(id),
    location_id UUID REFERENCES locations(id),
    encounter_fin BIGINT,
    encounter_start_date TIMESTAMPTZ,
    encounter_end_date TIMESTAMPTZ,
    patient_id UUID REFERENCES patients(id),
    patient_mrn VARCHAR(50),
    primary_insurance_id UUID REFERENCES insurance_plans(id),
    primary_subscriber_number VARCHAR(50),
    secondary_insurance_id UUID REFERENCES insurance_plans(id),
    secondary_subscriber_number VARCHAR(50),
    prescriber_id UUID REFERENCES prescribers(id),
    pharmacy_id UUID REFERENCES pharmacies(id),
    prescription_identifier BIGINT UNIQUE,
    prescribed_date DATE NOT NULL,
    transmission_method VARCHAR(50),
    status VARCHAR(50),
    drug_id UUID REFERENCES drugs(id),
    ndc_code VARCHAR(20),
    medication_name VARCHAR(255),
    dispense_quantity DECIMAL(10,2),
    dispense_quantity_unit VARCHAR(50),
    refills_authorized INTEGER DEFAULT 0,
    days_supply INTEGER,
    frequency VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Claims (adjudicated pharmacy claims)
CREATE TABLE claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    covered_entity_id UUID REFERENCES covered_entities(id),
    covered_entity_name VARCHAR(255),
    opaid VARCHAR(50),
    pharmacy_id UUID REFERENCES pharmacies(id),
    chain_pharmacy VARCHAR(255),
    pharmacy_name VARCHAR(255),
    pharmacy_nabp_npi BIGINT,
    transaction_code VARCHAR(10),
    prescription_number BIGINT NOT NULL,
    date_rx_written DATE NOT NULL,
    bin INTEGER,
    pcn VARCHAR(50),
    plan_group VARCHAR(100),
    secondary_bin INTEGER,
    secondary_pcn VARCHAR(50),
    secondary_group VARCHAR(100),
    other_coverage_code VARCHAR(10),
    submission_clarification_code VARCHAR(50),
    refill_number INTEGER NOT NULL,
    fill_date DATE NOT NULL,
    claim_date DATE,
    claim_id BIGINT UNIQUE,
    claim_captured_date DATE,
    patient_id UUID REFERENCES patients(id),
    patient_id_external VARCHAR(50),
    gender VARCHAR(10),
    first_name VARCHAR(100),
    last_name VARCHAR(150),
    date_of_birth DATE,
    medical_record_number VARCHAR(50),
    prescriber_id UUID REFERENCES prescribers(id),
    prescriber_name VARCHAR(255),
    prescriber_npi_dea VARCHAR(20),
    drug_id UUID REFERENCES drugs(id),
    ndc BIGINT,
    drug_name VARCHAR(255),
    package_size DECIMAL(10,2),
    manufacturer_name VARCHAR(255),
    drug_indicator VARCHAR(10),
    qty_dispensed DECIMAL(10,3),
    days_supply INTEGER,
    claim_type VARCHAR(50),
    claim_sub_type VARCHAR(50),
    reason VARCHAR(100),
    sub_reason VARCHAR(255),
    billing_model VARCHAR(50),
    replenishment_status VARCHAR(50),
    patient_pay DECIMAL(12,2),
    third_party_payment DECIMAL(12,2),
    total_payment DECIMAL(12,2),
    dispensing_fee DECIMAL(12,2),
    ce_receivable DECIMAL(12,2),
    drug_cost_340b DECIMAL(12,2),
    total_claim_cost DECIMAL(12,2),
    profit_or_loss DECIMAL(12,2),
    retail_drug_cost DECIMAL(12,2),
    trued_up_cost DECIMAL(12,2),
    trued_up_units DECIMAL(10,3),
    trued_up_date DATE,
    comments TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on key lookup fields
CREATE INDEX idx_prescriptions_prescription_identifier ON prescriptions(prescription_identifier);
CREATE INDEX idx_prescriptions_prescribed_date ON prescriptions(prescribed_date);
CREATE INDEX idx_prescriptions_patient_id ON prescriptions(patient_id);
CREATE INDEX idx_prescriptions_ndc_code ON prescriptions(ndc_code);
CREATE INDEX idx_prescriptions_status ON prescriptions(status);

CREATE INDEX idx_claims_prescription_number ON claims(prescription_number);
CREATE INDEX idx_claims_date_rx_written ON claims(date_rx_written);
CREATE INDEX idx_claims_fill_date ON claims(fill_date);
CREATE INDEX idx_claims_refill_number ON claims(refill_number);
CREATE INDEX idx_claims_claim_id ON claims(claim_id);
CREATE INDEX idx_claims_ndc ON claims(ndc);
CREATE INDEX idx_claims_patient_id ON claims(patient_id);
CREATE INDEX idx_claims_medical_record_number ON claims(medical_record_number);

-- Enable RLS
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prescriptions
CREATE POLICY "Authenticated users can view prescriptions" ON prescriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert prescriptions" ON prescriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update prescriptions" ON prescriptions FOR UPDATE TO authenticated USING (true);

-- RLS Policies for claims
CREATE POLICY "Authenticated users can view claims" ON claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert claims" ON claims FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update claims" ON claims FOR UPDATE TO authenticated USING (true);

-- Apply updated_at triggers
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();