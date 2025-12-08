-- Drop existing restrictive policies and create permissive ones for all tables

-- Pharmacies
DROP POLICY IF EXISTS "Authenticated users can insert pharmacies" ON public.pharmacies;
DROP POLICY IF EXISTS "Authenticated users can update pharmacies" ON public.pharmacies;
DROP POLICY IF EXISTS "Authenticated users can view pharmacies" ON public.pharmacies;

CREATE POLICY "Allow all operations on pharmacies" ON public.pharmacies FOR ALL USING (true) WITH CHECK (true);

-- Patients
DROP POLICY IF EXISTS "Authenticated users can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can update patients" ON public.patients;
DROP POLICY IF EXISTS "Authenticated users can view patients" ON public.patients;

CREATE POLICY "Allow all operations on patients" ON public.patients FOR ALL USING (true) WITH CHECK (true);

-- Drugs
DROP POLICY IF EXISTS "Authenticated users can insert drugs" ON public.drugs;
DROP POLICY IF EXISTS "Authenticated users can update drugs" ON public.drugs;
DROP POLICY IF EXISTS "Authenticated users can view drugs" ON public.drugs;

CREATE POLICY "Allow all operations on drugs" ON public.drugs FOR ALL USING (true) WITH CHECK (true);

-- Prescribers
DROP POLICY IF EXISTS "Authenticated users can insert prescribers" ON public.prescribers;
DROP POLICY IF EXISTS "Authenticated users can update prescribers" ON public.prescribers;
DROP POLICY IF EXISTS "Authenticated users can view prescribers" ON public.prescribers;

CREATE POLICY "Allow all operations on prescribers" ON public.prescribers FOR ALL USING (true) WITH CHECK (true);

-- Prescriptions
DROP POLICY IF EXISTS "Authenticated users can insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Authenticated users can update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Authenticated users can view prescriptions" ON public.prescriptions;

CREATE POLICY "Allow all operations on prescriptions" ON public.prescriptions FOR ALL USING (true) WITH CHECK (true);

-- Claims
DROP POLICY IF EXISTS "Authenticated users can insert claims" ON public.claims;
DROP POLICY IF EXISTS "Authenticated users can update claims" ON public.claims;
DROP POLICY IF EXISTS "Authenticated users can view claims" ON public.claims;

CREATE POLICY "Allow all operations on claims" ON public.claims FOR ALL USING (true) WITH CHECK (true);

-- Insurance Plans
DROP POLICY IF EXISTS "Authenticated users can insert insurance plans" ON public.insurance_plans;
DROP POLICY IF EXISTS "Authenticated users can update insurance plans" ON public.insurance_plans;
DROP POLICY IF EXISTS "Authenticated users can view insurance plans" ON public.insurance_plans;

CREATE POLICY "Allow all operations on insurance_plans" ON public.insurance_plans FOR ALL USING (true) WITH CHECK (true);

-- Locations
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can update locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can view locations" ON public.locations;

CREATE POLICY "Allow all operations on locations" ON public.locations FOR ALL USING (true) WITH CHECK (true);

-- Covered Entities
DROP POLICY IF EXISTS "Authenticated users can insert covered entities" ON public.covered_entities;
DROP POLICY IF EXISTS "Authenticated users can update covered entities" ON public.covered_entities;
DROP POLICY IF EXISTS "Authenticated users can view covered entities" ON public.covered_entities;

CREATE POLICY "Allow all operations on covered_entities" ON public.covered_entities FOR ALL USING (true) WITH CHECK (true);