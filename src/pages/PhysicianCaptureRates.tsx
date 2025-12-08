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
  Stethoscope,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Search,
  AlertTriangle,
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
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { Tables } from "@/integrations/supabase/types";

type PhysicianData = Tables<"physician_capture_rates">;

const TIER_COLORS = {
  "High Performer": "hsl(142 76% 36%)",
  Moderate: "hsl(38 92% 50%)",
  Low: "hsl(25 95% 53%)",
  "Very Low": "hsl(0 84% 60%)",
  "No Scripts": "hsl(var(--muted-foreground))",
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

export default function PhysicianCaptureRates() {
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("capture_rate");

  // Fetch physician capture rate data
  const { data: physicianData = [], isLoading } = useQuery({
    queryKey: ["physician-capture-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("physician_capture_rates")
        .select("*")
        .order("total_prescriptions", { ascending: false });
      if (error) throw error;
      return (data || []) as PhysicianData[];
    },
  });

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const total = physicianData.length;
    const highPerformers = physicianData.filter(
      (d) => d.performance_tier === "High Performer"
    ).length;
    const lowPerformers = physicianData.filter(
      (d) => d.performance_tier === "Very Low" || d.performance_tier === "Low"
    ).length;

    const totalScripts = physicianData.reduce(
      (sum, d) => sum + (d.total_prescriptions || 0),
      0
    );
    const totalFilled = physicianData.reduce(
      (sum, d) => sum + (d.prescriptions_filled || 0),
      0
    );
    const totalSavings = physicianData.reduce(
      (sum, d) => sum + (d.gross_savings || 0),
      0
    );
    const totalLostRevenue = physicianData.reduce(
      (sum, d) => sum + (d.estimated_lost_revenue || 0),
      0
    );

    const avgCaptureRate =
      totalScripts > 0 ? (totalFilled / totalScripts) * 100 : 0;

    return {
      total,
      highPerformers,
      lowPerformers,
      avgCaptureRate,
      totalScripts,
      totalFilled,
      totalSavings,
      totalLostRevenue,
    };
  }, [physicianData]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data = physicianData.filter((item) => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        !searchQuery ||
        item.prescriber_full_name?.toLowerCase().includes(searchLower) ||
        item.prescriber_npi?.toString().includes(searchLower) ||
        item.prescriber_dea?.toLowerCase().includes(searchLower);

      // Tier filter
      const matchesTier =
        tierFilter === "all" || item.performance_tier === tierFilter;

      return matchesSearch && matchesTier;
    });

    // Sort
    switch (sortBy) {
      case "capture_rate":
        data = [...data].sort(
          (a, b) => (b.capture_rate_pct || 0) - (a.capture_rate_pct || 0)
        );
        break;
      case "scripts":
        data = [...data].sort(
          (a, b) => (b.total_prescriptions || 0) - (a.total_prescriptions || 0)
        );
        break;
      case "savings":
        data = [...data].sort(
          (a, b) => (b.gross_savings || 0) - (a.gross_savings || 0)
        );
        break;
      case "lost_revenue":
        data = [...data].sort(
          (a, b) => (b.estimated_lost_revenue || 0) - (a.estimated_lost_revenue || 0)
        );
        break;
    }

    return data;
  }, [physicianData, searchQuery, tierFilter, sortBy]);

  // Chart data - top 15 physicians by capture rate
  const captureRateChartData = useMemo(() => {
    return [...physicianData]
      .filter((d) => (d.total_prescriptions || 0) >= 5) // Only show physicians with at least 5 scripts
      .sort((a, b) => (b.capture_rate_pct || 0) - (a.capture_rate_pct || 0))
      .slice(0, 15)
      .map((d) => ({
        name:
          d.prescriber_full_name && d.prescriber_full_name.length > 20
            ? d.prescriber_full_name.substring(0, 20) + "..."
            : d.prescriber_full_name,
        captureRate: d.capture_rate_pct || 0,
        scripts: d.total_prescriptions || 0,
        tier: d.performance_tier,
      }));
  }, [physicianData]);

  // Scatter plot data - Scripts vs Capture Rate
  const scatterData = useMemo(() => {
    return physicianData
      .filter((d) => (d.total_prescriptions || 0) > 0)
      .map((d) => ({
        x: d.total_prescriptions || 0,
        y: d.capture_rate_pct || 0,
        name: d.prescriber_full_name,
        tier: d.performance_tier,
        savings: d.gross_savings || 0,
      }));
  }, [physicianData]);

  // Tier distribution
  const tierDistribution = useMemo(() => {
    const tiers: Record<string, number> = {};
    physicianData.forEach((d) => {
      const tier = d.performance_tier || "Unknown";
      tiers[tier] = (tiers[tier] || 0) + 1;
    });
    return Object.entries(tiers).map(([tier, count]) => ({
      tier,
      count,
      color: TIER_COLORS[tier as keyof typeof TIER_COLORS] || "gray",
    }));
  }, [physicianData]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Prescriber Name",
      "NPI",
      "DEA",
      "Total Prescriptions",
      "Prescriptions Filled",
      "Capture Rate %",
      "Performance Tier",
      "Unique Patients",
      "Unique Drugs",
      "Total Payments",
      "340B Cost",
      "Gross Savings",
      "Estimated Lost Revenue",
      "Avg Days to Fill",
    ];

    const rows = filteredData.map((item) => [
      item.prescriber_full_name || "",
      item.prescriber_npi || "",
      item.prescriber_dea || "",
      item.total_prescriptions || 0,
      item.prescriptions_filled || 0,
      item.capture_rate_pct || 0,
      item.performance_tier || "",
      item.unique_patients || 0,
      item.unique_drugs || 0,
      item.total_payments || 0,
      item.total_340b_cost || 0,
      item.gross_savings || 0,
      item.estimated_lost_revenue || 0,
      item.avg_days_to_fill || 0,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join(
      "\n"
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "physician-capture-rates.csv";
    link.click();
  };

  const getTierBadge = (tier: string | null) => {
    const color = TIER_COLORS[tier as keyof typeof TIER_COLORS] || "gray";
    const variants: Record<string, string> = {
      "High Performer": "bg-green-100 text-green-800",
      Moderate: "bg-yellow-100 text-yellow-800",
      Low: "bg-orange-100 text-orange-800",
      "Very Low": "bg-red-100 text-red-800",
      "No Scripts": "bg-gray-100 text-gray-800",
    };

    return (
      <Badge className={`${variants[tier || ""] || "bg-gray-100 text-gray-800"} hover:${variants[tier || ""]}`}>
        {tier === "High Performer" && <TrendingUp className="w-3 h-3 mr-1" />}
        {(tier === "Low" || tier === "Very Low") && (
          <TrendingDown className="w-3 h-3 mr-1" />
        )}
        {tier}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Physician Capture Rates
            </h1>
            <p className="text-muted-foreground">
              Analyze prescriber-level 340B capture rates and identify improvement opportunities
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
              <CardTitle className="text-sm font-medium">Total Prescribers</CardTitle>
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active prescribers in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Capture Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatPercent(metrics.avgCaptureRate)}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics.totalFilled.toLocaleString()} of {metrics.totalScripts.toLocaleString()} scripts filled
              </p>
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
              <p className="text-xs text-muted-foreground">
                340B program savings
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Lost Revenue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(metrics.totalLostRevenue)}
              </div>
              <p className="text-xs text-muted-foreground">
                Estimated from unfilled scripts
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Physicians by Capture Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Physicians by Capture Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : captureRateChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  No physician data available
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={captureRateChartData}
                      layout="vertical"
                      margin={{ left: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
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
                        formatter={(value: number, name: string) => [
                          name === "captureRate"
                            ? `${value.toFixed(1)}%`
                            : value.toLocaleString(),
                          name === "captureRate" ? "Capture Rate" : "Total Scripts",
                        ]}
                      />
                      <Legend />
                      <Bar
                        dataKey="captureRate"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                        name="Capture Rate %"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Tier Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Performance Tier Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[350px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : tierDistribution.length === 0 ? (
                <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                  No tier data available
                </div>
              ) : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tierDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="tier"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => [
                          value.toLocaleString(),
                          "Physicians",
                        ]}
                      />
                      <Bar dataKey="count" name="Physicians" radius={[4, 4, 0, 0]}>
                        {tierDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Scripts vs Capture Rate Scatter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Prescription Volume vs Capture Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[300px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : scatterData.length === 0 ? (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data available for scatter plot
              </div>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Scripts"
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: "Total Prescriptions", position: "bottom", offset: 0 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="Capture Rate"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                      stroke="hsl(var(--muted-foreground))"
                      label={{ value: "Capture Rate %", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number, name: string) => [
                        name === "y" ? `${value.toFixed(1)}%` : value.toLocaleString(),
                        name === "y" ? "Capture Rate" : "Scripts",
                      ]}
                      labelFormatter={(label) => ""}
                    />
                    <Scatter name="Physicians" data={scatterData}>
                      {scatterData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={TIER_COLORS[entry.tier as keyof typeof TIER_COLORS] || "gray"}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Prescriber Details</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search name, NPI, DEA..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={tierFilter} onValueChange={setTierFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Performance Tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="High Performer">High Performer</SelectItem>
                    <SelectItem value="Moderate">Moderate</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Very Low">Very Low</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="capture_rate">Capture Rate</SelectItem>
                    <SelectItem value="scripts">Total Scripts</SelectItem>
                    <SelectItem value="savings">Gross Savings</SelectItem>
                    <SelectItem value="lost_revenue">Lost Revenue</SelectItem>
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
                No prescribers found
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prescriber</TableHead>
                      <TableHead className="text-center">Scripts</TableHead>
                      <TableHead className="text-center">Filled</TableHead>
                      <TableHead className="text-center">Capture Rate</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-center">Patients</TableHead>
                      <TableHead className="text-right">Savings</TableHead>
                      <TableHead className="text-right">Lost Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.slice(0, 100).map((item, index) => (
                      <TableRow key={item.prescriber_id || index}>
                        <TableCell>
                          <div className="font-medium">{item.prescriber_full_name}</div>
                          <div className="text-xs text-muted-foreground">
                            NPI: {item.prescriber_npi || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {(item.total_prescriptions || 0).toLocaleString()}
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
                        <TableCell>{getTierBadge(item.performance_tier)}</TableCell>
                        <TableCell className="text-center">
                          {(item.unique_patients || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-medium">
                          {formatCurrency(item.gross_savings)}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-medium">
                          {formatCurrency(item.estimated_lost_revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {filteredData.length > 100 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                Showing first 100 of {filteredData.length.toLocaleString()} prescribers
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
