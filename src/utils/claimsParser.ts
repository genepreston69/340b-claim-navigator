import Papa from "papaparse";

export interface ParsedClaim {
  covered_entity_name: string | null;
  opaid: string | null;
  chain_pharmacy: string | null;
  pharmacy_name: string | null;
  pharmacy_nabp_npi: number | null;
  transaction_code: string | null;
  prescription_number: number;
  date_rx_written: string;
  bin: number | null;
  pcn: string | null;
  plan_group: string | null;
  secondary_bin: number | null;
  secondary_pcn: string | null;
  secondary_group: string | null;
  other_coverage_code: string | null;
  submission_clarification_code: string | null;
  refill_number: number;
  fill_date: string;
  claim_date: string | null;
  claim_id: number | null;
  patient_id_external: string | null;
  gender: string | null;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  prescriber_name: string | null;
  prescriber_npi_dea: string | null;
  ndc: number | null;
  drug_name: string | null;
  package_size: number | null;
  manufacturer_name: string | null;
  drug_indicator: string | null;
  qty_dispensed: number | null;
  days_supply: number | null;
  claim_type: string | null;
  claim_sub_type: string | null;
  reason: string | null;
  sub_reason: string | null;
  patient_pay: number | null;
  third_party_payment: number | null;
  total_payment: number | null;
  dispensing_fee: number | null;
  ce_receivable: number | null;
  drug_cost_340b: number | null;
  total_claim_cost: number | null;
  profit_or_loss: number | null;
  retail_drug_cost: number | null;
  comments: string | null;
  medical_record_number: string | null;
  replenishment_status: string | null;
  billing_model: string | null;
  claim_captured_date: string | null;
  trued_up_units: number | null;
  trued_up_cost: number | null;
  trued_up_date: string | null;
}

export interface ClaimParseProgress {
  current: number;
  total: number;
  percentage: number;
  status: "reading" | "parsing" | "complete" | "error";
  message: string;
}

type ProgressCallback = (progress: ClaimParseProgress) => void;

/**
 * Parses currency string (removes $, commas, and converts to number)
 */
function parseCurrency(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  // Remove $, commas, parentheses (for negative), and whitespace
  const cleaned = String(value)
    .replace(/[$,\s]/g, "")
    .replace(/^\((.+)\)$/, "-$1"); // Handle (123.45) as -123.45
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Parses date in MM/DD/YYYY format to YYYY-MM-DD
 */
function parseUSDate(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const trimmed = String(value).trim();
  
  // Try MM/DD/YYYY format
  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const [, month, day, year] = usMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try YYYY-MM-DD format (already correct)
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return trimmed;
  }

  return null;
}

/**
 * Safely converts a value to a number or returns null
 */
function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(String(value).replace(/,/g, ""));
  return isNaN(num) ? null : num;
}

/**
 * Safely converts a value to a trimmed string or returns null
 */
function toString(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return String(value).trim() || null;
}

/**
 * Parses the ClaimReports CSV file and returns an array of claim objects
 */
export async function parseClaimsFile(
  file: File,
  onProgress?: ProgressCallback
): Promise<ParsedClaim[]> {
  const updateProgress = (progress: Partial<ClaimParseProgress>) => {
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

  return new Promise((resolve, reject) => {
    updateProgress({
      status: "reading",
      message: "Reading file...",
      percentage: 0,
    });

    const claims: ParsedClaim[] = [];
    let rowCount = 0;
    let skippedRows = 0;
    let totalRows = 0;

    // First, count total rows for progress tracking
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      totalRows = (text.match(/\n/g) || []).length; // Approximate row count

      updateProgress({
        status: "parsing",
        message: `Preparing to parse ${totalRows.toLocaleString()} rows...`,
        total: totalRows,
        percentage: 5,
      });

      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        step: (results, parser) => {
          rowCount++;
          const row = results.data;

          // Update progress every 500 rows
          if (rowCount % 500 === 0) {
            const percentage = Math.min(5 + Math.floor((rowCount / totalRows) * 90), 95);
            updateProgress({
              status: "parsing",
              message: `Processing row ${rowCount.toLocaleString()}...`,
              current: rowCount,
              total: totalRows,
              percentage,
            });
          }

          // Skip rows without Prescription #
          const prescriptionNumber = toNumber(row["Prescription #"]);
          if (prescriptionNumber === null) {
            skippedRows++;
            return;
          }

          // Get required fields
          const dateRxWritten = parseUSDate(row["Date Rx Written"]);
          const fillDate = parseUSDate(row["Fill Date"]);
          const refillNumber = toNumber(row["Refill #"]);

          if (!dateRxWritten || !fillDate || refillNumber === null) {
            skippedRows++;
            return;
          }

          const claim: ParsedClaim = {
            covered_entity_name: toString(row["Covered Entity"]),
            opaid: toString(row["OPAID"]),
            chain_pharmacy: toString(row["Chain Pharmacy"]),
            pharmacy_name: toString(row["Pharmacy"]),
            pharmacy_nabp_npi: toNumber(row["Pharmacy NABP or NPI"]),
            transaction_code: toString(row["Transaction Code"]),
            prescription_number: prescriptionNumber,
            date_rx_written: dateRxWritten,
            bin: toNumber(row["BIN"]),
            pcn: toString(row["PCN"]),
            plan_group: toString(row["Group"]),
            secondary_bin: toNumber(row["Secondary BIN"]),
            secondary_pcn: toString(row["Secondary PCN"]),
            secondary_group: toString(row["Secondary Group"]),
            other_coverage_code: toString(row["Other Coverage Code"]),
            submission_clarification_code: toString(row["Submission Clarification Code"]),
            refill_number: refillNumber,
            fill_date: fillDate,
            claim_date: parseUSDate(row["Claim Date"]),
            claim_id: toNumber(row["Claim ID"]),
            patient_id_external: toString(row["Patient ID"]),
            gender: toString(row["Gender"]),
            first_name: toString(row["First Name"]),
            last_name: toString(row["Last Name"]),
            date_of_birth: parseUSDate(row["DOB"]),
            prescriber_name: toString(row["Prescriber Name"]),
            prescriber_npi_dea: toString(row["Prescriber NPI/DEA"]),
            ndc: toNumber(String(row["NDC"]).replace(/-/g, "")),
            drug_name: toString(row["Drug Name"]),
            package_size: toNumber(row["Package Size"]),
            manufacturer_name: toString(row["Mfg. Name"]),
            drug_indicator: toString(row["Drug Indicator"]),
            qty_dispensed: toNumber(row["Qty Dispensed"]),
            days_supply: toNumber(row["Days supply"]),
            claim_type: toString(row["Claim Type"]),
            claim_sub_type: toString(row["Claim Sub Type"]),
            reason: toString(row["Reason"]),
            sub_reason: toString(row["Sub Reason"]),
            // Currency fields
            patient_pay: parseCurrency(row["Patient Pay"]),
            third_party_payment: parseCurrency(row["Third Party Payment"]),
            total_payment: parseCurrency(row["Total Payment"]),
            dispensing_fee: parseCurrency(row["Disp. Fee"]),
            ce_receivable: parseCurrency(row["CE Receivable"]),
            drug_cost_340b: parseCurrency(row["340B Drug Cost"]),
            total_claim_cost: parseCurrency(row["Total Claim Cost"]),
            profit_or_loss: parseCurrency(row["Profit OR Loss"]),
            retail_drug_cost: parseCurrency(row["Retail Drug Cost"]),
            comments: toString(row["Comments"]),
            medical_record_number: toString(row["Medical Record #"]),
            replenishment_status: toString(row["Replenishment Status"]),
            billing_model: toString(row["Billing Model"]),
            claim_captured_date: parseUSDate(row["Claim Captured Date"]),
            trued_up_units: toNumber(row["Trued Up Units"]),
            trued_up_cost: parseCurrency(row["Trued Up Cost"]),
            trued_up_date: parseUSDate(row["Trued Up Date"]),
          };

          claims.push(claim);
        },
        complete: () => {
          updateProgress({
            status: "complete",
            message: `Parsed ${claims.length.toLocaleString()} claims (${skippedRows.toLocaleString()} rows skipped)`,
            current: rowCount,
            total: rowCount,
            percentage: 100,
          });
          resolve(claims);
        },
        error: (error) => {
          updateProgress({
            status: "error",
            message: `Error: ${error.message}`,
            percentage: 0,
          });
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    };

    reader.onerror = () => {
      updateProgress({
        status: "error",
        message: "Failed to read file",
        percentage: 0,
      });
      reject(new Error("Failed to read the CSV file"));
    };

    reader.readAsText(file);
  });
}
