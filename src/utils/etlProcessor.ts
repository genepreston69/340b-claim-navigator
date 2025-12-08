import { supabase } from "@/integrations/supabase/client";
import { ParsedPrescription } from "./scriptsParser";
import { ParsedClaim } from "./claimsParser";

const BATCH_SIZE = 500;

export interface ImportSummary {
  totalRecords: number;
  recordsImported: number;
  recordsSkipped: number;
  errors: ImportError[];
  referenceDataCreated: {
    coveredEntities: number;
    pharmacies: number;
    prescribers: number;
    locations: number;
    drugs: number;
    patients: number;
    insurancePlans: number;
  };
}

export interface ImportError {
  row: number;
  field?: string;
  message: string;
}

interface EntityCache {
  coveredEntities: Map<string, string>; // org_identifier -> id
  pharmacies: Map<string, string>; // name_npi -> id
  prescribers: Map<string, string>; // npi_or_name -> id
  locations: Map<string, string>; // identifier_name -> id
  drugs: Map<string, string>; // ndc -> id
  patients: Map<string, string>; // mrn_or_name_dob -> id
  insurancePlans: Map<string, string>; // company_bin_pcn -> id
}

type ProgressCallback = (message: string, percentage: number) => void;

// ============ HELPER FUNCTIONS ============

function generatePatientKey(mrn: string | null, firstName: string | null, lastName: string | null, dob: string | null): string {
  if (mrn) return `mrn:${mrn}`;
  return `name:${firstName?.toLowerCase()}_${lastName?.toLowerCase()}_${dob}`;
}

function generatePharmacyKey(name: string | null, npi: number | null, nabp: number | null): string {
  if (npi) return `npi:${npi}`;
  if (nabp) return `nabp:${nabp}`;
  return `name:${name?.toLowerCase()}`;
}

function generatePrescriberKey(npi: number | null, lastName: string | null, firstName: string | null): string {
  if (npi) return `npi:${npi}`;
  return `name:${lastName?.toLowerCase()}_${firstName?.toLowerCase()}`;
}

function generateDrugKey(ndc: string | null): string {
  return `ndc:${ndc}`;
}

function generateInsuranceKey(company: string | null, bin: string | null, pcn: string | null): string {
  return `${company?.toLowerCase()}_${bin}_${pcn}`;
}

async function batchInsert<T>(
  items: T[],
  insertFn: (batch: T[]) => Promise<void>,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await insertFn(batch);
    onProgress?.(Math.min(i + BATCH_SIZE, items.length), items.length);
  }
}

// ============ SCRIPTS IMPORT PROCESSOR ============

export async function processScriptsImport(
  parsedData: ParsedPrescription[],
  onProgress?: ProgressCallback
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRecords: parsedData.length,
    recordsImported: 0,
    recordsSkipped: 0,
    errors: [],
    referenceDataCreated: {
      coveredEntities: 0,
      pharmacies: 0,
      prescribers: 0,
      locations: 0,
      drugs: 0,
      patients: 0,
      insurancePlans: 0,
    },
  };

  const cache: EntityCache = {
    coveredEntities: new Map(),
    pharmacies: new Map(),
    prescribers: new Map(),
    locations: new Map(),
    drugs: new Map(),
    patients: new Map(),
    insurancePlans: new Map(),
  };

  try {
    // Step 1: Extract and upsert covered entities
    onProgress?.("Extracting covered entities...", 5);
    const coveredEntitiesResult = await upsertCoveredEntitiesFromScripts(parsedData, cache);
    summary.referenceDataCreated.coveredEntities = coveredEntitiesResult.created;
    summary.errors.push(...coveredEntitiesResult.errors);

    // Step 2: Extract and upsert pharmacies
    onProgress?.("Extracting pharmacies...", 15);
    const pharmaciesResult = await upsertPharmaciesFromScripts(parsedData, cache);
    summary.referenceDataCreated.pharmacies = pharmaciesResult.created;
    summary.errors.push(...pharmaciesResult.errors);

    // Step 3: Extract and upsert prescribers
    onProgress?.("Extracting prescribers...", 25);
    const prescribersResult = await upsertPrescribersFromScripts(parsedData, cache);
    summary.referenceDataCreated.prescribers = prescribersResult.created;
    summary.errors.push(...prescribersResult.errors);

    // Step 4: Extract and upsert locations
    onProgress?.("Extracting locations...", 35);
    const locationsResult = await upsertLocationsFromScripts(parsedData, cache);
    summary.referenceDataCreated.locations = locationsResult.created;
    summary.errors.push(...locationsResult.errors);

    // Step 5: Extract and upsert drugs
    onProgress?.("Extracting drugs...", 45);
    const drugsResult = await upsertDrugsFromScripts(parsedData, cache);
    summary.referenceDataCreated.drugs = drugsResult.created;
    summary.errors.push(...drugsResult.errors);

    // Step 6: Extract and upsert patients
    onProgress?.("Extracting patients...", 55);
    const patientsResult = await upsertPatientsFromScripts(parsedData, cache);
    summary.referenceDataCreated.patients = patientsResult.created;
    summary.errors.push(...patientsResult.errors);

    // Step 7: Extract and upsert insurance plans
    onProgress?.("Extracting insurance plans...", 65);
    const insuranceResult = await upsertInsurancePlansFromScripts(parsedData, cache);
    summary.referenceDataCreated.insurancePlans = insuranceResult.created;
    summary.errors.push(...insuranceResult.errors);

    // Step 8: Insert prescriptions
    onProgress?.("Inserting prescriptions...", 75);
    const prescriptionsResult = await insertPrescriptions(parsedData, cache, (current, total) => {
      const pct = 75 + Math.floor((current / total) * 20);
      onProgress?.(`Inserting prescriptions... (${current}/${total})`, pct);
    });
    summary.recordsImported = prescriptionsResult.imported;
    summary.recordsSkipped = prescriptionsResult.skipped;
    summary.errors.push(...prescriptionsResult.errors);

    onProgress?.("Import complete!", 100);
  } catch (error) {
    summary.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }

  return summary;
}

// ============ CLAIMS IMPORT PROCESSOR ============

export async function processClaimsImport(
  parsedData: ParsedClaim[],
  onProgress?: ProgressCallback
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    totalRecords: parsedData.length,
    recordsImported: 0,
    recordsSkipped: 0,
    errors: [],
    referenceDataCreated: {
      coveredEntities: 0,
      pharmacies: 0,
      prescribers: 0,
      locations: 0,
      drugs: 0,
      patients: 0,
      insurancePlans: 0,
    },
  };

  const cache: EntityCache = {
    coveredEntities: new Map(),
    pharmacies: new Map(),
    prescribers: new Map(),
    locations: new Map(),
    drugs: new Map(),
    patients: new Map(),
    insurancePlans: new Map(),
  };

  try {
    // Step 1: Extract and upsert covered entities
    onProgress?.("Extracting covered entities...", 5);
    const coveredEntitiesResult = await upsertCoveredEntitiesFromClaims(parsedData, cache);
    summary.referenceDataCreated.coveredEntities = coveredEntitiesResult.created;
    summary.errors.push(...coveredEntitiesResult.errors);

    // Step 2: Extract and upsert pharmacies
    onProgress?.("Extracting pharmacies...", 20);
    const pharmaciesResult = await upsertPharmaciesFromClaims(parsedData, cache);
    summary.referenceDataCreated.pharmacies = pharmaciesResult.created;
    summary.errors.push(...pharmaciesResult.errors);

    // Step 3: Extract and upsert prescribers
    onProgress?.("Extracting prescribers...", 35);
    const prescribersResult = await upsertPrescribersFromClaims(parsedData, cache);
    summary.referenceDataCreated.prescribers = prescribersResult.created;
    summary.errors.push(...prescribersResult.errors);

    // Step 4: Extract and upsert drugs
    onProgress?.("Extracting drugs...", 50);
    const drugsResult = await upsertDrugsFromClaims(parsedData, cache);
    summary.referenceDataCreated.drugs = drugsResult.created;
    summary.errors.push(...drugsResult.errors);

    // Step 5: Extract and upsert patients
    onProgress?.("Extracting patients...", 65);
    const patientsResult = await upsertPatientsFromClaims(parsedData, cache);
    summary.referenceDataCreated.patients = patientsResult.created;
    summary.errors.push(...patientsResult.errors);

    // Step 6: Insert claims
    onProgress?.("Inserting claims...", 75);
    const claimsResult = await insertClaims(parsedData, cache, (current, total) => {
      const pct = 75 + Math.floor((current / total) * 20);
      onProgress?.(`Inserting claims... (${current}/${total})`, pct);
    });
    summary.recordsImported = claimsResult.imported;
    summary.recordsSkipped = claimsResult.skipped;
    summary.errors.push(...claimsResult.errors);

    onProgress?.("Import complete!", 100);
  } catch (error) {
    summary.errors.push({
      row: 0,
      message: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }

  return summary;
}

// ============ UPSERT FUNCTIONS FOR SCRIPTS ============

async function upsertCoveredEntitiesFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniqueEntities = new Map<string, { organization_identifier: string }>();

  data.forEach((row, index) => {
    if (row.organization_identifier) {
      uniqueEntities.set(row.organization_identifier, {
        organization_identifier: row.organization_identifier,
      });
    }
  });

  if (uniqueEntities.size === 0) return { created: 0, errors };

  const entities = Array.from(uniqueEntities.values());
  let created = 0;

  for (const entity of entities) {
    try {
      // Check if exists
      const { data: existing } = await supabase
        .from("covered_entities")
        .select("id")
        .eq("organization_identifier", entity.organization_identifier)
        .maybeSingle();

      if (existing) {
        cache.coveredEntities.set(entity.organization_identifier, existing.id);
      } else {
        // Insert new
        const { data: inserted, error } = await supabase
          .from("covered_entities")
          .insert({
            organization_identifier: entity.organization_identifier,
            entity_name: entity.organization_identifier, // Use org_id as name if not provided
            opaid: entity.organization_identifier, // Placeholder
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.coveredEntities.set(entity.organization_identifier, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "covered_entity",
        message: `Failed to upsert covered entity ${entity.organization_identifier}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPharmaciesFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePharmacies = new Map<string, { name: string; npi: number | null; nabp: number | null }>();

  data.forEach((row) => {
    if (row.pharmacy_name) {
      const key = generatePharmacyKey(row.pharmacy_name, row.pharmacy_npi, row.pharmacy_nabp);
      uniquePharmacies.set(key, {
        name: row.pharmacy_name,
        npi: row.pharmacy_npi,
        nabp: row.pharmacy_nabp,
      });
    }
  });

  if (uniquePharmacies.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, pharmacy] of uniquePharmacies) {
    try {
      // Try to find by NPI first, then NABP, then name
      let existing = null;
      
      if (pharmacy.npi) {
        const { data } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("npi_number", pharmacy.npi)
          .maybeSingle();
        existing = data;
      }
      
      if (!existing && pharmacy.nabp) {
        const { data } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("nabp_number", pharmacy.nabp)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.pharmacies.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("pharmacies")
          .insert({
            pharmacy_name: pharmacy.name,
            npi_number: pharmacy.npi,
            nabp_number: pharmacy.nabp,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.pharmacies.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "pharmacy",
        message: `Failed to upsert pharmacy ${pharmacy.name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPrescribersFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePrescribers = new Map<string, {
    first_name: string | null;
    middle_name: string | null;
    last_name: string;
    suffix: string | null;
    npi: number | null;
    dea: string | null;
  }>();

  data.forEach((row) => {
    if (row.prescriber_last_name) {
      const key = generatePrescriberKey(row.prescriber_npi, row.prescriber_last_name, row.prescriber_first_name);
      uniquePrescribers.set(key, {
        first_name: row.prescriber_first_name,
        middle_name: row.prescriber_middle_name,
        last_name: row.prescriber_last_name,
        suffix: row.prescriber_suffix,
        npi: row.prescriber_npi,
        dea: row.prescriber_dea,
      });
    }
  });

  if (uniquePrescribers.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, prescriber] of uniquePrescribers) {
    try {
      let existing = null;

      if (prescriber.npi) {
        const { data } = await supabase
          .from("prescribers")
          .select("id")
          .eq("npi", prescriber.npi)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.prescribers.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("prescribers")
          .insert({
            first_name: prescriber.first_name,
            middle_name: prescriber.middle_name,
            last_name: prescriber.last_name,
            suffix: prescriber.suffix,
            npi: prescriber.npi,
            dea_number: prescriber.dea,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.prescribers.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "prescriber",
        message: `Failed to upsert prescriber ${prescriber.last_name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertLocationsFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniqueLocations = new Map<string, {
    identifier: string | null;
    name: string | null;
    org_identifier: string | null;
  }>();

  data.forEach((row) => {
    if (row.location_name || row.location_identifier) {
      const key = `${row.location_identifier}_${row.location_name}`;
      uniqueLocations.set(key, {
        identifier: row.location_identifier,
        name: row.location_name,
        org_identifier: row.organization_identifier,
      });
    }
  });

  if (uniqueLocations.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, location] of uniqueLocations) {
    try {
      let existing = null;

      if (location.identifier) {
        const { data } = await supabase
          .from("locations")
          .select("id")
          .eq("location_identifier", location.identifier)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.locations.set(key, existing.id);
      } else {
        const coveredEntityId = location.org_identifier
          ? cache.coveredEntities.get(location.org_identifier)
          : null;

        const { data: inserted, error } = await supabase
          .from("locations")
          .insert({
            location_identifier: location.identifier,
            location_name: location.name || location.identifier || "Unknown",
            covered_entity_id: coveredEntityId,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.locations.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "location",
        message: `Failed to upsert location ${location.name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertDrugsFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniqueDrugs = new Map<string, {
    ndc_code: string;
    drug_name: string | null;
    dose: string | null;
    dose_units: string | null;
    drug_form: string | null;
    route_of_administration: string | null;
  }>();

  data.forEach((row) => {
    if (row.ndc_code) {
      const key = generateDrugKey(row.ndc_code);
      uniqueDrugs.set(key, {
        ndc_code: row.ndc_code,
        drug_name: row.medication_name,
        dose: row.dose,
        dose_units: row.dose_units,
        drug_form: row.drug_form,
        route_of_administration: row.route_of_administration,
      });
    }
  });

  if (uniqueDrugs.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, drug] of uniqueDrugs) {
    try {
      const { data: existing } = await supabase
        .from("drugs")
        .select("id")
        .eq("ndc_code", drug.ndc_code)
        .maybeSingle();

      if (existing) {
        cache.drugs.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("drugs")
          .insert({
            ndc_code: drug.ndc_code,
            drug_name: drug.drug_name,
            dose: drug.dose,
            dose_units: drug.dose_units,
            drug_form: drug.drug_form,
            route_of_administration: drug.route_of_administration,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.drugs.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "drug",
        message: `Failed to upsert drug ${drug.ndc_code}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPatientsFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePatients = new Map<string, {
    mrn: string | null;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    suffix: string | null;
    dob: string | null;
  }>();

  data.forEach((row) => {
    const key = generatePatientKey(row.patient_mrn, row.patient_first_name, row.patient_last_name, row.patient_dob);
    uniquePatients.set(key, {
      mrn: row.patient_mrn,
      first_name: row.patient_first_name,
      middle_name: row.patient_middle_name,
      last_name: row.patient_last_name,
      suffix: row.patient_suffix,
      dob: row.patient_dob,
    });
  });

  if (uniquePatients.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, patient] of uniquePatients) {
    try {
      let existing = null;

      // Try to match by MRN first
      if (patient.mrn) {
        const { data } = await supabase
          .from("patients")
          .select("id")
          .eq("mrn", patient.mrn)
          .maybeSingle();
        existing = data;
      }

      // If no MRN match, try name + DOB
      if (!existing && patient.dob) {
        const { data } = await supabase
          .from("patients")
          .select("id")
          .eq("first_name", patient.first_name)
          .eq("last_name", patient.last_name)
          .eq("date_of_birth", patient.dob)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.patients.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("patients")
          .insert({
            mrn: patient.mrn,
            first_name: patient.first_name,
            middle_name: patient.middle_name,
            last_name: patient.last_name,
            suffix: patient.suffix,
            date_of_birth: patient.dob,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.patients.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "patient",
        message: `Failed to upsert patient ${patient.last_name}, ${patient.first_name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertInsurancePlansFromScripts(
  data: ParsedPrescription[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePlans = new Map<string, {
    company: string;
    bin: string | null;
    pcn: string | null;
    group: string | null;
    is_medicaid: boolean;
    is_primary: boolean;
  }>();

  data.forEach((row) => {
    // Primary insurance
    if (row.primary_insurance_company) {
      const key = generateInsuranceKey(row.primary_insurance_company, row.primary_bin, row.primary_pcn);
      uniquePlans.set(key, {
        company: row.primary_insurance_company,
        bin: row.primary_bin,
        pcn: row.primary_pcn,
        group: row.primary_group,
        is_medicaid: row.primary_is_medicaid,
        is_primary: true,
      });
    }
    // Secondary insurance
    if (row.secondary_insurance_company) {
      const key = generateInsuranceKey(row.secondary_insurance_company, row.secondary_bin, row.secondary_pcn);
      uniquePlans.set(key, {
        company: row.secondary_insurance_company,
        bin: row.secondary_bin,
        pcn: row.secondary_pcn,
        group: row.secondary_group,
        is_medicaid: row.secondary_is_medicaid,
        is_primary: false,
      });
    }
  });

  if (uniquePlans.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, plan] of uniquePlans) {
    try {
      const { data: existing } = await supabase
        .from("insurance_plans")
        .select("id")
        .eq("insurance_company", plan.company)
        .eq("bin", plan.bin)
        .eq("pcn", plan.pcn)
        .maybeSingle();

      if (existing) {
        cache.insurancePlans.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("insurance_plans")
          .insert({
            insurance_company: plan.company,
            bin: plan.bin,
            pcn: plan.pcn,
            plan_group: plan.group,
            is_medicaid: plan.is_medicaid,
            is_primary: plan.is_primary,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.insurancePlans.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "insurance_plan",
        message: `Failed to upsert insurance plan ${plan.company}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function insertPrescriptions(
  data: ParsedPrescription[],
  cache: EntityCache,
  onProgress?: (current: number, total: number) => void
): Promise<{ imported: number; skipped: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  const prescriptions = data.map((row, index) => {
    const patientKey = generatePatientKey(row.patient_mrn, row.patient_first_name, row.patient_last_name, row.patient_dob);
    const pharmacyKey = generatePharmacyKey(row.pharmacy_name, row.pharmacy_npi, row.pharmacy_nabp);
    const prescriberKey = generatePrescriberKey(row.prescriber_npi, row.prescriber_last_name, row.prescriber_first_name);
    const drugKey = generateDrugKey(row.ndc_code);
    const locationKey = `${row.location_identifier}_${row.location_name}`;
    const primaryInsuranceKey = generateInsuranceKey(row.primary_insurance_company, row.primary_bin, row.primary_pcn);
    const secondaryInsuranceKey = generateInsuranceKey(row.secondary_insurance_company, row.secondary_bin, row.secondary_pcn);

    return {
      source_file: row.source_file,
      organization_identifier: row.organization_identifier,
      covered_entity_id: row.organization_identifier ? cache.coveredEntities.get(row.organization_identifier) : null,
      encounter_fin: row.encounter_fin,
      encounter_start_date: row.encounter_start_date,
      encounter_end_date: row.encounter_end_date,
      patient_id: cache.patients.get(patientKey) || null,
      patient_mrn: row.patient_mrn,
      pharmacy_id: cache.pharmacies.get(pharmacyKey) || null,
      prescriber_id: cache.prescribers.get(prescriberKey) || null,
      location_id: cache.locations.get(locationKey) || null,
      drug_id: cache.drugs.get(drugKey) || null,
      primary_insurance_id: cache.insurancePlans.get(primaryInsuranceKey) || null,
      primary_subscriber_number: row.primary_subscriber_number,
      secondary_insurance_id: cache.insurancePlans.get(secondaryInsuranceKey) || null,
      secondary_subscriber_number: row.secondary_subscriber_number,
      prescription_identifier: row.prescription_identifier,
      prescribed_date: row.prescribed_date,
      transmission_method: row.transmission_method,
      status: row.status,
      ndc_code: row.ndc_code,
      medication_name: row.medication_name,
      dispense_quantity: row.dispense_quantity,
      dispense_quantity_unit: row.dispense_quantity_unit,
      refills_authorized: row.refills_authorized,
      days_supply: row.days_supply,
      frequency: row.frequency,
    };
  });

  // Batch insert with upsert on prescription_identifier
  await batchInsert(
    prescriptions,
    async (batch) => {
      const { data: result, error } = await supabase
        .from("prescriptions")
        .upsert(batch, { onConflict: "prescription_identifier", ignoreDuplicates: true })
        .select("id");

      if (error) {
        errors.push({ row: 0, message: `Batch insert error: ${error.message}` });
        skipped += batch.length;
      } else {
        imported += result?.length || 0;
        skipped += batch.length - (result?.length || 0);
      }
    },
    onProgress
  );

  return { imported, skipped, errors };
}

// ============ UPSERT FUNCTIONS FOR CLAIMS ============

async function upsertCoveredEntitiesFromClaims(
  data: ParsedClaim[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniqueEntities = new Map<string, { name: string; opaid: string | null }>();

  data.forEach((row) => {
    if (row.covered_entity_name || row.opaid) {
      const key = row.opaid || row.covered_entity_name || "";
      uniqueEntities.set(key, {
        name: row.covered_entity_name || row.opaid || "Unknown",
        opaid: row.opaid,
      });
    }
  });

  if (uniqueEntities.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, entity] of uniqueEntities) {
    try {
      let existing = null;

      if (entity.opaid) {
        const { data } = await supabase
          .from("covered_entities")
          .select("id")
          .eq("opaid", entity.opaid)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.coveredEntities.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("covered_entities")
          .insert({
            entity_name: entity.name,
            opaid: entity.opaid || key,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.coveredEntities.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "covered_entity",
        message: `Failed to upsert covered entity ${entity.name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPharmaciesFromClaims(
  data: ParsedClaim[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePharmacies = new Map<string, {
    name: string;
    chain: string | null;
    nabp_npi: number | null;
  }>();

  data.forEach((row) => {
    if (row.pharmacy_name) {
      const key = generatePharmacyKey(row.pharmacy_name, row.pharmacy_nabp_npi, null);
      uniquePharmacies.set(key, {
        name: row.pharmacy_name,
        chain: row.chain_pharmacy,
        nabp_npi: row.pharmacy_nabp_npi,
      });
    }
  });

  if (uniquePharmacies.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, pharmacy] of uniquePharmacies) {
    try {
      let existing = null;

      if (pharmacy.nabp_npi) {
        // Try NPI first
        const { data: npiMatch } = await supabase
          .from("pharmacies")
          .select("id")
          .eq("npi_number", pharmacy.nabp_npi)
          .maybeSingle();
        
        if (npiMatch) {
          existing = npiMatch;
        } else {
          // Try NABP
          const { data: nabpMatch } = await supabase
            .from("pharmacies")
            .select("id")
            .eq("nabp_number", pharmacy.nabp_npi)
            .maybeSingle();
          existing = nabpMatch;
        }
      }

      if (existing) {
        cache.pharmacies.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("pharmacies")
          .insert({
            pharmacy_name: pharmacy.name,
            chain_pharmacy: pharmacy.chain,
            npi_number: pharmacy.nabp_npi,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.pharmacies.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "pharmacy",
        message: `Failed to upsert pharmacy ${pharmacy.name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPrescribersFromClaims(
  data: ParsedClaim[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePrescribers = new Map<string, {
    name: string;
    npi_dea: string | null;
  }>();

  data.forEach((row) => {
    if (row.prescriber_name) {
      const key = row.prescriber_npi_dea || row.prescriber_name;
      uniquePrescribers.set(key, {
        name: row.prescriber_name,
        npi_dea: row.prescriber_npi_dea,
      });
    }
  });

  if (uniquePrescribers.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, prescriber] of uniquePrescribers) {
    try {
      let existing = null;

      // Parse NPI from NPI/DEA field (try numeric value)
      const npiMatch = prescriber.npi_dea?.match(/^\d+$/);
      const npi = npiMatch ? parseInt(npiMatch[0], 10) : null;

      if (npi) {
        const { data } = await supabase
          .from("prescribers")
          .select("id")
          .eq("npi", npi)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.prescribers.set(key, existing.id);
      } else {
        // Parse name (assume "Last, First" or "First Last" format)
        const nameParts = prescriber.name.includes(",")
          ? prescriber.name.split(",").map((s) => s.trim())
          : prescriber.name.split(" ");
        
        const lastName = nameParts[0] || prescriber.name;
        const firstName = nameParts[1] || null;

        const { data: inserted, error } = await supabase
          .from("prescribers")
          .insert({
            last_name: lastName,
            first_name: firstName,
            npi: npi,
            dea_number: !npi ? prescriber.npi_dea : null,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.prescribers.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "prescriber",
        message: `Failed to upsert prescriber ${prescriber.name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertDrugsFromClaims(
  data: ParsedClaim[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniqueDrugs = new Map<string, {
    ndc: string;
    name: string | null;
    manufacturer: string | null;
    indicator: string | null;
    package_size: number | null;
  }>();

  data.forEach((row) => {
    if (row.ndc) {
      const ndcString = String(row.ndc).padStart(11, "0");
      const key = generateDrugKey(ndcString);
      uniqueDrugs.set(key, {
        ndc: ndcString,
        name: row.drug_name,
        manufacturer: row.manufacturer_name,
        indicator: row.drug_indicator,
        package_size: row.package_size,
      });
    }
  });

  if (uniqueDrugs.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, drug] of uniqueDrugs) {
    try {
      const { data: existing } = await supabase
        .from("drugs")
        .select("id")
        .eq("ndc_code", drug.ndc)
        .maybeSingle();

      if (existing) {
        cache.drugs.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("drugs")
          .insert({
            ndc_code: drug.ndc,
            drug_name: drug.name,
            manufacturer_name: drug.manufacturer,
            drug_indicator: drug.indicator,
            package_size: drug.package_size,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.drugs.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "drug",
        message: `Failed to upsert drug ${drug.ndc}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function upsertPatientsFromClaims(
  data: ParsedClaim[],
  cache: EntityCache
): Promise<{ created: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  const uniquePatients = new Map<string, {
    mrn: string | null;
    external_id: string | null;
    first_name: string | null;
    last_name: string | null;
    dob: string | null;
    gender: string | null;
  }>();

  data.forEach((row) => {
    if (row.first_name && row.last_name) {
      const key = generatePatientKey(row.medical_record_number, row.first_name, row.last_name, row.date_of_birth);
      uniquePatients.set(key, {
        mrn: row.medical_record_number,
        external_id: row.patient_id_external,
        first_name: row.first_name,
        last_name: row.last_name,
        dob: row.date_of_birth,
        gender: row.gender,
      });
    }
  });

  if (uniquePatients.size === 0) return { created: 0, errors };

  let created = 0;

  for (const [key, patient] of uniquePatients) {
    try {
      let existing = null;

      // Try MRN first
      if (patient.mrn) {
        const { data } = await supabase
          .from("patients")
          .select("id")
          .eq("mrn", patient.mrn)
          .maybeSingle();
        existing = data;
      }

      // Try name + DOB
      if (!existing && patient.dob && patient.first_name && patient.last_name) {
        const { data } = await supabase
          .from("patients")
          .select("id")
          .eq("first_name", patient.first_name)
          .eq("last_name", patient.last_name)
          .eq("date_of_birth", patient.dob)
          .maybeSingle();
        existing = data;
      }

      if (existing) {
        cache.patients.set(key, existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("patients")
          .insert({
            mrn: patient.mrn,
            patient_id_external: patient.external_id,
            first_name: patient.first_name || "Unknown",
            last_name: patient.last_name || "Unknown",
            date_of_birth: patient.dob,
            gender: patient.gender,
          })
          .select("id")
          .single();

        if (error) throw error;
        cache.patients.set(key, inserted.id);
        created++;
      }
    } catch (error) {
      errors.push({
        row: 0,
        field: "patient",
        message: `Failed to upsert patient ${patient.last_name}, ${patient.first_name}: ${error}`,
      });
    }
  }

  return { created, errors };
}

async function insertClaims(
  data: ParsedClaim[],
  cache: EntityCache,
  onProgress?: (current: number, total: number) => void
): Promise<{ imported: number; skipped: number; errors: ImportError[] }> {
  const errors: ImportError[] = [];
  let imported = 0;
  let skipped = 0;

  const claims = data.map((row) => {
    const patientKey = generatePatientKey(row.medical_record_number, row.first_name, row.last_name, row.date_of_birth);
    const pharmacyKey = generatePharmacyKey(row.pharmacy_name, row.pharmacy_nabp_npi, null);
    const prescriberKey = row.prescriber_npi_dea || row.prescriber_name || "";
    const ndcString = row.ndc ? String(row.ndc).padStart(11, "0") : null;
    const drugKey = generateDrugKey(ndcString);
    const ceKey = row.opaid || row.covered_entity_name || "";

    return {
      covered_entity_id: cache.coveredEntities.get(ceKey) || null,
      covered_entity_name: row.covered_entity_name,
      opaid: row.opaid,
      pharmacy_id: cache.pharmacies.get(pharmacyKey) || null,
      chain_pharmacy: row.chain_pharmacy,
      pharmacy_name: row.pharmacy_name,
      pharmacy_nabp_npi: row.pharmacy_nabp_npi,
      transaction_code: row.transaction_code,
      prescription_number: row.prescription_number,
      date_rx_written: row.date_rx_written,
      bin: row.bin,
      pcn: row.pcn,
      plan_group: row.plan_group,
      secondary_bin: row.secondary_bin,
      secondary_pcn: row.secondary_pcn,
      secondary_group: row.secondary_group,
      other_coverage_code: row.other_coverage_code,
      submission_clarification_code: row.submission_clarification_code,
      refill_number: row.refill_number,
      fill_date: row.fill_date,
      claim_date: row.claim_date,
      claim_id: row.claim_id,
      claim_captured_date: row.claim_captured_date,
      patient_id: cache.patients.get(patientKey) || null,
      patient_id_external: row.patient_id_external,
      gender: row.gender,
      first_name: row.first_name,
      last_name: row.last_name,
      date_of_birth: row.date_of_birth,
      medical_record_number: row.medical_record_number,
      prescriber_id: cache.prescribers.get(prescriberKey) || null,
      prescriber_name: row.prescriber_name,
      prescriber_npi_dea: row.prescriber_npi_dea,
      drug_id: cache.drugs.get(drugKey) || null,
      ndc: row.ndc,
      drug_name: row.drug_name,
      package_size: row.package_size,
      manufacturer_name: row.manufacturer_name,
      drug_indicator: row.drug_indicator,
      qty_dispensed: row.qty_dispensed,
      days_supply: row.days_supply,
      claim_type: row.claim_type,
      claim_sub_type: row.claim_sub_type,
      reason: row.reason,
      sub_reason: row.sub_reason,
      patient_pay: row.patient_pay,
      third_party_payment: row.third_party_payment,
      total_payment: row.total_payment,
      dispensing_fee: row.dispensing_fee,
      ce_receivable: row.ce_receivable,
      drug_cost_340b: row.drug_cost_340b,
      total_claim_cost: row.total_claim_cost,
      profit_or_loss: row.profit_or_loss,
      retail_drug_cost: row.retail_drug_cost,
      comments: row.comments,
      replenishment_status: row.replenishment_status,
      billing_model: row.billing_model,
      trued_up_units: row.trued_up_units,
      trued_up_cost: row.trued_up_cost,
      trued_up_date: row.trued_up_date,
    };
  });

  // Batch insert - use prescription_number + refill_number + fill_date as natural key
  await batchInsert(
    claims,
    async (batch) => {
      const { data: result, error } = await supabase
        .from("claims")
        .insert(batch)
        .select("id");

      if (error) {
        // Check for duplicate key errors
        if (error.code === "23505") {
          skipped += batch.length;
        } else {
          errors.push({ row: 0, message: `Batch insert error: ${error.message}` });
          skipped += batch.length;
        }
      } else {
        imported += result?.length || 0;
      }
    },
    onProgress
  );

  return { imported, skipped, errors };
}
