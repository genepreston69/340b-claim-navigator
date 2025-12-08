import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Scale, Filter, ArrowUpDown, ArrowUp, ArrowDown, Search, X } from "lucide-react";
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

  // Fetch adjudication data
  const { data: adjudicationData, isLoading, error } = useQuery({
    queryKey: ["adjudication_status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adjudication_status")
        .select("*");
      
      if (error) throw error;
      return data as AdjudicationStatus[];
    },
  });

  // Get unique pharmacies for filter
  const pharmacies = useMemo(() => {
    if (!adjudicationData) return [];
    const uniquePharmacies = [...new Set(adjudicationData.map(d => d.pharmacy_name).filter(Boolean))];
    return uniquePharmacies.sort();
  }, [adjudicationData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!adjudicationData) return [];

    let filtered = adjudicationData;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(d => d.adjudication_status === statusFilter);
    }

    // Pharmacy filter
    if (pharmacyFilter !== "all") {
      filtered = filtered.filter(d => d.pharmacy_name === pharmacyFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.patient_name?.toLowerCase().includes(query) ||
        d.medication_name?.toLowerCase().includes(query) ||
        d.patient_mrn?.toLowerCase().includes(query) ||
        d.ndc_code?.toLowerCase().includes(query)
      );
    }

    // Date range filter
    if (dateFrom) {
      filtered = filtered.filter(d => {
        if (!d.prescribed_date) return false;
        return new Date(d.prescribed_date) >= dateFrom;
      });
    }
    if (dateTo) {
      filtered = filtered.filter(d => {
        if (!d.prescribed_date) return false;
        return new Date(d.prescribed_date) <= dateTo;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [adjudicationData, statusFilter, pharmacyFilter, searchQuery, dateFrom, dateTo, sortField, sortDirection]);

  // Summary stats
  const stats = useMemo(() => {
    if (!adjudicationData) return { total: 0, neverFilled: 0, partial: 0, complete: 0 };
    return {
      total: adjudicationData.length,
      neverFilled: adjudicationData.filter(d => d.adjudication_status === "Never Filled").length,
      partial: adjudicationData.filter(d => d.adjudication_status === "Partial").length,
      complete: adjudicationData.filter(d => d.adjudication_status === "Complete").length,
    };
  }, [adjudicationData]);

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
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("all")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Prescriptions</p>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                </div>
                <Scale className="h-8 w-8 text-primary opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("Never Filled")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Never Filled</p>
                  <p className="text-2xl font-bold text-destructive">{stats.neverFilled}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                  <X className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("Partial")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Partial</p>
                  <p className="text-2xl font-bold text-warning">{stats.partial}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-warning/10 flex items-center justify-center">
                  <Scale className="h-5 w-5 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("Complete")}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Complete</p>
                  <p className="text-2xl font-bold text-success">{stats.complete}</p>
                </div>
                <div className="h-8 w-8 rounded-full bg-success/10 flex items-center justify-center">
                  <Scale className="h-5 w-5 text-success" />
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
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search patient, drug, MRN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Status Filter */}
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

              {/* Pharmacy Filter */}
              <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Pharmacy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Pharmacies</SelectItem>
                  {pharmacies.map(pharmacy => (
                    <SelectItem key={pharmacy} value={pharmacy!}>{pharmacy}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
            </div>
          </CardContent>
        </Card>

        {/* Data Table */}
        <Card>
          <CardHeader>
            <CardTitle>Prescriptions ({filteredData.length})</CardTitle>
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
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No prescriptions found matching your filters.
              </div>
            ) : (
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
                    {filteredData.map((row) => {
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
