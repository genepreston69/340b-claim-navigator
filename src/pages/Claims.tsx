import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { 
  Search, 
  Filter, 
  Download, 
  ChevronDown, 
  ChevronUp,
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown,
  X,
  CalendarIcon
} from "lucide-react";
import { format } from "date-fns";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { ClaimDetailDrawer } from "@/components/claims/ClaimDetailDrawer";
import { toast } from "@/hooks/use-toast";

type Claim = Tables<"claims">;
type SortField = "fill_date" | "claim_id" | "drug_name" | "total_payment" | "prescription_number" | "pharmacy_name" | "qty_dispensed";
type SortDirection = "asc" | "desc";

const Claims = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isFiltersOpen, setIsFiltersOpen] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  
  // Filter states
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [claimTypeFilter, setClaimTypeFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [drugSearch, setDrugSearch] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [rxNumberSearch, setRxNumberSearch] = useState("");
  
  // Debounced search values
  const [debouncedDrugSearch] = useDebounce(drugSearch, 300);
  const [debouncedPatientSearch] = useDebounce(patientSearch, 300);
  
  // Table states
  const [sortField, setSortField] = useState<SortField>("fill_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Get prescription filter from URL
  const rxFilter = searchParams.get("rx");

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateFrom, dateTo, pharmacyFilter, claimTypeFilter, reasonFilter, debouncedDrugSearch, debouncedPatientSearch, rxNumberSearch, rxFilter, sortField, sortDirection]);

  // Fetch filter options from the full dataset
  const { data: filterOptions } = useQuery({
    queryKey: ["claims-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims_filter_options")
        .select("*");
      
      if (error) throw error;
      
      const pharmacies: string[] = [];
      const claimTypes: string[] = [];
      const reasons: string[] = [];
      
      (data || []).forEach((row: { filter_type: string; filter_value: string | null }) => {
        if (row.filter_value) {
          switch (row.filter_type) {
            case "pharmacy":
              pharmacies.push(row.filter_value);
              break;
            case "claim_type":
              claimTypes.push(row.filter_value);
              break;
            case "reason":
              reasons.push(row.filter_value);
              break;
          }
        }
      });
      
      return { pharmacies, claimTypes, reasons };
    },
  });

  // Fetch claims with server-side pagination and filtering
  const { data: claimsResult, isLoading, error } = useQuery({
    queryKey: [
      "claims-paginated",
      currentPage,
      pageSize,
      sortField,
      sortDirection,
      dateFrom?.toISOString(),
      dateTo?.toISOString(),
      pharmacyFilter,
      claimTypeFilter,
      reasonFilter,
      debouncedDrugSearch,
      debouncedPatientSearch,
      rxNumberSearch,
      rxFilter
    ],
    queryFn: async () => {
      let query = supabase
        .from("claims")
        .select("*", { count: "exact" });

      // Apply filters
      if (rxFilter) {
        query = query.eq("prescription_number", parseInt(rxFilter));
      }
      
      if (rxNumberSearch) {
        query = query.eq("prescription_number", parseInt(rxNumberSearch));
      }

      if (dateFrom) {
        query = query.gte("fill_date", format(dateFrom, "yyyy-MM-dd"));
      }
      
      if (dateTo) {
        query = query.lte("fill_date", format(dateTo, "yyyy-MM-dd"));
      }

      if (pharmacyFilter !== "all") {
        query = query.eq("pharmacy_name", pharmacyFilter);
      }

      if (claimTypeFilter !== "all") {
        query = query.eq("claim_type", claimTypeFilter);
      }

      if (reasonFilter !== "all") {
        query = query.eq("reason", reasonFilter);
      }

      if (debouncedDrugSearch) {
        query = query.ilike("drug_name", `%${debouncedDrugSearch}%`);
      }

      if (debouncedPatientSearch) {
        // Search in both first_name and last_name using OR
        query = query.or(`first_name.ilike.%${debouncedPatientSearch}%,last_name.ilike.%${debouncedPatientSearch}%`);
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
        claims: data as Claim[],
        totalCount: count || 0
      };
    },
  });

  const claims = claimsResult?.claims || [];
  const totalCount = claimsResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setPharmacyFilter("all");
    setClaimTypeFilter("all");
    setReasonFilter("all");
    setDrugSearch("");
    setPatientSearch("");
    setRxNumberSearch("");
    searchParams.delete("rx");
    setSearchParams(searchParams);
  };

  const clearRxFilter = () => {
    searchParams.delete("rx");
    setSearchParams(searchParams);
  };

  const hasActiveFilters = dateFrom || dateTo || pharmacyFilter !== "all" || claimTypeFilter !== "all" || reasonFilter !== "all" || drugSearch || patientSearch || rxNumberSearch || rxFilter;

  // Export to CSV - fetches all filtered data
  const handleExportCSV = async () => {
    const exportLimit = 10000;
    
    toast({ title: "Preparing export...", description: "Fetching data..." });

    try {
      let query = supabase
        .from("claims")
        .select("*");

      // Apply same filters as the main query
      if (rxFilter) {
        query = query.eq("prescription_number", parseInt(rxFilter));
      }
      if (rxNumberSearch) {
        query = query.eq("prescription_number", parseInt(rxNumberSearch));
      }
      if (dateFrom) {
        query = query.gte("fill_date", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        query = query.lte("fill_date", format(dateTo, "yyyy-MM-dd"));
      }
      if (pharmacyFilter !== "all") {
        query = query.eq("pharmacy_name", pharmacyFilter);
      }
      if (claimTypeFilter !== "all") {
        query = query.eq("claim_type", claimTypeFilter);
      }
      if (reasonFilter !== "all") {
        query = query.eq("reason", reasonFilter);
      }
      if (debouncedDrugSearch) {
        query = query.ilike("drug_name", `%${debouncedDrugSearch}%`);
      }
      if (debouncedPatientSearch) {
        query = query.or(`first_name.ilike.%${debouncedPatientSearch}%,last_name.ilike.%${debouncedPatientSearch}%`);
      }

      query = query.order(sortField, { ascending: sortDirection === "asc" }).limit(exportLimit);

      const { data: exportData, error: exportError } = await query;

      if (exportError) throw exportError;

      if (!exportData || exportData.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
      }

      const headers = [
        "Claim ID", "Rx #", "Refill #", "Fill Date", "Claim Date",
        "Patient Name", "Drug Name", "NDC", "Pharmacy", "Qty",
        "340B Cost", "Total Payment", "Reason", "Claim Type"
      ];

      const rows = exportData.map(c => [
        c.claim_id || "",
        c.prescription_number || "",
        c.refill_number || "",
        c.fill_date || "",
        c.claim_date || "",
        `${c.first_name || ""} ${c.last_name || ""}`.trim(),
        c.drug_name || "",
        c.ndc || "",
        c.pharmacy_name || "",
        c.qty_dispensed || "",
        c.drug_cost_340b || "",
        c.total_payment || "",
        c.reason || "",
        c.claim_type || ""
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `claims_export_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();

      const exportMsg = exportData.length >= exportLimit 
        ? `Exported ${exportData.length.toLocaleString()} claims (limit reached)`
        : `Exported ${exportData.length.toLocaleString()} claims`;
      toast({ title: exportMsg });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Claims</h2>
            <p className="text-muted-foreground">
              Track and manage submitted claims
            </p>
          </div>
          <Button className="gap-2" onClick={handleExportCSV}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Active URL Filter Badge */}
        {rxFilter && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Filtered by:</span>
            <Badge variant="secondary" className="gap-1 pr-1">
              Rx #{rxFilter}
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={clearRxFilter}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          </div>
        )}

        {/* Collapsible Filters */}
        <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Filter className="h-5 w-5" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={(e) => { e.stopPropagation(); clearFilters(); }} 
                        className="text-muted-foreground"
                      >
                        Clear all
                      </Button>
                    )}
                    {isFiltersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                  </div>
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                  {/* Date From */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? format(dateFrom, "PP") : "From date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Date To */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? format(dateTo, "PP") : "To date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  {/* Pharmacy */}
                  <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pharmacy" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Pharmacies</SelectItem>
                      {filterOptions?.pharmacies.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Claim Type */}
                  <Select value={claimTypeFilter} onValueChange={setClaimTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Claim Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {filterOptions?.claimTypes.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Reason */}
                  <Select value={reasonFilter} onValueChange={setReasonFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reasons</SelectItem>
                      {filterOptions?.reasons.map(r => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Drug Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Drug name..."
                      value={drugSearch}
                      onChange={(e) => setDrugSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {/* Patient Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Patient name..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Second row for Rx # */}
                <div className="mt-4 grid gap-4 md:grid-cols-4 lg:grid-cols-7">
                  <div className="relative">
                    <Input
                      placeholder="Rx # (exact)"
                      value={rxNumberSearch}
                      onChange={(e) => setRxNumberSearch(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                Claims ({totalCount.toLocaleString()})
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(parseInt(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error loading claims. Please try again.
              </div>
            ) : claims.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No claims found matching your filters.
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("claim_id")}
                        >
                          <div className="flex items-center">
                            Claim ID
                            <SortIcon field="claim_id" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("fill_date")}
                        >
                          <div className="flex items-center">
                            Fill Date
                            <SortIcon field="fill_date" />
                          </div>
                        </TableHead>
                        <TableHead>Patient</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("drug_name")}
                        >
                          <div className="flex items-center">
                            Drug
                            <SortIcon field="drug_name" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("pharmacy_name")}
                        >
                          <div className="flex items-center">
                            Pharmacy
                            <SortIcon field="pharmacy_name" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-right"
                          onClick={() => handleSort("qty_dispensed")}
                        >
                          <div className="flex items-center justify-end">
                            Qty
                            <SortIcon field="qty_dispensed" />
                          </div>
                        </TableHead>
                        <TableHead className="text-right">340B Cost</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-right"
                          onClick={() => handleSort("total_payment")}
                        >
                          <div className="flex items-center justify-end">
                            Payment
                            <SortIcon field="total_payment" />
                          </div>
                        </TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-center">Refill</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {claims.map((claim) => (
                        <TableRow 
                          key={claim.id} 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => setSelectedClaim(claim)}
                        >
                          <TableCell className="font-mono text-sm">
                            {claim.claim_id || "-"}
                          </TableCell>
                          <TableCell>
                            {claim.fill_date ? format(new Date(claim.fill_date), "MMM d, yyyy") : "-"}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {claim.first_name && claim.last_name 
                                  ? `${claim.first_name} ${claim.last_name}` 
                                  : "-"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                MRN: {claim.medical_record_number || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <div>
                              <div className="font-medium truncate">{claim.drug_name || "-"}</div>
                              <div className="text-xs text-muted-foreground">
                                NDC: {claim.ndc || "-"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate">
                            {claim.pharmacy_name || "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {claim.qty_dispensed || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            ${(claim.drug_cost_340b || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-medium text-success">
                            ${(claim.total_payment || 0).toFixed(2)}
                          </TableCell>
                          <TableCell className="max-w-[100px] truncate">
                            {claim.reason || "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="bg-muted">
                              {claim.refill_number === 0 ? "Orig" : `#${claim.refill_number}`}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} claims
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages || totalPages === 0}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Claim Detail Drawer */}
      <ClaimDetailDrawer 
        claim={selectedClaim} 
        onClose={() => setSelectedClaim(null)} 
      />
    </DashboardLayout>
  );
};

export default Claims;
