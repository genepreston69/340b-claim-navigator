import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter, Download, ChevronUp, ChevronDown, Loader2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "use-debounce";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// Status mapping from database values to UI display
const statusMap = {
  "Never Filled": { label: "Unmatched", style: "bg-destructive/10 text-destructive border-destructive/20" },
  "Partial": { label: "Pending", style: "bg-warning/10 text-warning border-warning/20" },
  "Complete": { label: "Matched", style: "bg-success/10 text-success border-success/20" },
} as const;

type SortField = "prescription_identifier" | "patient_name" | "medication_name" | "prescribed_date" | "adjudication_status";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const Scripts = () => {
  const navigate = useNavigate();

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("prescribed_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ["scripts-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scripts_filter_options")
        .select("*");

      if (error) throw error;

      const options = {
        statuses: [] as string[],
        pharmacies: [] as string[],
      };

      data?.forEach((item) => {
        if (item.filter_type === "adjudication_status" && item.filter_value) {
          options.statuses.push(item.filter_value);
        } else if (item.filter_type === "pharmacy" && item.filter_value) {
          options.pharmacies.push(item.filter_value);
        }
      });

      return options;
    },
  });

  // Fetch scripts data
  const { data: scriptsResult, isLoading, error } = useQuery({
    queryKey: ["scripts", debouncedSearch, statusFilter, pharmacyFilter, sortField, sortDirection, currentPage, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("adjudication_status")
        .select("*", { count: "exact" });

      // Apply search filter
      if (debouncedSearch) {
        query = query.or(
          `patient_name.ilike.%${debouncedSearch}%,medication_name.ilike.%${debouncedSearch}%,ndc_code.ilike.%${debouncedSearch}%,prescription_identifier.eq.${parseInt(debouncedSearch) || 0}`
        );
      }

      // Apply status filter
      if (statusFilter && statusFilter !== "all") {
        query = query.eq("adjudication_status", statusFilter);
      }

      // Apply pharmacy filter
      if (pharmacyFilter && pharmacyFilter !== "all") {
        query = query.eq("pharmacy_name", pharmacyFilter);
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        scripts: data || [],
        totalCount: count || 0,
      };
    },
  });

  const scripts = scriptsResult?.scripts || [];
  const totalCount = scriptsResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Handle sort toggle
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
    setCurrentPage(1);
  };

  // Render sort indicator
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4" />
    ) : (
      <ChevronDown className="h-4 w-4" />
    );
  };

  // Get status badge
  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const mapped = statusMap[status as keyof typeof statusMap];
    if (!mapped) return <Badge variant="outline">{status}</Badge>;
    return (
      <Badge variant="outline" className={mapped.style}>
        {mapped.label}
      </Badge>
    );
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(parseISO(dateStr), "MMM dd, yyyy");
    } catch {
      return dateStr;
    }
  };

  // Export to CSV
  const handleExport = async () => {
    // Fetch all data (up to 10000 records) for export
    let query = supabase
      .from("adjudication_status")
      .select("*")
      .limit(10000);

    if (debouncedSearch) {
      query = query.or(
        `patient_name.ilike.%${debouncedSearch}%,medication_name.ilike.%${debouncedSearch}%,ndc_code.ilike.%${debouncedSearch}%`
      );
    }
    if (statusFilter && statusFilter !== "all") {
      query = query.eq("adjudication_status", statusFilter);
    }
    if (pharmacyFilter && pharmacyFilter !== "all") {
      query = query.eq("pharmacy_name", pharmacyFilter);
    }

    const { data } = await query;
    if (!data || data.length === 0) return;

    const headers = [
      "Prescription ID",
      "Patient",
      "Drug",
      "NDC",
      "Quantity",
      "Days Supply",
      "Refills",
      "Prescribed Date",
      "Status",
      "Fills Adjudicated",
      "Fills Remaining",
      "Last Fill Date",
      "Total Payments",
      "340B Cost",
    ];

    const rows = data.map((s) => [
      s.prescription_identifier,
      s.patient_name,
      s.medication_name,
      s.ndc_code,
      s.dispense_quantity,
      s.days_supply,
      s.refills_authorized,
      s.prescribed_date,
      s.adjudication_status,
      s.fills_adjudicated,
      s.fills_remaining,
      s.last_fill_date,
      s.total_payments,
      s.total_340b_cost,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => (cell === null || cell === undefined ? "" : `"${cell}"`)).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scripts_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPharmacyFilter("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || statusFilter !== "all" || pharmacyFilter !== "all";

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Scripts</h2>
            <p className="text-muted-foreground">
              Manage and track prescription scripts
            </p>
          </div>
          <Button className="gap-2" onClick={() => navigate("/data-import")}>
            <Plus className="h-4 w-4" />
            Import Scripts
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by script ID, patient, drug, or NDC..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {/* Status Filter */}
                <Select
                  value={statusFilter}
                  onValueChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {filterOptions?.statuses.map((status) => (
                      <SelectItem key={status} value={status}>
                        {statusMap[status as keyof typeof statusMap]?.label || status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Pharmacy Filter */}
                <Select
                  value={pharmacyFilter}
                  onValueChange={(value) => {
                    setPharmacyFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pharmacies</SelectItem>
                    {filterOptions?.pharmacies.map((pharmacy) => (
                      <SelectItem key={pharmacy} value={pharmacy}>
                        {pharmacy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Clear Filters */}
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                    <X className="h-4 w-4" />
                    Clear
                  </Button>
                )}

                {/* Export */}
                <Button variant="outline" className="gap-2" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scripts Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Prescriptions
              {totalCount > 0 && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({totalCount.toLocaleString()} total)
                </span>
              )}
            </CardTitle>
            <Select
              value={pageSize.toString()}
              onValueChange={(value) => {
                setPageSize(parseInt(value));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={size.toString()}>
                    {size} rows
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Error loading scripts. Please try again.
              </div>
            ) : scripts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                {hasActiveFilters
                  ? "No scripts match your filters. Try adjusting your search criteria."
                  : "No scripts found. Import scripts to get started."}
              </div>
            ) : (
              <>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("prescription_identifier")}
                        >
                          <div className="flex items-center gap-1">
                            Script ID
                            <SortIndicator field="prescription_identifier" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("patient_name")}
                        >
                          <div className="flex items-center gap-1">
                            Patient
                            <SortIndicator field="patient_name" />
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("medication_name")}
                        >
                          <div className="flex items-center gap-1">
                            Drug
                            <SortIndicator field="medication_name" />
                          </div>
                        </TableHead>
                        <TableHead>NDC</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("prescribed_date")}
                        >
                          <div className="flex items-center gap-1">
                            Prescribed
                            <SortIndicator field="prescribed_date" />
                          </div>
                        </TableHead>
                        <TableHead className="text-center">Fills</TableHead>
                        <TableHead
                          className="cursor-pointer hover:bg-muted"
                          onClick={() => handleSort("adjudication_status")}
                        >
                          <div className="flex items-center gap-1">
                            Status
                            <SortIndicator field="adjudication_status" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scripts.map((script) => (
                        <TableRow
                          key={script.prescription_id}
                          className="cursor-pointer hover:bg-muted/50"
                        >
                          <TableCell className="font-medium font-mono">
                            {script.prescription_identifier}
                          </TableCell>
                          <TableCell>{script.patient_name || "-"}</TableCell>
                          <TableCell className="max-w-[200px] truncate" title={script.medication_name || ""}>
                            {script.medication_name || "-"}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {script.ndc_code || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {script.dispense_quantity || "-"}
                          </TableCell>
                          <TableCell>{formatDate(script.prescribed_date)}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-sm">
                              {script.fills_adjudicated || 0} / {(script.refills_authorized || 0) + 1}
                            </span>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(script.adjudication_status)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} scripts
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm px-2">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Scripts;
