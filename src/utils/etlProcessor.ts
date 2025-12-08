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

  data.forEach((row) => {
    if (row.organization_identifier) {
      uniqueEntities.set(row.organization_identifier, {
        organization_identifier: row.organization_identifier,
      });
    }
  });

  if (uniqueEntities.size === 0) return { created: 0, errors };

  try {
    // Batch fetch all existing covered entities
    const { data: existingEntities, error: fetchError } = await supabase
      .from("covered_entities")
      .select("id, organization_identifier");

    if (fetchError) throw fetchError;

    const existingByOrgId = new Map<string, string>();
    existingEntities?.forEach((e) => {
      if (e.organization_identifier) {
        existingByOrgId.set(e.organization_identifier, e.id);
      }
    });

    const toInsert: { organization_identifier: string; entity_name: string; opaid: string }[] = [];

    for (const [orgId, entity] of uniqueEntities) {
      const existingId = existingByOrgId.get(orgId);
      if (existingId) {
        cache.coveredEntities.set(orgId, existingId);
      } else {
        toInsert.push({
          organization_identifier: entity.organization_identifier,
          entity_name: entity.organization_identifier,
          opaid: entity.organization_identifier,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("covered_entities")
        .insert(toInsert)
        .select("id, organization_identifier");

      if (insertError) throw insertError;

      inserted?.forEach((e) => {
        if (e.organization_identifier) {
          cache.coveredEntities.set(e.organization_identifier, e.id);
        }
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "covered_entity",
      message: `Failed to upsert covered entities: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing pharmacies at once
    const { data: existingPharmacies, error: fetchError } = await supabase
      .from("pharmacies")
      .select("id, pharmacy_name, npi_number, nabp_number");

    if (fetchError) throw fetchError;

    // Build lookup maps for existing pharmacies
    const existingByNpi = new Map<number, string>();
    const existingByNabp = new Map<number, string>();
    const existingByName = new Map<string, string>();

    existingPharmacies?.forEach((p) => {
      if (p.npi_number) existingByNpi.set(p.npi_number, p.id);
      if (p.nabp_number) existingByNabp.set(p.nabp_number, p.id);
      existingByName.set(p.pharmacy_name.toLowerCase(), p.id);
    });

    // Separate existing from new pharmacies
    const toInsert: { pharmacy_name: string; npi_number: number | null; nabp_number: number | null }[] = [];

    for (const [key, pharmacy] of uniquePharmacies) {
      let existingId: string | undefined;

      if (pharmacy.npi) {
        existingId = existingByNpi.get(pharmacy.npi);
      }
      if (!existingId && pharmacy.nabp) {
        existingId = existingByNabp.get(pharmacy.nabp);
      }

      if (existingId) {
        cache.pharmacies.set(key, existingId);
      } else {
        toInsert.push({
          pharmacy_name: pharmacy.name,
          npi_number: pharmacy.npi,
          nabp_number: pharmacy.nabp,
        });
      }
    }

    // Batch insert new pharmacies
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("pharmacies")
        .insert(toInsert)
        .select("id, pharmacy_name, npi_number, nabp_number");

      if (insertError) throw insertError;

      // Add newly inserted to cache
      inserted?.forEach((p) => {
        const key = generatePharmacyKey(p.pharmacy_name, p.npi_number, p.nabp_number);
        cache.pharmacies.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "pharmacy",
      message: `Failed to upsert pharmacies: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing prescribers
    const { data: existingPrescribers, error: fetchError } = await supabase
      .from("prescribers")
      .select("id, npi, last_name, first_name");

    if (fetchError) throw fetchError;

    const existingByNpi = new Map<number, string>();
    existingPrescribers?.forEach((p) => {
      if (p.npi) existingByNpi.set(p.npi, p.id);
    });

    const toInsert: {
      first_name: string | null;
      middle_name: string | null;
      last_name: string;
      suffix: string | null;
      npi: number | null;
      dea_number: string | null;
    }[] = [];

    for (const [key, prescriber] of uniquePrescribers) {
      let existingId: string | undefined;

      if (prescriber.npi) {
        existingId = existingByNpi.get(prescriber.npi);
      }

      if (existingId) {
        cache.prescribers.set(key, existingId);
      } else {
        toInsert.push({
          first_name: prescriber.first_name,
          middle_name: prescriber.middle_name,
          last_name: prescriber.last_name,
          suffix: prescriber.suffix,
          npi: prescriber.npi,
          dea_number: prescriber.dea,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("prescribers")
        .insert(toInsert)
        .select("id, npi, last_name, first_name");

      if (insertError) throw insertError;

      inserted?.forEach((p) => {
        const key = generatePrescriberKey(p.npi, p.last_name, p.first_name);
        cache.prescribers.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "prescriber",
      message: `Failed to upsert prescribers: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing locations
    const { data: existingLocations, error: fetchError } = await supabase
      .from("locations")
      .select("id, location_identifier, location_name");

    if (fetchError) throw fetchError;

    const existingByIdentifier = new Map<string, string>();
    existingLocations?.forEach((l) => {
      if (l.location_identifier) {
        existingByIdentifier.set(l.location_identifier, l.id);
      }
    });

    const toInsert: {
      location_identifier: string | null;
      location_name: string;
      covered_entity_id: string | null;
    }[] = [];

    for (const [key, location] of uniqueLocations) {
      let existingId: string | undefined;

      if (location.identifier) {
        existingId = existingByIdentifier.get(location.identifier);
      }

      if (existingId) {
        cache.locations.set(key, existingId);
      } else {
        const coveredEntityId = location.org_identifier
          ? cache.coveredEntities.get(location.org_identifier)
          : null;

        toInsert.push({
          location_identifier: location.identifier,
          location_name: location.name || location.identifier || "Unknown",
          covered_entity_id: coveredEntityId || null,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("locations")
        .insert(toInsert)
        .select("id, location_identifier, location_name");

      if (insertError) throw insertError;

      inserted?.forEach((l) => {
        const key = `${l.location_identifier}_${l.location_name}`;
        cache.locations.set(key, l.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "location",
      message: `Failed to upsert locations: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing drugs
    const { data: existingDrugs, error: fetchError } = await supabase
      .from("drugs")
      .select("id, ndc_code");

    if (fetchError) throw fetchError;

    const existingByNdc = new Map<string, string>();
    existingDrugs?.forEach((d) => {
      existingByNdc.set(d.ndc_code, d.id);
    });

    const toInsert: {
      ndc_code: string;
      drug_name: string | null;
      dose: string | null;
      dose_units: string | null;
      drug_form: string | null;
      route_of_administration: string | null;
    }[] = [];

    for (const [key, drug] of uniqueDrugs) {
      const existingId = existingByNdc.get(drug.ndc_code);

      if (existingId) {
        cache.drugs.set(key, existingId);
      } else {
        toInsert.push({
          ndc_code: drug.ndc_code,
          drug_name: drug.drug_name,
          dose: drug.dose,
          dose_units: drug.dose_units,
          drug_form: drug.drug_form,
          route_of_administration: drug.route_of_administration,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("drugs")
        .insert(toInsert)
        .select("id, ndc_code");

      if (insertError) throw insertError;

      inserted?.forEach((d) => {
        const key = generateDrugKey(d.ndc_code);
        cache.drugs.set(key, d.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "drug",
      message: `Failed to upsert drugs: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing patients
    const { data: existingPatients, error: fetchError } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name, date_of_birth");

    if (fetchError) throw fetchError;

    const existingByMrn = new Map<string, string>();
    const existingByNameDob = new Map<string, string>();
    
    existingPatients?.forEach((p) => {
      if (p.mrn) existingByMrn.set(p.mrn, p.id);
      if (p.first_name && p.last_name && p.date_of_birth) {
        const nameKey = `${p.first_name.toLowerCase()}_${p.last_name.toLowerCase()}_${p.date_of_birth}`;
        existingByNameDob.set(nameKey, p.id);
      }
    });

    const toInsert: {
      mrn: string | null;
      first_name: string;
      middle_name: string | null;
      last_name: string;
      suffix: string | null;
      date_of_birth: string | null;
    }[] = [];

    for (const [key, patient] of uniquePatients) {
      let existingId: string | undefined;

      if (patient.mrn) {
        existingId = existingByMrn.get(patient.mrn);
      }
      if (!existingId && patient.dob) {
        const nameKey = `${patient.first_name.toLowerCase()}_${patient.last_name.toLowerCase()}_${patient.dob}`;
        existingId = existingByNameDob.get(nameKey);
      }

      if (existingId) {
        cache.patients.set(key, existingId);
      } else {
        toInsert.push({
          mrn: patient.mrn,
          first_name: patient.first_name,
          middle_name: patient.middle_name,
          last_name: patient.last_name,
          suffix: patient.suffix,
          date_of_birth: patient.dob,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("patients")
        .insert(toInsert)
        .select("id, mrn, first_name, last_name, date_of_birth");

      if (insertError) throw insertError;

      inserted?.forEach((p) => {
        const key = generatePatientKey(p.mrn, p.first_name, p.last_name, p.date_of_birth);
        cache.patients.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "patient",
      message: `Failed to upsert patients: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing insurance plans
    const { data: existingPlans, error: fetchError } = await supabase
      .from("insurance_plans")
      .select("id, insurance_company, bin, pcn");

    if (fetchError) throw fetchError;

    const existingByKey = new Map<string, string>();
    existingPlans?.forEach((p) => {
      const key = generateInsuranceKey(p.insurance_company, p.bin, p.pcn);
      existingByKey.set(key, p.id);
    });

    const toInsert: {
      insurance_company: string;
      bin: string | null;
      pcn: string | null;
      plan_group: string | null;
      is_medicaid: boolean;
      is_primary: boolean;
    }[] = [];

    for (const [key, plan] of uniquePlans) {
      const existingId = existingByKey.get(key);

      if (existingId) {
        cache.insurancePlans.set(key, existingId);
      } else {
        toInsert.push({
          insurance_company: plan.company,
          bin: plan.bin,
          pcn: plan.pcn,
          plan_group: plan.group,
          is_medicaid: plan.is_medicaid,
          is_primary: plan.is_primary,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("insurance_plans")
        .insert(toInsert)
        .select("id, insurance_company, bin, pcn");

      if (insertError) throw insertError;

      inserted?.forEach((p) => {
        const key = generateInsuranceKey(p.insurance_company, p.bin, p.pcn);
        cache.insurancePlans.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "insurance_plan",
      message: `Failed to upsert insurance plans: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing covered entities
    const { data: existingEntities, error: fetchError } = await supabase
      .from("covered_entities")
      .select("id, opaid, entity_name");

    if (fetchError) throw fetchError;

    const existingByOpaid = new Map<string, string>();
    existingEntities?.forEach((e) => {
      if (e.opaid) existingByOpaid.set(e.opaid, e.id);
    });

    const toInsert: { entity_name: string; opaid: string }[] = [];

    for (const [key, entity] of uniqueEntities) {
      let existingId: string | undefined;

      if (entity.opaid) {
        existingId = existingByOpaid.get(entity.opaid);
      }

      if (existingId) {
        cache.coveredEntities.set(key, existingId);
      } else {
        toInsert.push({
          entity_name: entity.name,
          opaid: entity.opaid || key,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("covered_entities")
        .insert(toInsert)
        .select("id, opaid");

      if (insertError) throw insertError;

      inserted?.forEach((e) => {
        if (e.opaid) {
          cache.coveredEntities.set(e.opaid, e.id);
        }
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "covered_entity",
      message: `Failed to upsert covered entities: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing pharmacies at once
    const { data: existingPharmacies, error: fetchError } = await supabase
      .from("pharmacies")
      .select("id, pharmacy_name, npi_number, nabp_number");

    if (fetchError) throw fetchError;

    // Build lookup maps for existing pharmacies
    const existingByNpi = new Map<number, string>();
    const existingByNabp = new Map<number, string>();

    existingPharmacies?.forEach((p) => {
      if (p.npi_number) existingByNpi.set(p.npi_number, p.id);
      if (p.nabp_number) existingByNabp.set(p.nabp_number, p.id);
    });

    // Separate existing from new pharmacies
    const toInsert: { pharmacy_name: string; chain_pharmacy: string | null; npi_number: number | null }[] = [];

    for (const [key, pharmacy] of uniquePharmacies) {
      let existingId: string | undefined;

      if (pharmacy.nabp_npi) {
        existingId = existingByNpi.get(pharmacy.nabp_npi) || existingByNabp.get(pharmacy.nabp_npi);
      }

      if (existingId) {
        cache.pharmacies.set(key, existingId);
      } else {
        toInsert.push({
          pharmacy_name: pharmacy.name,
          chain_pharmacy: pharmacy.chain,
          npi_number: pharmacy.nabp_npi,
        });
      }
    }

    // Batch insert new pharmacies
    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("pharmacies")
        .insert(toInsert)
        .select("id, pharmacy_name, npi_number, nabp_number");

      if (insertError) throw insertError;

      // Add newly inserted to cache
      inserted?.forEach((p) => {
        const key = generatePharmacyKey(p.pharmacy_name, p.npi_number, p.nabp_number);
        cache.pharmacies.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "pharmacy",
      message: `Failed to upsert pharmacies: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing prescribers
    const { data: existingPrescribers, error: fetchError } = await supabase
      .from("prescribers")
      .select("id, npi, dea_number");

    if (fetchError) throw fetchError;

    const existingByNpi = new Map<number, string>();
    existingPrescribers?.forEach((p) => {
      if (p.npi) existingByNpi.set(p.npi, p.id);
    });

    const toInsert: {
      last_name: string;
      first_name: string | null;
      npi: number | null;
      dea_number: string | null;
    }[] = [];

    const keyToInsertIndex = new Map<string, number>();

    for (const [key, prescriber] of uniquePrescribers) {
      const npiMatch = prescriber.npi_dea?.match(/^\d+$/);
      const npi = npiMatch ? parseInt(npiMatch[0], 10) : null;

      let existingId: string | undefined;
      if (npi) {
        existingId = existingByNpi.get(npi);
      }

      if (existingId) {
        cache.prescribers.set(key, existingId);
      } else {
        const nameParts = prescriber.name.includes(",")
          ? prescriber.name.split(",").map((s) => s.trim())
          : prescriber.name.split(" ");
        
        const lastName = nameParts[0] || prescriber.name;
        const firstName = nameParts[1] || null;

        keyToInsertIndex.set(key, toInsert.length);
        toInsert.push({
          last_name: lastName,
          first_name: firstName,
          npi: npi,
          dea_number: !npi ? prescriber.npi_dea : null,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("prescribers")
        .insert(toInsert)
        .select("id");

      if (insertError) throw insertError;

      // Map inserted IDs back to keys
      let insertIndex = 0;
      for (const [key, prescriber] of uniquePrescribers) {
        if (keyToInsertIndex.has(key) && inserted?.[insertIndex]) {
          cache.prescribers.set(key, inserted[insertIndex].id);
          insertIndex++;
        }
      }

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "prescriber",
      message: `Failed to upsert prescribers: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing drugs
    const { data: existingDrugs, error: fetchError } = await supabase
      .from("drugs")
      .select("id, ndc_code");

    if (fetchError) throw fetchError;

    const existingByNdc = new Map<string, string>();
    existingDrugs?.forEach((d) => {
      existingByNdc.set(d.ndc_code, d.id);
    });

    const toInsert: {
      ndc_code: string;
      drug_name: string | null;
      manufacturer_name: string | null;
      drug_indicator: string | null;
      package_size: number | null;
    }[] = [];

    for (const [key, drug] of uniqueDrugs) {
      const existingId = existingByNdc.get(drug.ndc);

      if (existingId) {
        cache.drugs.set(key, existingId);
      } else {
        toInsert.push({
          ndc_code: drug.ndc,
          drug_name: drug.name,
          manufacturer_name: drug.manufacturer,
          drug_indicator: drug.indicator,
          package_size: drug.package_size,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("drugs")
        .insert(toInsert)
        .select("id, ndc_code");

      if (insertError) throw insertError;

      inserted?.forEach((d) => {
        const key = generateDrugKey(d.ndc_code);
        cache.drugs.set(key, d.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "drug",
      message: `Failed to upsert drugs: ${error}`,
    });
    return { created: 0, errors };
  }
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

  try {
    // Batch fetch all existing patients
    const { data: existingPatients, error: fetchError } = await supabase
      .from("patients")
      .select("id, mrn, first_name, last_name, date_of_birth");

    if (fetchError) throw fetchError;

    const existingByMrn = new Map<string, string>();
    const existingByNameDob = new Map<string, string>();
    
    existingPatients?.forEach((p) => {
      if (p.mrn) existingByMrn.set(p.mrn, p.id);
      if (p.first_name && p.last_name && p.date_of_birth) {
        const nameKey = `${p.first_name.toLowerCase()}_${p.last_name.toLowerCase()}_${p.date_of_birth}`;
        existingByNameDob.set(nameKey, p.id);
      }
    });

    const toInsert: {
      mrn: string | null;
      patient_id_external: string | null;
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
      gender: string | null;
    }[] = [];

    for (const [key, patient] of uniquePatients) {
      let existingId: string | undefined;

      if (patient.mrn) {
        existingId = existingByMrn.get(patient.mrn);
      }
      if (!existingId && patient.dob && patient.first_name && patient.last_name) {
        const nameKey = `${patient.first_name.toLowerCase()}_${patient.last_name.toLowerCase()}_${patient.dob}`;
        existingId = existingByNameDob.get(nameKey);
      }

      if (existingId) {
        cache.patients.set(key, existingId);
      } else {
        toInsert.push({
          mrn: patient.mrn,
          patient_id_external: patient.external_id,
          first_name: patient.first_name || "Unknown",
          last_name: patient.last_name || "Unknown",
          date_of_birth: patient.dob,
          gender: patient.gender,
        });
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("patients")
        .insert(toInsert)
        .select("id, mrn, first_name, last_name, date_of_birth");

      if (insertError) throw insertError;

      inserted?.forEach((p) => {
        const key = generatePatientKey(p.mrn, p.first_name, p.last_name, p.date_of_birth);
        cache.patients.set(key, p.id);
      });

      return { created: toInsert.length, errors };
    }

    return { created: 0, errors };
  } catch (error) {
    errors.push({
      row: 0,
      field: "patient",
      message: `Failed to upsert patients: ${error}`,
    });
    return { created: 0, errors };
  }
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
