/**
 * Export utilities for generating CSV and Excel files
 */

import * as XLSX from "xlsx";
import { format } from "date-fns";

// ============ TYPES ============

export interface ExportColumn<T> {
  header: string;
  accessor: keyof T | ((row: T) => unknown);
  format?: "currency" | "percent" | "date" | "number" | "text";
  width?: number;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  includeTimestamp?: boolean;
}

// ============ FORMATTERS ============

function formatValue(value: unknown, formatType?: string): string | number {
  if (value === null || value === undefined) return "";

  switch (formatType) {
    case "currency":
      return typeof value === "number" ? value : parseFloat(String(value)) || 0;
    case "percent":
      return typeof value === "number" ? value / 100 : parseFloat(String(value)) / 100 || 0;
    case "date":
      if (value instanceof Date) {
        return format(value, "yyyy-MM-dd");
      }
      if (typeof value === "string" && value) {
        try {
          return format(new Date(value), "yyyy-MM-dd");
        } catch {
          return value;
        }
      }
      return "";
    case "number":
      return typeof value === "number" ? value : parseFloat(String(value)) || 0;
    default:
      return String(value);
  }
}

function getValue<T>(row: T, accessor: keyof T | ((row: T) => unknown)): unknown {
  if (typeof accessor === "function") {
    return accessor(row);
  }
  return row[accessor];
}

// ============ CSV EXPORT ============

export function exportToCSV<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const headers = columns.map((col) => col.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = getValue(row, col.accessor);
      const formatted = formatValue(value, col.format);
      // Escape quotes and wrap in quotes for CSV
      if (typeof formatted === "string") {
        return `"${formatted.replace(/"/g, '""')}"`;
      }
      return formatted;
    })
  );

  const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

  const timestamp = options.includeTimestamp ? `_${format(new Date(), "yyyyMMdd_HHmmss")}` : "";
  const filename = `${options.filename}${timestamp}.csv`;

  downloadFile(csvContent, filename, "text/csv;charset=utf-8;");
}

// ============ EXCEL EXPORT ============

export function exportToExcel<T>(
  data: T[],
  columns: ExportColumn<T>[],
  options: ExportOptions
): void {
  if (data.length === 0) {
    console.warn("No data to export");
    return;
  }

  // Create worksheet data
  const headers = columns.map((col) => col.header);
  const rows = data.map((row) =>
    columns.map((col) => {
      const value = getValue(row, col.accessor);
      return formatValue(value, col.format);
    })
  );

  const wsData = [headers, ...rows];

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  const colWidths = columns.map((col, index) => ({
    wch: col.width || Math.max(col.header.length, 12),
  }));
  ws["!cols"] = colWidths;

  // Apply number formats for currency columns
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
  for (let R = range.s.r + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const col = columns[C];
      if (col?.format === "currency") {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef]) {
          ws[cellRef].z = "$#,##0.00";
        }
      } else if (col?.format === "percent") {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (ws[cellRef]) {
          ws[cellRef].z = "0.0%";
        }
      }
    }
  }

  // Add worksheet to workbook
  const sheetName = options.sheetName || "Data";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate filename
  const timestamp = options.includeTimestamp ? `_${format(new Date(), "yyyyMMdd_HHmmss")}` : "";
  const filename = `${options.filename}${timestamp}.xlsx`;

  // Write and download
  XLSX.writeFile(wb, filename);
}

// ============ MULTI-SHEET EXCEL EXPORT ============

export interface SheetData<T> {
  name: string;
  data: T[];
  columns: ExportColumn<T>[];
}

export function exportMultiSheetExcel(
  sheets: SheetData<unknown>[],
  options: ExportOptions
): void {
  if (sheets.length === 0) {
    console.warn("No sheets to export");
    return;
  }

  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    if (sheet.data.length === 0) continue;

    const headers = sheet.columns.map((col) => col.header);
    const rows = sheet.data.map((row) =>
      sheet.columns.map((col) => {
        const value = getValue(row, col.accessor as keyof typeof row | ((r: typeof row) => unknown));
        return formatValue(value, col.format);
      })
    );

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    ws["!cols"] = sheet.columns.map((col) => ({
      wch: col.width || Math.max(col.header.length, 12),
    }));

    XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31)); // Excel sheet name limit
  }

  const timestamp = options.includeTimestamp ? `_${format(new Date(), "yyyyMMdd_HHmmss")}` : "";
  const filename = `${options.filename}${timestamp}.xlsx`;

  XLSX.writeFile(wb, filename);
}

// ============ HELPER ============

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

// ============ PREDEFINED COLUMN SETS ============

// Claims export columns
export const claimsExportColumns: ExportColumn<{
  prescription_number: number;
  fill_date: string;
  refill_number: number;
  patient_name?: string;
  first_name?: string;
  last_name?: string;
  drug_name?: string;
  ndc?: number;
  pharmacy_name?: string;
  qty_dispensed?: number;
  days_supply?: number;
  drug_cost_340b?: number;
  total_payment?: number;
  profit_or_loss?: number;
  claim_type?: string;
  reason?: string;
}>[] = [
  { header: "Prescription #", accessor: "prescription_number", format: "number" },
  { header: "Fill Date", accessor: "fill_date", format: "date" },
  { header: "Refill #", accessor: "refill_number", format: "number" },
  { header: "Patient", accessor: (r) => r.patient_name || `${r.first_name || ""} ${r.last_name || ""}`.trim() },
  { header: "Drug Name", accessor: "drug_name", width: 30 },
  { header: "NDC", accessor: "ndc", format: "text" },
  { header: "Pharmacy", accessor: "pharmacy_name", width: 25 },
  { header: "Quantity", accessor: "qty_dispensed", format: "number" },
  { header: "Days Supply", accessor: "days_supply", format: "number" },
  { header: "340B Cost", accessor: "drug_cost_340b", format: "currency" },
  { header: "Total Payment", accessor: "total_payment", format: "currency" },
  { header: "Profit/Loss", accessor: "profit_or_loss", format: "currency" },
  { header: "Claim Type", accessor: "claim_type" },
  { header: "Reason", accessor: "reason" },
];

// Scripts export columns
export const scriptsExportColumns: ExportColumn<{
  prescription_identifier?: number;
  prescribed_date?: string;
  patient_name?: string;
  medication_name?: string;
  ndc_code?: string;
  dispense_quantity?: number;
  refills_authorized?: number;
  days_supply?: number;
  adjudication_status?: string;
  fills_adjudicated?: number;
  total_payments?: number;
  total_340b_cost?: number;
}>[] = [
  { header: "Prescription ID", accessor: "prescription_identifier", format: "number" },
  { header: "Prescribed Date", accessor: "prescribed_date", format: "date" },
  { header: "Patient", accessor: "patient_name", width: 20 },
  { header: "Medication", accessor: "medication_name", width: 30 },
  { header: "NDC", accessor: "ndc_code", format: "text" },
  { header: "Quantity", accessor: "dispense_quantity", format: "number" },
  { header: "Refills", accessor: "refills_authorized", format: "number" },
  { header: "Days Supply", accessor: "days_supply", format: "number" },
  { header: "Status", accessor: "adjudication_status" },
  { header: "Fills", accessor: "fills_adjudicated", format: "number" },
  { header: "Total Payments", accessor: "total_payments", format: "currency" },
  { header: "340B Cost", accessor: "total_340b_cost", format: "currency" },
];

// Financial summary export columns
export const financialSummaryColumns: ExportColumn<{
  month: string;
  total_claims: number;
  total_340b_cost: number;
  total_retail_cost: number;
  gross_savings: number;
  total_payments: number;
  benefit_340b: number;
}>[] = [
  { header: "Month", accessor: "month", format: "date" },
  { header: "Total Claims", accessor: "total_claims", format: "number" },
  { header: "340B Cost", accessor: "total_340b_cost", format: "currency" },
  { header: "Retail Cost", accessor: "total_retail_cost", format: "currency" },
  { header: "Gross Savings", accessor: "gross_savings", format: "currency" },
  { header: "Total Payments", accessor: "total_payments", format: "currency" },
  { header: "340B Benefit", accessor: "benefit_340b", format: "currency" },
];
