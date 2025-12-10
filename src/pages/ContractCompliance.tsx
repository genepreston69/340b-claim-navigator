import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ShieldAlert,
  FileSpreadsheet,
  CheckCircle2,
  Ban,
  TrendingUp,
  TrendingDown,
  PieChart,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Tables } from "@/integrations/supabase/types";
import { exportToExcel, type ExportColumn } from "@/utils/exportUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type ContractComplianceData = Tables<"pharmacy_contract_compliance">;

// Types for new views
interface DrugBenefitSummary {
  ndc: number | null;
  drug_name: string | null;
  total_pharmacies: number | null;
  pharmacies_with_benefit: number | null;
  pharmacies_without_benefit: number | null;
  total_claims: number | null;
  claims_with_benefit: number | null;
  claims_without_benefit: number | null;
  total_benefit: number | null;
  pharmacies_with_benefit_list: string | null;
  pharmacies_without_benefit_list: string | null;
}

interface MedicaidCarveSummary {
  month: string | null;
  carved_in_claims: number | null;
  carved_in_payments: number | null;
  carved_in_benefit: number | null;
  carved_out_claims: number | null;
  carved_out_payments: number | null;
  total_medicaid_claims: number | null;
  non_medicaid_claims: number | null;
  non_medicaid_benefit: number | null;
  carve_out_rate_pct: number | null;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatMonth = (dateStr: string | null) => {
  if (!dateStr) return "";
  try {
    return format(parseISO(dateStr), "MMM yyyy");
  } catch {
    return dateStr;
  }
};

export default function ContractCompliance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [benefitSearchQuery, setBenefitSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("benefit");

  // Fetch contract compliance data (uncontracted pharmacies)
  const { data: complianceData = [], isLoading: complianceLoading } = useQuery({
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

  // Fetch drug benefit summary (new view)
  const { data: drugBenefitData = [], isLoading: benefitLoading } = useQuery({
    queryKey: ["drug-benefit-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("drug_benefit_summary")
        .select("*");
      if (error) throw error;
      return (data || []) as DrugBenefitSummary[];
    },
  });

  // Fetch Medicaid carve summary (updated view)
  const { data: medicaidCarveSummary = [], isLoading: medicaidSummaryLoading } = useQuery({
    queryKey: ["medicaid-carve-summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("medicaid_carve_summary")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as MedicaidCarveSummary[];
    },
  });

  // Calculate compliance metrics
  const complianceMetrics = useMemo(() => {
    const total = complianceData.length;
    const totalScripts = complianceData.reduce(
      (sum, d) => sum + (d.prescriptions_written || 0),
      0
    );
    const totalPatients = complianceData.reduce(
      (sum, d) => sum + (d.patients_with_scripts || 0),
      0
    );
    return { total, totalScripts, totalPatients };
  }, [complianceData]);

  // Calculate benefit comparison metrics
  const benefitMetrics = useMemo(() => {
    const drugsWithMixedBenefit = drugBenefitData.length;
    const totalClaimsWithoutBenefit = drugBenefitData.reduce(
      (sum, d) => sum + (Number(d.claims_without_benefit) || 0),
      0
    );
    const totalClaimsWithBenefit = drugBenefitData.reduce(
      (sum, d) => sum + (Number(d.claims_with_benefit) || 0),
      0
    );
    const totalBenefit = drugBenefitData.reduce(
      (sum, d) => sum + (Number(d.total_benefit) || 0),
      0
    );

    return {
      drugsWithMixedBenefit,
      totalClaimsWithoutBenefit,
      totalClaimsWithBenefit,
      totalBenefit,
    };
  }, [drugBenefitData]);

  // Calculate Medicaid metrics
  const medicaidMetrics = useMemo(() => {
    const totals = medicaidCarveSummary.reduce(
      (acc, row) => ({
        carvedInClaims: acc.carvedInClaims + (Number(row.carved_in_claims) || 0),
        carvedOutClaims: acc.carvedOutClaims + (Number(row.carved_out_claims) || 0),
        carvedInBenefit: acc.carvedInBenefit + (Number(row.carved_in_benefit) || 0),
        carvedInPayments: acc.carvedInPayments + (Number(row.carved_in_payments) || 0),
        totalMedicaid: acc.totalMedicaid + (Number(row.total_medicaid_claims) || 0),
      }),
      { carvedInClaims: 0, carvedOutClaims: 0, carvedInBenefit: 0, carvedInPayments: 0, totalMedicaid: 0 }
    );

    const carveOutRate = totals.totalMedicaid > 0
      ? (totals.carvedOutClaims / totals.totalMedicaid) * 100
      : 0;

    return { ...totals, carveOutRate };
  }, [medicaidCarveSummary]);

  // Filter compliance data
  const filteredComplianceData = useMemo(() => {
    return complianceData.filter((item) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        !searchQuery ||
        item.pharmacy_name?.toLowerCase().includes(searchLower) ||
        item.chain_pharmacy?.toLowerCase().includes(searchLower) ||
        item.npi_number?.toString().includes(searchLower)
      );
    });
  }, [complianceData, searchQuery]);

  // Filter benefit data
  const filteredBenefitData = useMemo(() => {
    return drugBenefitData.filter((item) => {
      const searchLower = benefitSearchQuery.toLowerCase();
      return (
        !benefitSearchQuery ||
        item.drug_name?.toLowerCase().includes(searchLower) ||
        item.ndc?.toString().includes(searchLower)
      );
    });
  }, [drugBenefitData, benefitSearchQuery]);

  // Prepare chart data for Medicaid carve trends
  const medicaidChartData = medicaidCarveSummary.slice(0, 12).reverse().map((row) => ({
    month: formatMonth(row.month),
    "Carved In": Number(row.carved_in_claims) || 0,
    "Carved Out": Number(row.carved_out_claims) || 0,
  }));

  // Export handlers
  const handleExportBenefitExcel = () => {
    const columns: ExportColumn<DrugBenefitSummary>[] = [
      { header: "Drug Name", accessor: "drug_name", width: 30 },
      { header: "NDC", accessor: "ndc", format: "text", width: 15 },
      { header: "Total Pharmacies", accessor: "total_pharmacies", format: "number", width: 16 },
      { header: "With Benefit", accessor: "pharmacies_with_benefit", format: "number", width: 14 },
      { header: "Without Benefit", accessor: "pharmacies_without_benefit", format: "number", width: 16 },
      { header: "Total Claims", accessor: "total_claims", format: "number", width: 14 },
      { header: "Claims With Benefit", accessor: "claims_with_benefit", format: "number", width: 18 },
      { header: "Claims Without Benefit", accessor: "claims_without_benefit", format: "number", width: 20 },
      { header: "Total Benefit", accessor: "total_benefit", format: "currency", width: 16 },
    ];
    exportToExcel(filteredBenefitData, columns, {
      filename: "pharmacy-benefit-comparison",
      sheetName: "Benefit Comparison",
      includeTimestamp: true,
    });
  };

  const handleExportMedicaidExcel = () => {
    const columns: ExportColumn<MedicaidCarveSummary>[] = [
      { header: "Month", accessor: "month", format: "date", width: 12 },
      { header: "Carved In Claims", accessor: "carved_in_claims", format: "number", width: 16 },
      { header: "Carved In Payments", accessor: "carved_in_payments", format: "currency", width: 18 },
      { header: "Carved In Benefit", accessor: "carved_in_benefit", format: "currency", width: 18 },
      { header: "Carved Out Claims", accessor: "carved_out_claims", format: "number", width: 18 },
      { header: "Total Medicaid", accessor: "total_medicaid_claims", format: "number", width: 16 },
      { header: "Carve Out Rate %", accessor: "carve_out_rate_pct", format: "percent", width: 16 },
    ];
    exportToExcel(medicaidCarveSummary, columns, {
      filename: "medicaid-carve-analysis",
      sheetName: "Medicaid Carve",
      includeTimestamp: true,
    });
  };

  const handleExportComplianceExcel = () => {
    const columns: ExportColumn<ContractComplianceData>[] = [
      { header: "Pharmacy Name", accessor: "pharmacy_name", width: 30 },
      { header: "Chain", accessor: "chain_pharmacy", width: 20 },
      { header: "NPI", accessor: "npi_number", format: "text", width: 12 },
      { header: "NABP", accessor: "nabp_number", format: "text", width: 12 },
      { header: "Status", accessor: "contract_status", width: 16 },
      { header: "Scripts Written", accessor: "prescriptions_written", format: "number", width: 16 },
      { header: "Patients", accessor: "patients_with_scripts", format: "number", width: 12 },
      { header: "Prescribers", accessor: "prescribers_writing", format: "number", width: 12 },
    ];
    exportToExcel(filteredComplianceData, columns, {
      filename: "uncontracted-pharmacies",
      sheetName: "Compliance",
      includeTimestamp: true,
    });
  };

  const isLoading = complianceLoading || benefitLoading || medicaidSummaryLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contract Pharmacy Analysis
            </h1>
            <p className="text-muted-foreground">
              Pharmacy benefit comparison, Medicaid carve-out analysis, and contract compliance
            </p>
          </div>
        </div>

        {/* Tabs for different analyses */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="benefit" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Benefit Comparison
            </TabsTrigger>
            <TabsTrigger value="medicaid" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              Medicaid Carve
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Uncontracted
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: Pharmacy Benefit Comparison */}
          <TabsContent value="benefit" className="space-y-6">
            {/* Benefit Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Drugs with Mixed Benefit</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {benefitMetrics.drugsWithMixedBenefit}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Benefit varies by pharmacy
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Claims With Benefit</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {benefitMetrics.totalClaimsWithBenefit.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    340B benefit received
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Claims Without Benefit</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {benefitMetrics.totalClaimsWithoutBenefit.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    No 340B benefit
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total 340B Benefit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(benefitMetrics.totalBenefit)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From drugs with mixed benefit
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Benefit Comparison Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldAlert className="h-5 w-5 text-orange-500" />
                      Pharmacy Benefit Comparison
                    </CardTitle>
                    <CardDescription>
                      Drugs where some pharmacies show 340B benefit while others do not
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search drug, NDC..."
                        className="pl-8 w-[200px]"
                        value={benefitSearchQuery}
                        onChange={(e) => setBenefitSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportBenefitExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {benefitLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredBenefitData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <p>No benefit discrepancies detected</p>
                    <p className="text-sm">All drugs show consistent 340B benefit across pharmacies</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Drug Name</TableHead>
                          <TableHead>NDC</TableHead>
                          <TableHead className="text-center">Total Pharmacies</TableHead>
                          <TableHead className="text-center">With Benefit</TableHead>
                          <TableHead className="text-center">Without Benefit</TableHead>
                          <TableHead className="text-right">Total Claims</TableHead>
                          <TableHead className="text-right">Total Benefit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBenefitData.slice(0, 100).map((item, index) => (
                          <TableRow key={`${item.ndc}-${index}`}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {item.drug_name || "Unknown"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.ndc || "N/A"}
                            </TableCell>
                            <TableCell className="text-center">
                              {item.total_pharmacies || 0}
                            </TableCell>
                            <TableCell className="text-center text-green-600 font-medium">
                              {item.pharmacies_with_benefit || 0}
                            </TableCell>
                            <TableCell className="text-center text-red-600 font-medium">
                              {item.pharmacies_without_benefit || 0}
                            </TableCell>
                            <TableCell className="text-right">
                              {(Number(item.total_claims) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium text-green-600">
                              {formatCurrency(Number(item.total_benefit) || 0)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredBenefitData.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 100 of {filteredBenefitData.length.toLocaleString()} drugs
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 2: Medicaid Carve-In vs Carve-Out Analysis */}
          <TabsContent value="medicaid" className="space-y-6">
            {/* Medicaid Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Carved-In Claims</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {medicaidMetrics.carvedInClaims.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    340B eligible Medicaid claims
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Carved-Out Claims</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {medicaidMetrics.carvedOutClaims.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Not 340B eligible Medicaid claims
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Carve-Out Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {medicaidMetrics.carveOutRate.toFixed(1)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Of all Medicaid claims
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Carved-In Benefit</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {formatCurrency(medicaidMetrics.carvedInBenefit)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    340B benefit from carved-in
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Medicaid Trend Chart */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Medicaid Carve Trends</CardTitle>
                  <CardDescription>
                    Monthly breakdown of carved-in vs carved-out Medicaid claims
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportMedicaidExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </CardHeader>
              <CardContent>
                {medicaidSummaryLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : medicaidChartData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    No Medicaid claims data available
                  </div>
                ) : (
                  <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={medicaidChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="month"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                        <Bar dataKey="Carved In" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Carved Out" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Medicaid Monthly Table */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Medicaid Carve Summary</CardTitle>
                <CardDescription>
                  Detailed breakdown of Medicaid claims by carve status
                </CardDescription>
              </CardHeader>
              <CardContent>
                {medicaidSummaryLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : medicaidCarveSummary.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-muted-foreground">
                    No Medicaid carve data available
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Carved-In Claims</TableHead>
                          <TableHead className="text-right">Carved-In Payments</TableHead>
                          <TableHead className="text-right">Carved-In Benefit</TableHead>
                          <TableHead className="text-right">Carved-Out Claims</TableHead>
                          <TableHead className="text-right">Total Medicaid</TableHead>
                          <TableHead className="text-right">Carve-Out Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {medicaidCarveSummary.slice(0, 12).map((row, index) => (
                          <TableRow key={row.month || index}>
                            <TableCell className="font-medium">
                              {formatMonth(row.month)}
                            </TableCell>
                            <TableCell className="text-right text-green-600">
                              {(Number(row.carved_in_claims) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(Number(row.carved_in_payments) || 0)}
                            </TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              {formatCurrency(Number(row.carved_in_benefit) || 0)}
                            </TableCell>
                            <TableCell className="text-right text-red-600">
                              {(Number(row.carved_out_claims) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {(Number(row.total_medicaid_claims) || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              <Badge
                                className={
                                  Number(row.carve_out_rate_pct) > 50
                                    ? "bg-red-100 text-red-800"
                                    : Number(row.carve_out_rate_pct) > 25
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-green-100 text-green-800"
                                }
                              >
                                {(Number(row.carve_out_rate_pct) || 0).toFixed(1)}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        {/* Totals Row */}
                        <TableRow className="bg-muted/50 font-semibold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right text-green-600">
                            {medicaidMetrics.carvedInClaims.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(medicaidMetrics.carvedInPayments)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(medicaidMetrics.carvedInBenefit)}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {medicaidMetrics.carvedOutClaims.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            {medicaidMetrics.totalMedicaid.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge className="bg-muted text-muted-foreground">
                              {medicaidMetrics.carveOutRate.toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab 3: Uncontracted Pharmacies */}
          <TabsContent value="compliance" className="space-y-6">
            {/* Compliance Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Uncontracted Pharmacies</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {complianceMetrics.total.toLocaleString()}
                  </div>
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
                    {complianceMetrics.totalScripts.toLocaleString()}
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
                  <div className="text-2xl font-bold">
                    {complianceMetrics.totalPatients.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Unique patients affected
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Uncontracted Pharmacies Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Pharmacies Not in Contract List
                    </CardTitle>
                    <CardDescription>
                      Pharmacies with prescriptions (60+ days old) that are NOT in the contracted pharmacies list
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search pharmacy, NPI..."
                        className="pl-8 w-[200px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Button variant="outline" size="sm" onClick={handleExportComplianceExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {complianceLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                  </div>
                ) : filteredComplianceData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                    <p>All pharmacies are contracted!</p>
                    <p className="text-sm">No compliance issues detected</p>
                  </div>
                ) : (
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pharmacy Name</TableHead>
                          <TableHead>Chain</TableHead>
                          <TableHead>NPI</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Scripts Written</TableHead>
                          <TableHead className="text-right">Patients</TableHead>
                          <TableHead className="text-right">Prescribers</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredComplianceData.slice(0, 100).map((item) => (
                          <TableRow key={item.pharmacy_id}>
                            <TableCell className="font-medium max-w-[200px] truncate">
                              {item.pharmacy_name || "Unknown"}
                            </TableCell>
                            <TableCell>{item.chain_pharmacy || "-"}</TableCell>
                            <TableCell className="font-mono text-sm">
                              {item.npi_number || "N/A"}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                <XCircle className="w-3 h-3 mr-1" />
                                {item.contract_status || "Not Contracted"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {(item.prescriptions_written || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {(item.patients_with_scripts || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {(item.prescribers_writing || 0).toLocaleString()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {filteredComplianceData.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-4 text-center">
                    Showing first 100 of {filteredComplianceData.length.toLocaleString()} pharmacies
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}