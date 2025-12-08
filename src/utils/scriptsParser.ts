import * as XLSX from "xlsx";

export interface ParsedPrescription {
  source_file: string;
  organization_identifier: string | null;
  encounter_fin: number | null;
  encounter_start_date: string | null;
  encounter_end_date: string | null;
  patient_mrn: string | null;
  patient_first_name: string;
  patient_middle_name: string | null;
  patient_last_name: string;
  patient_suffix: string | null;
  patient_dob: string | null;
  prescriber_first_name: string | null;
  prescriber_middle_name: string | null;
  prescriber_last_name: string;
  prescriber_suffix: string | null;
  prescriber_npi: number | null;
  prescriber_dea: string | null;
  location_identifier: string | null;
  location_name: string | null;
  pharmacy_name: string | null;
  pharmacy_npi: number | null;
  pharmacy_nabp: number | null;
  prescription_identifier: number;
  prescribed_date: string;
  transmission_method: string | null;
  status: string | null;
  ndc_code: string | null;
  medication_name: string | null;
  dispense_quantity: number | null;
  dispense_quantity_unit: string | null;
  refills_authorized: number | null;
  days_supply: number | null;
  frequency: string | null;
  // Insurance fields
  primary_insurance_company: string | null;
  primary_group: string | null;
  primary_subscriber_number: string | null;
  primary_bin: string | null;
  primary_pcn: string | null;
  primary_is_medicaid: boolean;
  secondary_insurance_company: string | null;
  secondary_group: string | null;
  secondary_subscriber_number: string | null;
  secondary_bin: string | null;
  secondary_pcn: string | null;
  secondary_is_medicaid: boolean;
  // Drug details
  dose: string | null;
  dose_units: string | null;
  drug_form: string | null;
  route_of_administration: string | null;
}

export interface ParseProgress {
  current: number;
  total: number;
  percentage: number;
  status: "reading" | "parsing" | "complete" | "error";
  message: string;
}

type ProgressCallback = (progress: ParseProgress) => void;

/**
 * Converts Excel serial date to JavaScript Date string (ISO format)
 */
function excelDateToISO(excelDate: number | string | null | undefined): string | null {
  if (excelDate === null || excelDate === undefined || excelDate === "") {
    return null;
  }

  // If it's already a string date, try to parse it
  if (typeof excelDate === "string") {
    const parsed = new Date(excelDate);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return null;
  }

  // Excel dates are days since 1900-01-01 (with a bug for 1900 leap year)
  if (typeof excelDate === "number") {
    // Excel's epoch is December 30, 1899
    const excelEpoch = new Date(1899, 11, 30);
    const msPerDay = 24 * 60 * 60 * 1000;
    const date = new Date(excelEpoch.getTime() + excelDate * msPerDay);
    return date.toISOString();
  }

  return null;
}

/**
 * Converts Excel serial date to date-only string (YYYY-MM-DD)
 */
function excelDateToDateString(excelDate: number | string | null | undefined): string | null {
  const isoDate = excelDateToISO(excelDate);
  if (!isoDate) return null;
  return isoDate.split("T")[0];
}

/**
 * Normalizes NDC code to 11 digits (removes hyphens, pads with leading zeros)
 */
function normalizeNdcCode(ndc: string | number | null | undefined): string | null {
  if (ndc === null || ndc === undefined || ndc === "") {
    return null;
  }

  // Convert to string and remove any non-numeric characters
  const cleaned = String(ndc).replace(/\D/g, "");

  if (cleaned.length === 0) {
    return null;
  }

  // Pad to 11 digits with leading zeros
  return cleaned.padStart(11, "0");
}

/**
 * Safely converts a value to a number or returns null
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Safely converts a value to a string or returns null
 */
function toString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value).trim();
}

/**
 * Converts a value to boolean (handles "Yes"/"No", "True"/"False", 1/0)
 */
function toBoolean(value: unknown): boolean {
  if (value === null || value === undefined || value === "") {
    return false;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const str = String(value).toLowerCase().trim();
  return str === "yes" || str === "true" || str === "1";
}

/**
 * Parses the combinedscript.xlsx file and returns an array of prescription objects
 */
export async function parseScriptsFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParsedPrescription[]> {
  const updateProgress = (progress: Partial<ParseProgress>) => {
    if (onProgress) {
      onProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: "reading",
        message: "",
        ...progress,
      });
    }
  };

  try {
    updateProgress({
      status: "reading",
      message: "Reading file...",
      percentage: 0,
    });

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    updateProgress({
      status: "reading",
      message: "Parsing Excel workbook...",
      percentage: 10,
    });

    // Parse the workbook
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Get the first sheet (scripts sheet)
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
      throw new Error("No sheets found in the Excel file");
    }

    updateProgress({
      status: "parsing",
      message: "Converting sheet to JSON...",
      percentage: 20,
    });

    // Convert sheet to JSON array
    const rawData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: null,
    });

    const totalRows = rawData.length;
    const prescriptions: ParsedPrescription[] = [];
    let skippedRows = 0;

    updateProgress({
      status: "parsing",
      message: `Processing ${totalRows} rows...`,
      current: 0,
      total: totalRows,
      percentage: 25,
    });

    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];

      // Update progress every 100 rows
      if (i % 100 === 0 || i === rawData.length - 1) {
        const percentage = 25 + Math.floor((i / totalRows) * 70);
        updateProgress({
          status: "parsing",
          message: `Processing row ${i + 1} of ${totalRows}...`,
          current: i + 1,
          total: totalRows,
          percentage,
        });

        // Allow UI to update
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      // Skip rows where PrescriptionIdentifier is empty
      const prescriptionId = toNumber(row["PrescriptionIdentifier"]);
      if (prescriptionId === null) {
        skippedRows++;
        continue;
      }

      // Get required fields
      const prescribedDateRaw = row["PrescribedDate"];
      const prescribedDate = excelDateToDateString(prescribedDateRaw as number | string);

      if (!prescribedDate) {
        console.warn(`Row ${i + 1}: Invalid PrescribedDate, skipping`);
        skippedRows++;
        continue;
      }

      const patientFirstName = toString(row["PatientFirstName"]);
      const patientLastName = toString(row["PatientLastName"]);
      const prescriberLastName = toString(row["PractitionerLastName"]);

      if (!patientFirstName || !patientLastName || !prescriberLastName) {
        console.warn(`Row ${i + 1}: Missing required name fields, skipping`);
        skippedRows++;
        continue;
      }

      // Map row to prescription object (NOTE: PatientSsn is intentionally NOT included for HIPAA)
      const prescription: ParsedPrescription = {
        source_file: file.name,
        organization_identifier: toString(row["OrganizationIdentifier"]),
        encounter_fin: toNumber(row["EncounterFin"]),
        encounter_start_date: excelDateToISO(row["EncounterStartDateTime"] as number | string),
        encounter_end_date: excelDateToISO(row["EncounterEndDateTime"] as number | string),
        patient_mrn: toString(row["PatientMrn"]),
        patient_first_name: patientFirstName,
        patient_middle_name: toString(row["PatientMiddleName"]),
        patient_last_name: patientLastName,
        patient_suffix: toString(row["PatientSuffix"]),
        patient_dob: excelDateToDateString(row["PatientDateOfBirth"] as number | string),
        prescriber_first_name: toString(row["PractitionerFirstName"]),
        prescriber_middle_name: toString(row["PractitionerMiddleName"]),
        prescriber_last_name: prescriberLastName,
        prescriber_suffix: toString(row["PractitionerSuffix"]),
        prescriber_npi: toNumber(row["PractitionerNpi"]),
        prescriber_dea: toString(row["PractitionerDeaNumber"]),
        location_identifier: toString(row["LocationIdentifier"]),
        location_name: toString(row["LocationName"]),
        pharmacy_name: toString(row["PharmacyName"]),
        pharmacy_npi: toNumber(row["PharmacyNpi"]),
        pharmacy_nabp: toNumber(row["PharmacyNabp"]),
        prescription_identifier: prescriptionId,
        prescribed_date: prescribedDate,
        transmission_method: toString(row["TransmissionMethod"]),
        status: toString(row["Status"]),
        ndc_code: normalizeNdcCode(row["NdcCode"] as string | number),
        medication_name: toString(row["MedicationName"]),
        dispense_quantity: toNumber(row["DispenseQuantity"]),
        dispense_quantity_unit: toString(row["DispenseQuantityUnit"]),
        refills_authorized: toNumber(row["Refills"]),
        days_supply: toNumber(row["DaysSupply"]),
        frequency: toString(row["Frequency"]),
        // Insurance fields
        primary_insurance_company: toString(row["InsuranceCompany"]),
        primary_group: toString(row["Group"]),
        primary_subscriber_number: toString(row["SubscriberNumber"]),
        primary_bin: toString(row["Bin"]),
        primary_pcn: toString(row["Pcn"]),
        primary_is_medicaid: toBoolean(row["IsMedicaid"]),
        secondary_insurance_company: toString(row["SecondaryInsuranceCompany"]),
        secondary_group: toString(row["SecondaryGroup"]),
        secondary_subscriber_number: toString(row["SecondarySubscriberNumber"]),
        secondary_bin: toString(row["SecondaryBin"]),
        secondary_pcn: toString(row["SecondaryPcn"]),
        secondary_is_medicaid: toBoolean(row["SecondaryIsMedicaid"]),
        // Drug details
        dose: toString(row["Dose"]),
        dose_units: toString(row["DoseUnits"]),
        drug_form: toString(row["DrugForm"]),
        route_of_administration: toString(row["RouteOfAdministration"]),
      };

      prescriptions.push(prescription);
    }

    updateProgress({
      status: "complete",
      message: `Parsed ${prescriptions.length} prescriptions (${skippedRows} rows skipped)`,
      current: totalRows,
      total: totalRows,
      percentage: 100,
    });

    return prescriptions;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    updateProgress({
      status: "error",
      message: `Error: ${errorMessage}`,
      percentage: 0,
    });
    throw error;
  }
}
