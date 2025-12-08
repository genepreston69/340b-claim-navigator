-- Covered Entities (340B registered organizations)
CREATE TABLE covered_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_name VARCHAR(255) NOT NULL,
    opaid VARCHAR(50) UNIQUE NOT NULL,
    organization_identifier VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pharmacies
CREATE TABLE pharmacies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pharmacy_name VARCHAR(255) NOT NULL,
    chain_pharmacy VARCHAR(255),
    nabp_number BIGINT,
    npi_number BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prescribers
CREATE TABLE prescribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(150) NOT NULL,
    suffix VARCHAR(20),
    npi BIGINT,
    dea_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Locations
CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_identifier VARCHAR(50) UNIQUE,
    location_name VARCHAR(255) NOT NULL,
    covered_entity_id UUID REFERENCES covered_entities(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drugs
CREATE TABLE drugs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ndc_code VARCHAR(20) NOT NULL UNIQUE,
    drug_name VARCHAR(255),
    manufacturer_name VARCHAR(255),
    package_size DECIMAL(10,2),
    drug_indicator VARCHAR(10),
    drug_form VARCHAR(100),
    dose VARCHAR(50),
    dose_units VARCHAR(20),
    route_of_administration VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patients
CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mrn VARCHAR(50),
    patient_id_external VARCHAR(50),
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    last_name VARCHAR(150) NOT NULL,
    suffix VARCHAR(20),
    date_of_birth DATE,
    gender VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance Plans
CREATE TABLE insurance_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insurance_company VARCHAR(255) NOT NULL,
    plan_group VARCHAR(100),
    bin VARCHAR(20),
    pcn VARCHAR(50),
    is_medicaid BOOLEAN DEFAULT FALSE,
    is_primary BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes on key lookup fields
CREATE INDEX idx_covered_entities_opaid ON covered_entities(opaid);
CREATE INDEX idx_pharmacies_npi ON pharmacies(npi_number);
CREATE INDEX idx_prescribers_npi ON prescribers(npi);
CREATE INDEX idx_drugs_ndc ON drugs(ndc_code);
CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_locations_covered_entity ON locations(covered_entity_id);

-- Enable RLS on all tables
ALTER TABLE covered_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE pharmacies ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE drugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can read all reference data
CREATE POLICY "Authenticated users can view covered entities" ON covered_entities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view pharmacies" ON pharmacies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view prescribers" ON prescribers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view locations" ON locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view drugs" ON drugs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view patients" ON patients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can view insurance plans" ON insurance_plans FOR SELECT TO authenticated USING (true);

-- RLS Policies: Authenticated users can insert data
CREATE POLICY "Authenticated users can insert covered entities" ON covered_entities FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert pharmacies" ON pharmacies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert prescribers" ON prescribers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert locations" ON locations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert drugs" ON drugs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert patients" ON patients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can insert insurance plans" ON insurance_plans FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies: Authenticated users can update data
CREATE POLICY "Authenticated users can update covered entities" ON covered_entities FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update pharmacies" ON pharmacies FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update prescribers" ON prescribers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update locations" ON locations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update drugs" ON drugs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update patients" ON patients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can update insurance plans" ON insurance_plans FOR UPDATE TO authenticated USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_covered_entities_updated_at BEFORE UPDATE ON covered_entities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pharmacies_updated_at BEFORE UPDATE ON pharmacies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prescribers_updated_at BEFORE UPDATE ON prescribers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drugs_updated_at BEFORE UPDATE ON drugs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_insurance_plans_updated_at BEFORE UPDATE ON insurance_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();