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
  Building2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  DollarSign,
  TrendingDown,
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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Tables } from "@/integrations/supabase/types";

type ContractComplianceData = Tables<"pharmacy_contract_compliance">;

const STATUS_COLORS = {
  Active: "hsl(142 76% 36%)",
  "Low Activity - Review Needed": "hsl(38 92% 50%)",
  "Inactive (No claims in 90 days)": "hsl(25 95% 53%)",
  "No Claims - Likely Uncontracted": "hsl(0 84% 60%)",
};

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

export default function ContractCompliance() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("lost_revenue");

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
    const active = complianceData.filter((d) => d.contract_status === "Active").length;
    const uncontracted = complianceData.filter(
      (d) => d.contract_status === "No Claims - Likely Uncontracted"
    ).length;
    const inactive = complianceData.filter(
      (d) => d.contract_status === "Inactive (No claims in 90 days)"
    ).length;
    const lowActivity = complianceData.filter(
      (d) => d.contract_status === "Low Activity - Review Needed"
    ).length;

    const totalLostRevenue = complianceData.reduce(
      (sum, d) => sum + (d.estimated_lost_revenue || 0),
      0
    );
    const totalSavings = complianceData.reduce(
      (sum, d) => sum + (d.gross_savings || 0),
      0
    );
    const avgCaptureRate =
      complianceData.length > 0
        ? complianceData.reduce((sum, d) => sum + (d.capture_rate_pct || 0), 0) /
          complianceData.length
        : 0;

    return {
      total,
      active,
      uncontracted,
      inactive,
      lowActivity,
      needsAttention: uncontracted + inactive + lowActivity,
      totalLostRevenue,
      totalSavings,
      avgCaptureRate,
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

      const matchesStatus =
        statusFilter === "all" || item.contract_status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort
    switch (sortBy) {
      case "lost_revenue":
        data = [...data].sort(
          (a, b) => (b.estimated_lost_revenue || 0) - (a.estimated_lost_revenue || 0)
        );
        break;
      case "capture_rate":
        data = [...data].sort(
          (a, b) => (a.capture_rate_pct || 0) - (b.capture_rate_pct || 0)
        );
        break;
      case "scripts":
        data = [...data].sort(
          (a, b) => (b.prescriptions_written || 0) - (a.prescriptions_written || 0)
        );
        break;
      case "days_inactive":
        data = [...data].sort(
          (a, b) => (b.days_since_last_claim || 9999) - (a.days_since_last_claim || 9999)
        );
        break;
    }

    return data;
  }, [complianceData, searchQuery, statusFilter, sortBy]);

  // Status distribution for pie chart
  const statusDistribution = useMemo(() => {
    return [
      { name: "Active", value: metrics.active, color: STATUS_COLORS.Active },
      {
        name: "Low Activity",
        value: metrics.lowActivity,
        color: STATUS_COLORS["Low Activity - Review Needed"],
      },
      {
        name: "Inactive (90+ days)",
        value: metrics.inactive,
        color: STATUS_COLORS["Inactive (No claims in 90 days)"],
      },
      {
        name: "Uncontracted",
        value: metrics.uncontracted,
        color: STATUS_COLORS["No Claims - Likely Uncontracted"],
      },
    ].filter((d) => d.value > 0);
  }, [metrics]);

  // Top pharmacies by lost revenue
  const lostRevenueData = useMemo(() => {
    return [...complianceData]
      .filter((d) => (d.estimated_lost_revenue || 0) > 0)
      .sort((a, b) => (b.estimated_lost_revenue || 0) - (a.estimated_lost_revenue || 0))
      .slice(0, 10)
      .map((d) => ({
        name:
          d.pharmacy_name && d.pharmacy_name.length > 20
            ? d.pharmacy_name.substring(0, 20) + "..."
            : d.pharmacy_name || "Unknown",
        lostRevenue: d.estimated_lost_revenue || 0,
        captureRate: d.capture_rate_pct || 0,
      }));
  }, [complianceData]);

  // Uncontracted pharmacies needing attention
  const uncontractedPharmacies = useMemo(() => {
    return complianceData
      .filter((d) => d.contract_status === "No Claims - Likely Uncontracted")
      .sort((a, b) => (b.prescriptions_written || 0) - (a.prescriptions_written || 0));
  }, [complianceData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Pharmacy Name",
      "Chain",
      "NPI",
      "NABP",
      "Contract Status",
      "Prescriptions Written",
      "Prescriptions Filled",
      "Capture Rate %",
      "Total Claims",
      "Total Payments",
      "340B Cost",
      "Gross Savings",
      "Estimated Lost Revenue",
      "Days Since Last Claim",
      "First Prescription Date",
      "Last Prescription Date",
      "First Claim Date",
      "Last Claim Date",
    ];

    const rows = filteredData.map((item) => [
      item.pharmacy_name || "",
      item.chain_pharmacy || "",
      item.npi_number || "",
      item.nabp_number || "",
      item.contract_status || "",
      item.prescriptions_written || 0,
      item.prescriptions_filled || 0,
      item.capture_rate_pct || 0,
      item.total_claims || 0,
      item.total_payments || 0,
      item.total_340b_cost || 0,
      item.gross_savings || 0,
      item.estimated_lost_revenue || 0,
      item.days_since_last_claim || "",
      item.first_prescription_date || "",
      item.last_prescription_date || "",
      item.first_claim_date || "",
      item.last_claim_date || "",
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "pharmacy-contract-compliance.csv";
    link.click();
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Active":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case "Low Activity - Review Needed":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Low Activity
          </Badge>
        );
      case "Inactive (No claims in 90 days)":
        return (
          <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
            <Clock className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      case "No Claims - Likely Uncontracted":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Uncontracted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
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
              Prescriptions written 60+ days ago that have not been adjudicated by contracted pharmacies
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
              <CardTitle className="text-sm font-medium">Total Pharmacies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.active} active, {metrics.needsAttention} need attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Likely Uncontracted</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {metrics.uncontracted.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                No claims in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Estimated Lost Revenue</CardTitle>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.totalLostRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                From unfilled prescriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total 340B Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(metrics.totalSavings)}
              </div>
              <p className="text-xs text-muted-foreground">
                From active pharmacies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Contract Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : statusDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                      >
                        {statusDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [
                          value.toLocaleString(),
                          "Pharmacies",
                        ]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lost Revenue by Pharmacy */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-500" />
                Top Pharmacies by Lost Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : lostRevenueData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No lost revenue data available
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={lostRevenueData}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={120}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [formatCurrency(value), "Lost Revenue"]}
                      />
                      <Bar
                        dataKey="lostRevenue"
                        fill="hsl(0 84% 60%)"
                        radius={[0, 4, 4, 0]}
                        name="Lost Revenue"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Uncontracted Pharmacies Alert */}
        {uncontractedPharmacies.length > 0 && (
          <Card className="border-red-200 bg-red-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                Pharmacies Requiring Contract Review
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-red-700 mb-4">
                These pharmacies have prescriptions written but no claims in the 340B system.
                They may need to be contracted or may have integration issues.
              </p>
              <div className="rounded-md border border-red-200 overflow-x-auto bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead className="text-center">Scripts Written</TableHead>
                      <TableHead className="text-center">Patients</TableHead>
                      <TableHead className="text-center">Prescribers</TableHead>
                      <TableHead>Last Script Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uncontractedPharmacies.slice(0, 10).map((item, index) => (
                      <TableRow key={item.pharmacy_id || index}>
                        <TableCell className="font-medium">{item.pharmacy_name}</TableCell>
                        <TableCell>{item.chain_pharmacy || "-"}</TableCell>
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
                          {item.last_prescription_date
                            ? format(parseISO(item.last_prescription_date), "MMM d, yyyy")
                            : "N/A"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {uncontractedPharmacies.length > 10 && (
                <p className="text-sm text-red-600 mt-2 text-center">
                  + {uncontractedPharmacies.length - 10} more uncontracted pharmacies
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>All Pharmacies</CardTitle>
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Contract Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Low Activity - Review Needed">Low Activity</SelectItem>
                    <SelectItem value="Inactive (No claims in 90 days)">Inactive (90+ days)</SelectItem>
                    <SelectItem value="No Claims - Likely Uncontracted">Uncontracted</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lost_revenue">Lost Revenue</SelectItem>
                    <SelectItem value="capture_rate">Capture Rate</SelectItem>
                    <SelectItem value="scripts">Scripts Written</SelectItem>
                    <SelectItem value="days_inactive">Days Inactive</SelectItem>
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
                No pharmacies found
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pharmacy</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-center">Scripts</TableHead>
                      <TableHead className="text-center">Filled</TableHead>
                      <TableHead className="text-center">Capture Rate</TableHead>
                      <TableHead className="text-right">Savings</TableHead>
                      <TableHead className="text-right">Lost Revenue</TableHead>
                      <TableHead className="text-center">Days Inactive</TableHead>
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
                        <TableCell>{getStatusBadge(item.contract_status)}</TableCell>
                        <TableCell className="text-center">
                          {(item.prescriptions_written || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.prescriptions_filled || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`font-medium ${
                              (item.capture_rate_pct || 0) >= 80
                                ? "text-green-600"
                                : (item.capture_rate_pct || 0) >= 50
                                ? "text-yellow-600"
                                : "text-red-600"
                            }`}
                          >
                            {formatPercent(item.capture_rate_pct)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(item.gross_savings)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-medium">
                          {formatCurrency(item.estimated_lost_revenue)}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.days_since_last_claim !== null ? (
                            <span
                              className={
                                item.days_since_last_claim > 90
                                  ? "text-red-600 font-medium"
                                  : item.days_since_last_claim > 30
                                  ? "text-yellow-600"
                                  : ""
                              }
                            >
                              {item.days_since_last_claim}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Never</span>
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
                Showing first 100 of {filteredData.length.toLocaleString()} pharmacies
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
