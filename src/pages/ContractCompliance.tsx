import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Download,
  Building2,
  AlertTriangle,
  XCircle,
  Search,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type ContractComplianceData = Tables<"pharmacy_contract_compliance">;

export default function ContractCompliance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("scripts");

  // Fetch contract compliance data
  const { data: complianceData = [], isLoading } = useQuery({
    queryKey: ["pharmacy-contract-compliance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacy_contract_compliance")
        .select("*")
        .order("prescriptions_written", { ascending: false });
      if (error) throw error;
      return (data || []) as ContractComplianceData[];
    },
  });

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const total = complianceData.length;
    const totalScripts = complianceData.reduce(
      (sum, d) => sum + (d.prescriptions_written || 0),
      0
    );
    const totalPatients = complianceData.reduce(
      (sum, d) => sum + (d.patients_with_scripts || 0),
      0
    );
    const totalPrescribers = complianceData.reduce(
      (sum, d) => sum + (d.prescribers_writing || 0),
      0
    );

    return {
      total,
      totalScripts,
      totalPatients,
      totalPrescribers,
    };
  }, [complianceData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data = complianceData.filter((item) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.pharmacy_name?.toLowerCase().includes(searchLower) ||
        item.chain_pharmacy?.toLowerCase().includes(searchLower) ||
        item.npi_number?.toString().includes(searchLower);

      return matchesSearch;
    });

    // Sort
    switch (sortBy) {
      case "scripts":
        data = [...data].sort(
          (a, b) => (b.prescriptions_written || 0) - (a.prescriptions_written || 0)
        );
        break;
      case "patients":
        data = [...data].sort(
          (a, b) => (b.patients_with_scripts || 0) - (a.patients_with_scripts || 0)
        );
        break;
      case "name":
        data = [...data].sort((a, b) =>
          (a.pharmacy_name || "").localeCompare(b.pharmacy_name || "")
        );
        break;
    }

    return data;
  }, [complianceData, searchQuery, sortBy]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Pharmacy Name",
      "Chain",
      "NPI",
      "NABP",
      "Contract Status",
      "Prescriptions Written",
      "Patients",
      "Prescribers",
      "First Prescription Date",
      "Last Prescription Date",
    ];

    const rows = filteredData.map((item) => [
      item.pharmacy_name || "",
      item.chain_pharmacy || "",
      item.npi_number || "",
      item.nabp_number || "",
      item.contract_status || "",
      item.prescriptions_written || 0,
      item.patients_with_scripts || 0,
      item.prescribers_writing || 0,
      item.first_prescription_date || "",
      item.last_prescription_date || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pharmacy-contract-compliance.csv";
    link.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contract Compliance
            </h1>
            <p className="text-muted-foreground">
              Pharmacies with prescriptions (60+ days old) that are NOT in the contracted pharmacies list
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Uncontracted Pharmacies</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{metrics.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Pharmacies needing contracts
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Scripts at Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {metrics.totalScripts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Prescriptions without 340B
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Affected Patients</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalPatients.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Unique patients
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Prescribers Involved</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalPrescribers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Unique prescribers
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Pharmacies Not in Contract List
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search pharmacy, NPI..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p>No uncontracted pharmacies found</p>
                <p className="text-sm">All pharmacies with prescriptions are in the contract list</p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Scripts Written</TableHead>
                      <TableHead className="text-center">Patients</TableHead>
                      <TableHead className="text-center">Prescribers</TableHead>
                      <TableHead>First Script</TableHead>
                      <TableHead>Last Script</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, 100).map((item, index) => (
                      <TableRow key={item.pharmacy_id || index}>
                        <TableCell>
                          <div className="font-medium">
                            {item.pharmacy_name?.length > 30
                              ? item.pharmacy_name.substring(0, 30) + "..."
                              : item.pharmacy_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.chain_pharmacy || "Independent"} | NPI: {item.npi_number || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                            <XCircle className="w-3 h-3 mr-1" />
                            Not Contracted
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {(item.prescriptions_written || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.patients_with_scripts || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.prescribers_writing || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {item.first_prescription_date
                            ? format(parseISO(item.first_prescription_date), "MMM d, yyyy")
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {item.last_prescription_date
                            ? format(parseISO(item.last_prescription_date), "MMM d, yyyy")
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing first 100 of {filteredData.length.toLocaleString()} pharmacies
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
