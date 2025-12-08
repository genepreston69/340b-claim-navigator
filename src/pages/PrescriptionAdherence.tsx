import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "use-debounce";
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
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "@/hooks/use-toast";

type AdherenceData = Tables<"prescription_adherence_analysis">;
type MonthlyTrend = Tables<"monthly_adherence_trends">;
type DrugSummary = Tables<"drug_adherence_summary">;

const COLORS = {
  fullyAdherent: "hsl(142 76% 36%)",
  partiallyAdherent: "hsl(38 92% 50%)",
  neverFilled: "hsl(0 84% 60%)",
  primary: "hsl(var(--primary))",
};

const formatCurrency = (value: number | null) => {
  if (value === null) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number | null) => {
  if (value === null) return "0%";
  return `${value.toFixed(1)}%`;
};

export default function PrescriptionAdherence() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, timeFilter, debouncedSearchQuery]);

  // Fetch filter options
  const { data: filterOptions } = useQuery({
    queryKey: ["adherence-filter-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adherence_filter_options")
        .select("*");
      
      if (error) throw error;
      
      const statuses: string[] = [];
      const timeCategories: string[] = [];
      
      (data || []).forEach((row: { filter_type: string; filter_value: string | null }) => {
        if (row.filter_value) {
          if (row.filter_type === "status") {
            statuses.push(row.filter_value);
          } else if (row.filter_type === "time_category") {
            timeCategories.push(row.filter_value);
          }
        }
      });
      
      return { statuses, timeCategories };
    },
  });

  // Fetch summary stats for metrics from aggregated view
  const { data: metricsSummary } = useQuery({
    queryKey: ["adherence-metrics-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adherence_metrics_summary")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch monthly trends
  const { data: monthlyTrends = [], isLoading: trendsLoading } = useQuery({
    queryKey: ["monthly-adherence-trends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_adherence_trends")
        .select("*")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data || []) as MonthlyTrend[];
    },
  });

  // Fetch drug-level summary
  const { data: drugSummary = [], isLoading: drugLoading } = useQuery({
    queryKey: ["drug-adherence-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drug_adherence_summary")
        .select("*")
        .order("total_prescriptions", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as DrugSummary[];
    },
  });

  // Fetch paginated adherence data
  const { data: paginatedResult, isLoading: adherenceLoading } = useQuery({
    queryKey: [
      "prescription-adherence-paginated",
      currentPage, pageSize, statusFilter, timeFilter, debouncedSearchQuery
    ],
    queryFn: async () => {
      let query = supabase
        .from("prescription_adherence_analysis")
        .select("*", { count: "exact" });

      // Apply filters
      if (statusFilter !== "all") {
        query = query.eq("adherence_status", statusFilter);
      }
      if (timeFilter !== "all") {
        query = query.eq("time_to_fill_category", timeFilter);
      }
      if (debouncedSearchQuery) {
        query = query.or(`drug_name.ilike.%${debouncedSearchQuery}%,ndc_code.ilike.%${debouncedSearchQuery}%`);
      }

      // Apply sorting and pagination
      query = query.order("prescribed_date", { ascending: false, nullsFirst: false });
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      
      return { data: data as AdherenceData[], totalCount: count || 0 };
    },
  });

  const adherenceData = paginatedResult?.data || [];
  const totalCount = paginatedResult?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  const isLoading = adherenceLoading || trendsLoading || drugLoading;

  // Use pre-aggregated metrics from summary view
  const metrics = useMemo(() => {
    if (!metricsSummary) {
      return {
        total: 0, fullyAdherent: 0, partiallyAdherent: 0, neverFilled: 0,
        avgFillRate: 0, totalPayments: 0, avgDaysToFill: 0, adherenceRate: 0,
      };
    }

    const total = Number(metricsSummary.total_prescriptions) || 0;
    const fullyAdherent = Number(metricsSummary.fully_adherent) || 0;
    const partiallyAdherent = Number(metricsSummary.partially_adherent) || 0;
    const neverFilled = Number(metricsSummary.never_filled) || 0;
    const avgFillRate = Number(metricsSummary.avg_fill_rate) || 0;
    const totalPayments = Number(metricsSummary.total_payments) || 0;
    const avgDaysToFill = Number(metricsSummary.avg_days_to_fill) || 0;

    return {
      total, fullyAdherent, partiallyAdherent, neverFilled,
      avgFillRate, totalPayments, avgDaysToFill,
      adherenceRate: total > 0 ? ((fullyAdherent + partiallyAdherent) / total) * 100 : 0,
    };
  }, [metricsSummary]);

  // Pie chart data for adherence status
  const pieData = useMemo(() => [
    { name: "Fully Adherent", value: metrics.fullyAdherent, color: COLORS.fullyAdherent },
    { name: "Partially Adherent", value: metrics.partiallyAdherent, color: COLORS.partiallyAdherent },
    { name: "Never Filled", value: metrics.neverFilled, color: COLORS.neverFilled },
  ], [metrics]);

  // Trend chart data
  const trendChartData = useMemo(() => {
    return monthlyTrends.map((item) => ({
      month: item.month ? format(parseISO(item.month), "MMM yy") : "",
      fillRate: item.fill_rate_pct || 0,
      prescriptions: item.total_prescriptions || 0,
      filled: item.prescriptions_filled || 0,
    }));
  }, [monthlyTrends]);

  // Export to CSV
  const handleExportCSV = async () => {
    const exportLimit = 10000;
    toast({ title: "Preparing export...", description: "Fetching data..." });

    try {
      let query = supabase
        .from("prescription_adherence_analysis")
        .select("*");

      if (statusFilter !== "all") {
        query = query.eq("adherence_status", statusFilter);
      }
      if (timeFilter !== "all") {
        query = query.eq("time_to_fill_category", timeFilter);
      }
      if (debouncedSearchQuery) {
        query = query.or(`drug_name.ilike.%${debouncedSearchQuery}%,ndc_code.ilike.%${debouncedSearchQuery}%`);
      }

      query = query.order("prescribed_date", { ascending: false }).limit(exportLimit);

      const { data: exportData, error } = await query;
      if (error) throw error;

      if (!exportData || exportData.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
      }

      const headers = [
        "Drug Name", "NDC Code", "Prescribed Date",
        "Expected Fills", "Actual Fills", "Fill Rate %", "Adherence Status",
        "Days to First Fill", "Total Payments", "340B Cost",
      ];

      const rows = exportData.map((item) => [
        item.drug_name || "",
        item.ndc_code || "",
        item.prescribed_date || "",
        item.expected_fills || 0,
        item.total_fills || 0,
        item.fill_rate_pct || 0,
        item.adherence_status || "",
        item.days_to_first_fill || "",
        item.total_payments || 0,
        item.total_340b_cost || 0,
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "prescription-adherence-report.csv";
      link.click();

      toast({ title: `Exported ${exportData.length.toLocaleString()} records` });
    } catch (err) {
      console.error("Export error:", err);
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "Fully Adherent":
        return (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 mr-1" />
            Fully Adherent
          </Badge>
        );
      case "Partially Adherent":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Partially Adherent
          </Badge>
        );
      case "Never Filled":
        return (
          <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
            <XCircle className="w-3 h-3 mr-1" />
            Never Filled
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
              Prescription Adherence
            </h1>
            <p className="text-muted-foreground">
              Track prescription fill rates, medication adherence, and patient compliance
            </p>
          </div>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Prescriptions</CardTitle>
              <Pill className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Scripts in tracking period</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Overall Fill Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {formatPercent(metrics.avgFillRate)}
              </div>
              <p className="text-xs text-muted-foreground">Average across all scripts</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Avg Days to Fill</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.avgDaysToFill.toFixed(1)} days</div>
              <p className="text-xs text-muted-foreground">Time from prescribed to filled</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Adherence Status Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Pill className="h-5 w-5" />
                Adherence Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [value.toLocaleString(), "Prescriptions"]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Fill Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Monthly Fill Rate Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : trendChartData.length === 0 ? (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  No trend data available
                </div>
              ) : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `${v}%`} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number, name: string) => [
                          name === "fillRate" ? `${value.toFixed(1)}%` : value,
                          name === "fillRate" ? "Fill Rate" : name,
                        ]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="fillRate" stroke={COLORS.primary} strokeWidth={2} dot={{ fill: COLORS.primary }} name="Fill Rate %" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Drug-Level Adherence Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Drug-Level Adherence Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : drugSummary.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No drug data available
              </div>
            ) : (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={drugSummary.slice(0, 10)} layout="vertical" margin={{ left: 150 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      type="category"
                      dataKey="drug_name"
                      width={140}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => (v?.length > 20 ? v.substring(0, 20) + "..." : v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                      formatter={(value: number) => [`${value.toFixed(1)}%`, "Fill Rate"]}
                    />
                    <Bar dataKey="fill_rate_pct" fill={COLORS.primary} radius={[0, 4, 4, 0]} name="Fill Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Prescription Details ({totalCount.toLocaleString()})</CardTitle>
              <div className="flex flex-wrap gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search patient, drug, MRN..."
                    className="pl-8 w-[200px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Adherence Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="Fully Adherent">Fully Adherent</SelectItem>
                    <SelectItem value="Partially Adherent">Partially Adherent</SelectItem>
                    <SelectItem value="Never Filled">Never Filled</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Time to Fill" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Times</SelectItem>
                    {filterOptions?.timeCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            {adherenceLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : adherenceData.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No prescriptions found
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead>Prescribed</TableHead>
                        <TableHead className="text-center">Expected</TableHead>
                        <TableHead className="text-center">Filled</TableHead>
                        <TableHead className="text-center">Fill Rate</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Days to Fill</TableHead>
                        <TableHead className="text-right">Total Payments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adherenceData.map((item, index) => (
                        <TableRow key={item.prescription_id || index}>
                          <TableCell>
                            <div className="font-medium">
                              {item.drug_name?.length && item.drug_name.length > 30
                                ? item.drug_name.substring(0, 30) + "..."
                                : item.drug_name}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.ndc_code}</div>
                          </TableCell>
                          <TableCell>
                            {item.prescribed_date ? format(parseISO(item.prescribed_date), "MMM d, yyyy") : "N/A"}
                          </TableCell>
                          <TableCell className="text-center">{item.expected_fills}</TableCell>
                          <TableCell className="text-center">{item.total_fills}</TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`font-medium ${
                                (item.fill_rate_pct || 0) >= 80
                                  ? "text-green-600"
                                  : (item.fill_rate_pct || 0) >= 50
                                  ? "text-yellow-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatPercent(item.fill_rate_pct)}
                            </span>
                          </TableCell>
                          <TableCell>{getStatusBadge(item.adherence_status)}</TableCell>
                          <TableCell className="text-right">
                            {item.days_to_first_fill !== null ? `${item.days_to_first_fill} days` : "-"}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(item.total_payments)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount.toLocaleString()} prescriptions
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
                      First
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                      Next
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages || totalPages === 0}>
                      Last
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
