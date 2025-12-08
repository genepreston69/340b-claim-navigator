import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
import { 
  Filter, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  Search, 
  AlertCircle, 
  Clock, 
  CheckCircle2, 
  FileText,
  DollarSign 
} from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { CalendarIcon } from "lucide-react";
import { AdjudicationDetailDrawer } from "@/components/adjudication/AdjudicationDetailDrawer";

type AdjudicationStatus = Tables<"adjudication_status">;
type SortField = "prescribed_date" | "patient_name" | "medication_name" | "fills_adjudicated" | "fills_remaining" | "adjudication_status";
type SortDirection = "asc" | "desc";

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  "Never Filled": { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  "Partial": { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
  "Complete": { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
};

const Adjudication = () => {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortField, setSortField] = useState<SortField>("prescribed_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRow, setSelectedRow] = useState<AdjudicationStatus | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, pharmacyFilter, debouncedSearchQuery, dateFrom, dateTo, sortField, sortDirection]);

  // Fetch filter options from full dataset
  const { data: filterOptions } = useQuery({
    queryKey: ["adjudication-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adjudication_filter_options")
        .select("*");
      
      if (error) throw error;
      
      const pharmacies: string[] = [];
      const statuses: string[] = [];
      
      (data || []).forEach((row: { filter_type: string; filter_value: string | null }) => {
        if (row.filter_value) {
          if (row.filter_type === "pharmacy") {
            pharmacies.push(row.filter_value);
          } else if (row.filter_type === "status") {
            statuses.push(row.filter_value);
          }
        }
      });
      
      return { pharmacies: pharmacies.sort(), statuses };
    },
  });

  // Fetch summary stats (without pagination for aggregate calculations)
  const { data: statsData } = useQuery({
    queryKey: ["adjudication-stats", statusFilter === "all" ? null : statusFilter, pharmacyFilter, debouncedSearchQuery, dateFrom?.toISOString(), dateTo?.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from("adjudication_status")
        .select("adjudication_status, fills_adjudicated, fills_remaining, refills_authorized, total_payments");

      // Apply same filters for consistent stats
      if (pharmacyFilter !== "all") {
        query = query.eq("pharmacy_name", pharmacyFilter);
      }
      if (dateFrom) {
        query = query.gte("prescribed_date", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        query = query.lte("prescribed_date", format(dateTo, "yyyy-MM-dd"));
      }
      if (debouncedSearchQuery) {
        query = query.or(`patient_name.ilike.%${debouncedSearchQuery}%,medication_name.ilike.%${debouncedSearchQuery}%,patient_mrn.ilike.%${debouncedSearchQuery}%,ndc_code.ilike.%${debouncedSearchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Calculate stats from fetched data
  const stats = useMemo(() => {
    if (!statsData || statsData.length === 0) {
      return { 
        total: 0, neverFilled: 0, partial: 0, complete: 0,
        neverFilledPct: 0, partialPct: 0, completePct: 0, pendingRevenue: 0
      };
    }

    const total = statsData.length;
    const neverFilled = statsData.filter(d => d.adjudication_status === "Never Filled").length;
    const partial = statsData.filter(d => d.adjudication_status === "Partial").length;
    const complete = statsData.filter(d => d.adjudication_status === "Complete").length;

    const completeScripts = statsData.filter(d => d.adjudication_status === "Complete");
    const avgPaymentPerFill = completeScripts.length > 0 
      ? completeScripts.reduce((sum, d) => sum + (d.total_payments || 0), 0) / 
        completeScripts.reduce((sum, d) => sum + (d.fills_adjudicated || 1), 0)
      : 50;

    const neverFilledRevenue = statsData
      .filter(d => d.adjudication_status === "Never Filled")
      .reduce((sum, d) => sum + ((d.refills_authorized ?? 0) + 1) * avgPaymentPerFill, 0);

    const partialRevenue = statsData
      .filter(d => d.adjudication_status === "Partial")
      .reduce((sum, d) => sum + (d.fills_remaining ?? 0) * avgPaymentPerFill, 0);

    return {
      total, neverFilled, partial, complete,
      neverFilledPct: total > 0 ? Math.round((neverFilled / total) * 100) : 0,
      partialPct: total > 0 ? Math.round((partial / total) * 100) : 0,
      completePct: total > 0 ? Math.round((complete / total) * 100) : 0,
      pendingRevenue: neverFilledRevenue + partialRevenue
    };
  }, [statsData]);

  // Fetch paginated adjudication data
  const { data: paginatedResult, isLoading, error } = useQuery({
    queryKey: [
      "adjudication-paginated",
      currentPage, pageSize, sortField, sortDirection,
      statusFilter, pharmacyFilter, debouncedSearchQuery,
      dateFrom?.toISOString(), dateTo?.toISOString()
    ],
    queryFn: async () => {
      let query = supabase
        .from("adjudication_status")
        .select("*", { count: "exact" });

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("adjudication_status", statusFilter);
      }
      if (pharmacyFilter !== "all") {
        query = query.eq("pharmacy_name", pharmacyFilter);
      }
      if (dateFrom) {
        query = query.gte("prescribed_date", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        query = query.lte("prescribed_date", format(dateTo, "yyyy-MM-dd"));
      }
      if (debouncedSearchQuery) {
        query = query.or(`patient_name.ilike.%${debouncedSearchQuery}%,medication_name.ilike.%${debouncedSearchQuery}%,patient_mrn.ilike.%${debouncedSearchQuery}%,ndc_code.ilike.%${debouncedSearchQuery}%`);
      }

      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === "asc", nullsFirst: false });

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      return { data: data as AdjudicationStatus[], totalCount: count || 0 };
    },
  });

  const adjudicationData = paginatedResult?.data || [];
  const totalCount = paginatedResult?.totalCount || 0;
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
    setStatusFilter("all");
    setPharmacyFilter("all");
    setSearchQuery("");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const hasActiveFilters = statusFilter !== "all" || pharmacyFilter !== "all" || searchQuery || dateFrom || dateTo;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Adjudication Status</h2>
            <p className="text-muted-foreground">
              Prescription-to-claim matching overview
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card 
            className={cn(
              "cursor-pointer hover:shadow-md transition-all",
              statusFilter === "all" && "ring-2 ring-primary"
            )} 
            onClick={() => setStatusFilter("all")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Scripts</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">In selected filters</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer hover:shadow-md transition-all border-l-4 border-l-destructive",
              statusFilter === "Never Filled" && "ring-2 ring-destructive"
            )} 
            onClick={() => setStatusFilter("Never Filled")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Never Filled</p>
                  <p className="text-2xl font-bold text-destructive">{stats.neverFilled.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.neverFilledPct}% of total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer hover:shadow-md transition-all border-l-4 border-l-warning",
              statusFilter === "Partial" && "ring-2 ring-warning"
            )} 
            onClick={() => setStatusFilter("Partial")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Partial Fills</p>
                  <p className="text-2xl font-bold text-warning">{stats.partial.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.partialPct}% of total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={cn(
              "cursor-pointer hover:shadow-md transition-all border-l-4 border-l-success",
              statusFilter === "Complete" && "ring-2 ring-success"
            )} 
            onClick={() => setStatusFilter("Complete")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Complete</p>
                  <p className="text-2xl font-bold text-success">{stats.complete.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stats.completePct}% of total</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Revenue</p>
                  <p className="text-2xl font-bold text-primary">
                    ${stats.pendingRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Est. uncaptured savings</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                  Clear all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patient, drug, MRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Never Filled">Never Filled</SelectItem>
                  <SelectItem value="Partial">Partial</SelectItem>
                  <SelectItem value="Complete">Complete</SelectItem>
                </SelectContent>
              </Select>

              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Pharmacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {filterOptions?.pharmacies.map(pharmacy => (
                    <SelectItem key={pharmacy} value={pharmacy}>{pharmacy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Prescriptions ({totalCount.toLocaleString()})</CardTitle>
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
                Error loading data. Please try again.
              </div>
            ) : adjudicationData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No prescriptions found matching your filters.
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("prescribed_date")}
                        >
                          <div className="flex items-center">
                            Date
                            <SortIcon field="prescribed_date" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("patient_name")}
                        >
                          <div className="flex items-center">
                            Patient
                            <SortIcon field="patient_name" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("medication_name")}
                        >
                          <div className="flex items-center">
                            Medication
                            <SortIcon field="medication_name" />
                          </div>
                        </TableHead>
                        <TableHead>Pharmacy</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-center"
                          onClick={() => handleSort("fills_adjudicated")}
                        >
                          <div className="flex items-center justify-center">
                            Fills
                            <SortIcon field="fills_adjudicated" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50 text-center"
                          onClick={() => handleSort("fills_remaining")}
                        >
                          <div className="flex items-center justify-center">
                            Remaining
                            <SortIcon field="fills_remaining" />
                          </div>
                        </TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleSort("adjudication_status")}
                        >
                          <div className="flex items-center">
                            Status
                            <SortIcon field="adjudication_status" />
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adjudicationData.map((row) => {
                        const status = row.adjudication_status || "Never Filled";
                        const colors = statusColors[status] || statusColors["Never Filled"];
                        
                        return (
                          <TableRow 
                            key={row.prescription_id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedRow(row)}
                          >
                            <TableCell className="font-medium">
                              {row.prescribed_date ? format(new Date(row.prescribed_date), "MMM d, yyyy") : "-"}
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{row.patient_name || "Unknown"}</div>
                                <div className="text-sm text-muted-foreground">MRN: {row.patient_mrn || "-"}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{row.medication_name || "-"}</div>
                                <div className="text-sm text-muted-foreground">NDC: {row.ndc_code || "-"}</div>
                              </div>
                            </TableCell>
                            <TableCell>{row.pharmacy_name || "-"}</TableCell>
                            <TableCell className="text-center font-medium">{row.fills_adjudicated ?? 0}</TableCell>
                            <TableCell className="text-center font-medium">{row.fills_remaining ?? 0}</TableCell>
                            <TableCell>
                              <Badge 
                                variant="outline" 
                                className={cn(colors.bg, colors.text, colors.border)}
                              >
                                {status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} prescriptions
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

      {/* Detail Drawer */}
      <AdjudicationDetailDrawer 
        selectedRow={selectedRow} 
        onClose={() => setSelectedRow(null)} 
      />
    </DashboardLayout>
  );
};

export default Adjudication;
