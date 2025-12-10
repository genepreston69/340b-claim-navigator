/**
 * Validation utilities for data imports
 * Provides comprehensive validation rules for claims and prescriptions
 */

export interface ValidationError {
  row: number;
  field: string;
  value: unknown;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

// ============ DATE VALIDATION ============

/**
 * Validates that a date string is in a valid format and reasonable range
 */
export function validateDate(
  value: string | null,
  fieldName: string,
  row: number,
  options: {
    required?: boolean;
    minDate?: Date;
    maxDate?: Date;
    allowFuture?: boolean;
  } = {}
): ValidationError | null {
  const { required = false, minDate, maxDate, allowFuture = false } = options;

  if (!value || value.trim() === "") {
    if (required) {
      return {
        row,
        field: fieldName,
        value,
        message: `${fieldName} is required`,
        severity: "error",
      };
    }
    return null;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} is not a valid date`,
      severity: "error",
    };
  }

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (!allowFuture && date > today) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} cannot be in the future`,
      severity: "error",
    };
  }

  if (minDate && date < minDate) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} is before the minimum allowed date`,
      severity: "warning",
    };
  }

  if (maxDate && date > maxDate) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} is after the maximum allowed date`,
      severity: "warning",
    };
  }

  return null;
}

/**
 * Validates that fill_date is on or after prescribed_date
 */
export function validateDateOrder(
  earlierDate: string | null,
  laterDate: string | null,
  earlierFieldName: string,
  laterFieldName: string,
  row: number
): ValidationError | null {
  if (!earlierDate || !laterDate) return null;

  const earlier = new Date(earlierDate);
  const later = new Date(laterDate);

  if (isNaN(earlier.getTime()) || isNaN(later.getTime())) return null;

  if (later < earlier) {
    return {
      row,
      field: laterFieldName,
      value: laterDate,
      message: `${laterFieldName} (${laterDate}) cannot be before ${earlierFieldName} (${earlierDate})`,
      severity: "error",
    };
  }

  return null;
}

// ============ NUMERIC VALIDATION ============

/**
 * Validates a numeric value is within expected range
 */
export function validateNumber(
  value: number | null,
  fieldName: string,
  row: number,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    allowZero?: boolean;
    allowNegative?: boolean;
  } = {}
): ValidationError | null {
  const { required = false, min, max, allowZero = true, allowNegative = false } = options;

  if (value === null || value === undefined) {
    if (required) {
      return {
        row,
        field: fieldName,
        value,
        message: `${fieldName} is required`,
        severity: "error",
      };
    }
    return null;
  }

  if (typeof value !== "number" || isNaN(value)) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} must be a valid number`,
      severity: "error",
    };
  }

  if (!allowZero && value === 0) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} cannot be zero`,
      severity: "error",
    };
  }

  if (!allowNegative && value < 0) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} cannot be negative`,
      severity: "error",
    };
  }

  if (min !== undefined && value < min) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} must be at least ${min}`,
      severity: "error",
    };
  }

  if (max !== undefined && value > max) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} must be at most ${max}`,
      severity: "warning",
    };
  }

  return null;
}

// ============ FORMAT VALIDATION ============

/**
 * Validates NDC code format (should be 11 digits)
 */
export function validateNDC(
  value: string | null,
  row: number
): ValidationError | null {
  if (!value) return null;

  const cleaned = value.replace(/\D/g, "");

  if (cleaned.length !== 11) {
    return {
      row,
      field: "NDC",
      value,
      message: `NDC should be 11 digits, got ${cleaned.length} digits`,
      severity: "warning",
    };
  }

  return null;
}

/**
 * Validates NPI format (should be 10 digits)
 */
export function validateNPI(
  value: number | string | null,
  fieldName: string,
  row: number
): ValidationError | null {
  if (!value) return null;

  const cleaned = String(value).replace(/\D/g, "");

  if (cleaned.length !== 10) {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} should be 10 digits, got ${cleaned.length} digits`,
      severity: "warning",
    };
  }

  return null;
}

/**
 * Validates required string field is not empty
 */
export function validateRequired(
  value: string | null,
  fieldName: string,
  row: number
): ValidationError | null {
  if (!value || value.trim() === "") {
    return {
      row,
      field: fieldName,
      value,
      message: `${fieldName} is required`,
      severity: "error",
    };
  }
  return null;
}

// ============ CLAIMS-SPECIFIC VALIDATION ============

export interface ClaimValidationContext {
  prescriptionNumber: number;
  dateRxWritten: string;
  fillDate: string;
  refillNumber: number;
  quantity: number | null;
  daysSupply: number | null;
  drugCost340b: number | null;
  totalPayment: number | null;
  ndc: number | null;
  prescriberNpi: string | null;
}

export function validateClaim(
  claim: ClaimValidationContext,
  row: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Required fields
  const requiredErr = validateNumber(claim.prescriptionNumber, "Prescription Number", row, { required: true, min: 1 });
  if (requiredErr) errors.push(requiredErr);

  // Date validations
  const dateWrittenErr = validateDate(claim.dateRxWritten, "Date Rx Written", row, { required: true });
  if (dateWrittenErr) {
    if (dateWrittenErr.severity === "error") errors.push(dateWrittenErr);
    else warnings.push(dateWrittenErr);
  }

  const fillDateErr = validateDate(claim.fillDate, "Fill Date", row, { required: true });
  if (fillDateErr) {
    if (fillDateErr.severity === "error") errors.push(fillDateErr);
    else warnings.push(fillDateErr);
  }

  // Fill date should be on or after date rx written
  const dateOrderErr = validateDateOrder(claim.dateRxWritten, claim.fillDate, "Date Rx Written", "Fill Date", row);
  if (dateOrderErr) errors.push(dateOrderErr);

  // Refill number should be non-negative
  const refillErr = validateNumber(claim.refillNumber, "Refill Number", row, { required: true, min: 0, max: 99 });
  if (refillErr) {
    if (refillErr.severity === "error") errors.push(refillErr);
    else warnings.push(refillErr);
  }

  // Quantity should be positive
  const qtyErr = validateNumber(claim.quantity, "Quantity Dispensed", row, { min: 0.001, max: 99999 });
  if (qtyErr) {
    if (qtyErr.severity === "error") errors.push(qtyErr);
    else warnings.push(qtyErr);
  }

  // Days supply should be reasonable
  const daysErr = validateNumber(claim.daysSupply, "Days Supply", row, { min: 1, max: 365 });
  if (daysErr) warnings.push(daysErr);

  // Financial validations
  const costErr = validateNumber(claim.drugCost340b, "340B Drug Cost", row, { min: 0 });
  if (costErr) warnings.push(costErr);

  // NDC format
  if (claim.ndc) {
    const ndcErr = validateNDC(String(claim.ndc), row);
    if (ndcErr) warnings.push(ndcErr);
  }

  // NPI format
  if (claim.prescriberNpi) {
    const npiErr = validateNPI(claim.prescriberNpi, "Prescriber NPI", row);
    if (npiErr) warnings.push(npiErr);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============ PRESCRIPTION-SPECIFIC VALIDATION ============

export interface PrescriptionValidationContext {
  prescriptionIdentifier: number;
  prescribedDate: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  prescriberLastName: string | null;
  prescriberNpi: number | null;
  ndcCode: string | null;
  dispenseQuantity: number | null;
  refillsAuthorized: number | null;
  daysSupply: number | null;
}

export function validatePrescription(
  rx: PrescriptionValidationContext,
  row: number
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Required fields
  const rxIdErr = validateNumber(rx.prescriptionIdentifier, "Prescription Identifier", row, { required: true, min: 1 });
  if (rxIdErr) errors.push(rxIdErr);

  const dateErr = validateDate(rx.prescribedDate, "Prescribed Date", row, { required: true });
  if (dateErr) {
    if (dateErr.severity === "error") errors.push(dateErr);
    else warnings.push(dateErr);
  }

  // Patient name required
  const patientFirstErr = validateRequired(rx.patientFirstName, "Patient First Name", row);
  if (patientFirstErr) errors.push(patientFirstErr);

  const patientLastErr = validateRequired(rx.patientLastName, "Patient Last Name", row);
  if (patientLastErr) errors.push(patientLastErr);

  // Prescriber required
  const prescriberErr = validateRequired(rx.prescriberLastName, "Prescriber Last Name", row);
  if (prescriberErr) errors.push(prescriberErr);

  // NPI format
  if (rx.prescriberNpi) {
    const npiErr = validateNPI(rx.prescriberNpi, "Prescriber NPI", row);
    if (npiErr) warnings.push(npiErr);
  }

  // NDC format
  if (rx.ndcCode) {
    const ndcErr = validateNDC(rx.ndcCode, row);
    if (ndcErr) warnings.push(ndcErr);
  }

  // Quantity should be positive
  const qtyErr = validateNumber(rx.dispenseQuantity, "Dispense Quantity", row, { min: 0.001, max: 99999 });
  if (qtyErr) warnings.push(qtyErr);

  // Refills should be reasonable
  const refillErr = validateNumber(rx.refillsAuthorized, "Refills Authorized", row, { min: 0, max: 99 });
  if (refillErr) warnings.push(refillErr);

  // Days supply should be reasonable
  const daysErr = validateNumber(rx.daysSupply, "Days Supply", row, { min: 1, max: 365 });
  if (daysErr) warnings.push(daysErr);

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============ BATCH VALIDATION ============

export function aggregateValidationResults(results: ValidationResult[]): {
  totalErrors: number;
  totalWarnings: number;
  allErrors: ValidationError[];
  allWarnings: ValidationError[];
  errorsByField: Record<string, number>;
  warningsByField: Record<string, number>;
} {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];
  const errorsByField: Record<string, number> = {};
  const warningsByField: Record<string, number> = {};

  for (const result of results) {
    for (const error of result.errors) {
      allErrors.push(error);
      errorsByField[error.field] = (errorsByField[error.field] || 0) + 1;
    }
    for (const warning of result.warnings) {
      allWarnings.push(warning);
      warningsByField[warning.field] = (warningsByField[warning.field] || 0) + 1;
    }
  }

  return {
    totalErrors: allErrors.length,
    totalWarnings: allWarnings.length,
    allErrors,
    allWarnings,
    errorsByField,
    warningsByField,
  };
}
