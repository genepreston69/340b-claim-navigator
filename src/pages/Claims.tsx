import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Filter, Download, X, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Claim = Tables<"claims">;
type SortField = "fill_date" | "claim_date" | "drug_name" | "total_payment" | "prescription_number";
type SortDirection = "asc" | "desc";

const Claims = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("fill_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Get prescription filter from URL
  const rxFilter = searchParams.get("rx");

  // Fetch claims data
  const { data: claims, isLoading, error } = useQuery({
    queryKey: ["claims", rxFilter],
    queryFn: async () => {
      let query = supabase
        .from("claims")
        .select("*")
        .order("fill_date", { ascending: false });
      
      if (rxFilter) {
        query = query.eq("prescription_number", parseInt(rxFilter));
      }
      
      const { data, error } = await query.limit(500);
      
      if (error) throw error;
      return data as Claim[];
    },
  });

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!claims) return [];

    let filtered = claims;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.drug_name?.toLowerCase().includes(query) ||
        c.patient_id_external?.toLowerCase().includes(query) ||
        c.first_name?.toLowerCase().includes(query) ||
        c.last_name?.toLowerCase().includes(query) ||
        c.pharmacy_name?.toLowerCase().includes(query) ||
        c.prescription_number?.toString().includes(query) ||
        c.claim_id?.toString().includes(query)
      );
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
  }, [claims, searchQuery, sortField, sortDirection]);

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

  const clearRxFilter = () => {
    searchParams.delete("rx");
    setSearchParams(searchParams);
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
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Submit Claim
          </Button>
        </div>

        {/* Active Filter Badge */}
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

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by claim ID, Rx #, drug, patient, or pharmacy..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              {rxFilter ? `Claims for Rx #${rxFilter}` : "Recent Claims"} ({filteredData.length})
            </CardTitle>
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
            ) : filteredData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No claims found.
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Claim ID</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("prescription_number")}
                      >
                        <div className="flex items-center">
                          Rx #
                          <SortIcon field="prescription_number" />
                        </div>
                      </TableHead>
                      <TableHead>Refill</TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("fill_date")}
                      >
                        <div className="flex items-center">
                          Fill Date
                          <SortIcon field="fill_date" />
                        </div>
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort("drug_name")}
                      >
                        <div className="flex items-center">
                          Drug
                          <SortIcon field="drug_name" />
                        </div>
                      </TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
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
                      <TableHead>Payer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((claim) => (
                      <TableRow key={claim.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono text-sm">
                          {claim.claim_id || "-"}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {claim.prescription_number || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-muted">
                            {claim.refill_number === 0 ? "Original" : `#${claim.refill_number}`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {claim.fill_date ? format(new Date(claim.fill_date), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{claim.drug_name || "-"}</div>
                            <div className="text-xs text-muted-foreground">
                              NDC: {claim.ndc || "-"}
                            </div>
                          </div>
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
                        <TableCell className="max-w-[120px] truncate">
                          {claim.reason || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Claims;
