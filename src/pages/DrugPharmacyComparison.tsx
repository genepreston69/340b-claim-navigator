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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Pill,
  Building2,
  AlertCircle,
  Search,
  TrendingUp,
  DollarSign,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Treemap,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type DrugPharmacyData = Tables<"drug_pharmacy_comparison">;

const COLORS = [
  "hsl(var(--primary))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(262 83% 58%)",
  "hsl(200 98% 39%)",
  "hsl(0 84% 60%)",
  "hsl(45 93% 47%)",
  "hsl(173 80% 40%)",
];

const formatCurrency = (value: number | null) => {
  if (value === null) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null) return "0%";
  return `${value.toFixed(1)}%`;
};

export default function DrugPharmacyComparison() {
  const [searchQuery, setSearchQuery] = useState("");
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const [singlePharmacyFilter, setSinglePharmacyFilter] = useState<string>("all");

  // Fetch drug pharmacy comparison data
  const { data: comparisonData = [], isLoading } = useQuery({
    queryKey: ["drug-pharmacy-comparison"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_pharmacy_comparison")
        .select("*")
        .order("claim_count", { ascending: false });
      if (error) throw error;
      return (data || []) as DrugPharmacyData[];
    },
  });

  // Get unique pharmacies for filter
  const pharmacies = useMemo(() => {
    const uniquePharmacies = new Set<string>();
    comparisonData.forEach((item) => {
      if (item.pharmacy_name) {
        uniquePharmacies.add(item.pharmacy_name);
      }
    });
    return Array.from(uniquePharmacies).sort();
  }, [comparisonData]);

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const uniqueDrugs = new Set(comparisonData.map((d) => d.drug_id || d.ndc_code)).size;
    const uniquePharmacies = new Set(comparisonData.map((d) => d.pharmacy_id)).size;
    const singlePharmacyDrugs = comparisonData.filter((d) => d.single_pharmacy_drug).length;
    const totalClaims = comparisonData.reduce((sum, d) => sum + (d.claim_count || 0), 0);
    const totalSavings = comparisonData.reduce((sum, d) => sum + (d.gross_savings || 0), 0);

    // Find drugs only at one pharmacy (opportunity)
    const drugPharmacyCounts: Record<string, Set<string>> = {};
    comparisonData.forEach((d) => {
      const drugKey = d.drug_id || d.ndc_code || "";
      if (!drugPharmacyCounts[drugKey]) {
        drugPharmacyCounts[drugKey] = new Set();
      }
      if (d.pharmacy_id) {
        drugPharmacyCounts[drugKey].add(d.pharmacy_id);
      }
    });

    const singlePharmacyDrugCount = Object.values(drugPharmacyCounts).filter(
      (pharmacies) => pharmacies.size === 1
    ).length;

    return {
      uniqueDrugs,
      uniquePharmacies,
      singlePharmacyDrugs: singlePharmacyDrugCount,
      totalClaims,
      totalSavings,
    };
  }, [comparisonData]);

  // Filter data
  const filteredData = useMemo(() => {
    return comparisonData.filter((item) => {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.drug_name?.toLowerCase().includes(searchLower) ||
        item.ndc_code?.toLowerCase().includes(searchLower) ||
        item.pharmacy_name?.toLowerCase().includes(searchLower) ||
        item.manufacturer_name?.toLowerCase().includes(searchLower);

      const matchesPharmacy =
        pharmacyFilter === "all" || item.pharmacy_name === pharmacyFilter;

      const matchesSinglePharmacy =
        singlePharmacyFilter === "all" ||
        (singlePharmacyFilter === "single" && item.single_pharmacy_drug) ||
        (singlePharmacyFilter === "multiple" && !item.single_pharmacy_drug);

      return matchesSearch && matchesPharmacy && matchesSinglePharmacy;
    });
  }, [comparisonData, searchQuery, pharmacyFilter, singlePharmacyFilter]);

  // Top drugs by claims (aggregated)
  const topDrugsData = useMemo(() => {
    const drugTotals: Record<string, { name: string; claims: number; savings: number }> = {};

    comparisonData.forEach((item) => {
      const drugKey = item.drug_id || item.ndc_code || "Unknown";
      if (!drugTotals[drugKey]) {
        drugTotals[drugKey] = {
          name: item.drug_name || "Unknown",
          claims: 0,
          savings: 0,
        };
      }
      drugTotals[drugKey].claims += item.claim_count || 0;
      drugTotals[drugKey].savings += item.gross_savings || 0;
    });

    return Object.values(drugTotals)
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 10)
      .map((d) => ({
        name: d.name.length > 25 ? d.name.substring(0, 25) + "..." : d.name,
        claims: d.claims,
        savings: d.savings,
      }));
  }, [comparisonData]);

  // Pharmacy distribution for selected drug or all
  const pharmacyDistribution = useMemo(() => {
    const pharmacyTotals: Record<string, { name: string; claims: number; savings: number }> = {};

    filteredData.forEach((item) => {
      const pharmacyKey = item.pharmacy_id || "Unknown";
      const pharmacyName = item.pharmacy_name || "Unknown";
      if (!pharmacyTotals[pharmacyKey]) {
        pharmacyTotals[pharmacyKey] = {
          name: pharmacyName,
          claims: 0,
          savings: 0,
        };
      }
      pharmacyTotals[pharmacyKey].claims += item.claim_count || 0;
      pharmacyTotals[pharmacyKey].savings += item.gross_savings || 0;
    });

    return Object.values(pharmacyTotals)
      .sort((a, b) => b.claims - a.claims)
      .slice(0, 10);
  }, [filteredData]);

  // Single pharmacy drugs (opportunities)
  const singlePharmacyOpportunities = useMemo(() => {
    return comparisonData
      .filter((d) => d.single_pharmacy_drug)
      .sort((a, b) => (b.claim_count || 0) - (a.claim_count || 0))
      .slice(0, 20);
  }, [comparisonData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Drug Name",
      "NDC Code",
      "Manufacturer",
      "Pharmacy",
      "Chain",
      "Claims",
      "Qty Dispensed",
      "Total Payments",
      "340B Cost",
      "Market Share %",
      "Single Pharmacy Drug",
      "First Fill",
      "Last Fill",
    ];

    const rows = filteredData.map((item) => [
      item.drug_name || "",
      item.ndc_code || "",
      item.manufacturer_name || "",
      item.pharmacy_name || "",
      item.chain_pharmacy || "",
      item.claim_count || 0,
      item.total_qty_dispensed || 0,
      item.total_payments || 0,
      item.total_340b_cost || 0,
      item.pharmacy_market_share_pct || 0,
      item.single_pharmacy_drug ? "Yes" : "No",
      item.first_fill_date || "",
      item.last_fill_date || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "drug-pharmacy-comparison.csv";
    link.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Drug-Pharmacy Comparison
            </h1>
            <p className="text-muted-foreground">
              Compare 340B eligible drugs dispensed across pharmacies and identify opportunities
            </p>
          </div>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Unique Drugs</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.uniqueDrugs.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">340B eligible medications</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pharmacies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.uniquePharmacies.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Dispensing locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Single Pharmacy Drugs</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {metrics.singlePharmacyDrugs.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Expansion opportunity</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Claims</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.totalClaims.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Across all pharmacies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.totalSavings)}
              </div>
              <p className="text-xs text-muted-foreground">340B gross savings</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Drugs by Claims */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Top Drugs by Claim Volume
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : topDrugsData.length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  No drug data available
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topDrugsData}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={150}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [
                          name === "claims"
                            ? value.toLocaleString()
                            : formatCurrency(value),
                          name === "claims" ? "Claims" : "Savings",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="claims"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                        name="Claims"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pharmacy Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Claims by Pharmacy
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : pharmacyDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  No pharmacy data available
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pharmacyDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        tickFormatter={(v) => (v.length > 15 ? v.substring(0, 15) + "..." : v)}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [
                          name === "claims"
                            ? value.toLocaleString()
                            : formatCurrency(value),
                          name === "claims" ? "Claims" : "Savings",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="claims"
                        fill="hsl(142 76% 36%)"
                        radius={[4, 4, 0, 0]}
                        name="Claims"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Single Pharmacy Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Single Pharmacy Drugs - Expansion Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These drugs are only being filled at one pharmacy. Consider expanding to additional
              contracted pharmacies to improve patient access and capture rates.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : singlePharmacyOpportunities.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No single-pharmacy drugs found
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Drug Name</TableHead>
                      <TableHead>NDC</TableHead>
                      <TableHead>Only Pharmacy</TableHead>
                      <TableHead className="text-center">Claims</TableHead>
                      <TableHead className="text-right">Total Payments</TableHead>
                      <TableHead>Last Fill</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {singlePharmacyOpportunities.map((item, index) => (
                      <TableRow key={`${item.drug_id}-${item.pharmacy_id}-${index}`}>
                        <TableCell className="font-medium">
                          {item.drug_name?.length > 35
                            ? item.drug_name.substring(0, 35) + "..."
                            : item.drug_name}
                        </TableCell>
                        <TableCell className="text-xs">{item.ndc_code}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.pharmacy_name}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.claim_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_payments)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.last_fill_date
                            ? format(parseISO(item.last_fill_date), "MMM d, yyyy")
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Drug-Pharmacy Detail</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search drug, NDC, pharmacy..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={pharmacyFilter} onValueChange={setPharmacyFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter Pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pharmacies</SelectItem>
                    {pharmacies.map((pharmacy) => (
                      <SelectItem key={pharmacy} value={pharmacy}>
                        {pharmacy.length > 25 ? pharmacy.substring(0, 25) + "..." : pharmacy}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={singlePharmacyFilter} onValueChange={setSinglePharmacyFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Pharmacy Count" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Drugs</SelectItem>
                    <SelectItem value="single">Single Pharmacy Only</SelectItem>
                    <SelectItem value="multiple">Multiple Pharmacies</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No data found
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Drug</TableHead>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead className="text-center">Claims</TableHead>
                      <TableHead className="text-center">Market Share</TableHead>
                      <TableHead className="text-right">Total Payments</TableHead>
                      <TableHead className="text-right">340B Cost</TableHead>
                      <TableHead className="text-center">Pharmacies</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, 100).map((item, index) => (
                      <TableRow key={`${item.drug_id}-${item.pharmacy_id}-${index}`}>
                        <TableCell>
                          <div className="font-medium">
                            {item.drug_name?.length > 30
                              ? item.drug_name.substring(0, 30) + "..."
                              : item.drug_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.ndc_code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {item.pharmacy_name?.length > 25
                              ? item.pharmacy_name.substring(0, 25) + "..."
                              : item.pharmacy_name}
                          </div>
                          {item.chain_pharmacy && (
                            <div className="text-xs text-muted-foreground">
                              {item.chain_pharmacy}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.claim_count || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {formatPercent(item.pharmacy_market_share_pct)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_payments)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.total_340b_cost)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.single_pharmacy_drug ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                              1
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              {item.total_pharmacies_dispensing}
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing first 100 of {filteredData.length.toLocaleString()} records
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
