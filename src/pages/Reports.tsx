import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, TrendingUp, Building2, PieChart } from "lucide-react";
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
import { format, parseISO } from "date-fns";

interface MonthlyFinancialSummary {
  month: string;
  total_claims: number;
  total_340b_cost: number;
  total_retail_cost: number;
  gross_savings: number;
  total_payments: number;
  benefit_340b: number;
  total_patient_pay: number;
  total_third_party_payment: number;
  total_dispensing_fees: number;
  avg_days_supply: number;
}

interface MonthlyPharmacySummary {
  month: string;
  pharmacy_id: string | null;
  pharmacy_name: string | null;
  total_claims: number;
  total_340b_cost: number;
  total_retail_cost: number;
  gross_savings: number;
  total_payments: number;
  benefit_340b: number;
  total_patient_pay: number;
  total_third_party_payment: number;
  avg_days_to_fill: number;
}

interface MonthlyPayerSummary {
  month: string;
  payer_type: string;
  claim_count: number;
  total_340b_cost: number;
  total_payments: number;
  avg_payment: number;
  avg_340b_cost: number;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number) => {
  return `${value.toFixed(1)}%`;
};

const formatMonth = (dateStr: string) => {
  try {
    return format(parseISO(dateStr), "MMM yyyy");
  } catch {
    return dateStr;
  }
};

export default function Reports() {
  // Fetch monthly financial summary from view
  const { data: monthlySummary = [], isLoading: monthlySummaryLoading } = useQuery({
    queryKey: ["monthly-financial-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_financial_summary")
        .select("*")
        .order("month", { ascending: true });
      if (error) throw error;
      return (data || []) as MonthlyFinancialSummary[];
    },
  });

  // Fetch monthly pharmacy summary from view
  const { data: pharmacySummary = [], isLoading: pharmacySummaryLoading } = useQuery({
    queryKey: ["monthly-pharmacy-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_pharmacy_summary")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as MonthlyPharmacySummary[];
    },
  });

  // Fetch monthly payer summary from view
  const { data: payerSummary = [], isLoading: payerSummaryLoading } = useQuery({
    queryKey: ["monthly-payer-summary"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_payer_summary")
        .select("*")
        .order("month", { ascending: false });
      if (error) throw error;
      return (data || []) as MonthlyPayerSummary[];
    },
  });

  const isLoading = monthlySummaryLoading || pharmacySummaryLoading || payerSummaryLoading;

  // Aggregate pharmacy performance across all months
  const pharmacyPerformance = pharmacySummary.reduce((acc, row) => {
    const name = row.pharmacy_name || "Unknown";
    const existing = acc.find((p) => p.pharmacyName === name);
    if (existing) {
      existing.totalClaims += Number(row.total_claims) || 0;
      existing.total340BCost += Number(row.total_340b_cost) || 0;
      existing.totalPayments += Number(row.total_payments) || 0;
      existing.benefit340B += Number(row.benefit_340b) || 0;
      existing.monthCount += 1;
    } else {
      acc.push({
        pharmacyName: name,
        totalClaims: Number(row.total_claims) || 0,
        total340BCost: Number(row.total_340b_cost) || 0,
        totalPayments: Number(row.total_payments) || 0,
        benefit340B: Number(row.benefit_340b) || 0,
        monthCount: 1,
      });
    }
    return acc;
  }, [] as Array<{
    pharmacyName: string;
    totalClaims: number;
    total340BCost: number;
    totalPayments: number;
    benefit340B: number;
    monthCount: number;
  }>).sort((a, b) => b.totalClaims - a.totalClaims);

  // Aggregate payer mix across all months
  const totalClaimsAll = payerSummary.reduce((sum, r) => sum + (Number(r.claim_count) || 0), 0);
  const payerMix = payerSummary.reduce((acc, row) => {
    const type = row.payer_type || "Unknown";
    const existing = acc.find((p) => p.payerType === type);
    if (existing) {
      existing.claimCount += Number(row.claim_count) || 0;
      existing.total340BCost += Number(row.total_340b_cost) || 0;
      existing.totalPayments += Number(row.total_payments) || 0;
    } else {
      acc.push({
        payerType: type,
        claimCount: Number(row.claim_count) || 0,
        total340BCost: Number(row.total_340b_cost) || 0,
        totalPayments: Number(row.total_payments) || 0,
      });
    }
    return acc;
  }, [] as Array<{
    payerType: string;
    claimCount: number;
    total340BCost: number;
    totalPayments: number;
  }>).map((p) => ({
    payerType: p.payerType,
    claimCount: p.claimCount,
    percentOfTotal: totalClaimsAll > 0 ? (p.claimCount / totalClaimsAll) * 100 : 0,
    avgPayment: p.claimCount > 0 ? p.totalPayments / p.claimCount : 0,
    avg340BCost: p.claimCount > 0 ? p.total340BCost / p.claimCount : 0,
  })).sort((a, b) => b.claimCount - a.claimCount);

  // Chart data for stacked bar
  const chartData = monthlySummary.map((item) => ({
    month: formatMonth(item.month),
    "340B Cost": Number(item.total_340b_cost) || 0,
    "340B Benefit": Number(item.benefit_340b) || 0,
  }));

  // Export functions
  const exportToCSV = (data: Record<string, unknown>[], filename: string) => {
    if (data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(","),
      ...data.map((row) =>
        headers.map((header) => {
          const value = row[header];
          if (typeof value === "number") {
            return value.toFixed(2);
          }
          return `"${value}"`;
        }).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  const exportToPDF = () => {
    window.print();
  };

  // Calculate totals for monthly summary
  const totalStats = monthlySummary.reduce(
    (acc, row) => ({
      totalClaims: acc.totalClaims + (Number(row.total_claims) || 0),
      totalPayments: acc.totalPayments + (Number(row.total_payments) || 0),
      total340BCost: acc.total340BCost + (Number(row.total_340b_cost) || 0),
      totalDispensingFees: acc.totalDispensingFees + (Number(row.total_dispensing_fees) || 0),
      benefit340B: acc.benefit340B + (Number(row.benefit_340b) || 0),
    }),
    { totalClaims: 0, totalPayments: 0, total340BCost: 0, totalDispensingFees: 0, benefit340B: 0 }
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Financial Reports</h1>
          <p className="text-muted-foreground">
            Comprehensive 340B program financial analytics and performance metrics
          </p>
        </div>

        {/* Section 1: 340B Savings Analysis - Monthly Totals */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>340B Savings Analysis - Monthly Performance</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
              onClick={() => exportToCSV(
                  monthlySummary.map((m) => ({
                    Month: formatMonth(m.month),
                    "Total Claims": m.total_claims,
                    "Total Payments": m.total_payments,
                    "340B Cost": m.total_340b_cost,
                    "Dispensing Fees": m.total_dispensing_fees,
                    "340B Benefit": m.benefit_340b,
                  })),
                  "340b-savings-analysis"
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : monthlySummary.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                No claims data available
              </div>
            ) : (
              <>
                {/* Monthly Table */}
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead className="text-right">Total Claims</TableHead>
                        <TableHead className="text-right">Total Payments</TableHead>
                        <TableHead className="text-right">340B Cost</TableHead>
                        <TableHead className="text-right">Dispensing Fees</TableHead>
                        <TableHead className="text-right">340B Benefit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlySummary.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{formatMonth(row.month)}</TableCell>
                          <TableCell className="text-right">{Number(row.total_claims).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(row.total_payments))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(row.total_340b_cost))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(row.total_dispensing_fees))}</TableCell>
                          <TableCell className={`text-right font-medium ${Number(row.benefit_340b) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Number(row.benefit_340b))}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">{totalStats.totalClaims.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalStats.totalPayments)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalStats.total340BCost)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(totalStats.totalDispensingFees)}</TableCell>
                        <TableCell className={`text-right ${totalStats.benefit340B >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(totalStats.benefit340B)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                {/* Stacked Bar Chart */}
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
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
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Legend />
                      <Bar dataKey="340B Cost" stackId="a" fill="hsl(var(--primary))" />
                      <Bar dataKey="340B Benefit" stackId="a" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Pharmacy Performance - Aggregated */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Pharmacy Performance Summary</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
              onClick={() => exportToCSV(
                  pharmacyPerformance.map((p) => ({
                    "Pharmacy Name": p.pharmacyName,
                    "Total Claims": p.totalClaims,
                    "Total Payments": p.totalPayments,
                    "340B Cost": p.total340BCost,
                    "340B Benefit": p.benefit340B,
                  })),
                  "pharmacy-performance"
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : pharmacyPerformance.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No pharmacy data available
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pharmacy Name</TableHead>
                        <TableHead className="text-right">Total Claims</TableHead>
                        <TableHead className="text-right">Total Payments</TableHead>
                        <TableHead className="text-right">340B Cost</TableHead>
                        <TableHead className="text-right">340B Benefit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pharmacyPerformance.map((row) => (
                        <TableRow key={row.pharmacyName}>
                          <TableCell className="font-medium">{row.pharmacyName}</TableCell>
                          <TableCell className="text-right">{row.totalClaims.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.totalPayments)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total340BCost)}</TableCell>
                          <TableCell className={`text-right font-medium ${row.benefit340B >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(row.benefit340B)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {pharmacyPerformance.reduce((sum, r) => sum + r.totalClaims, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(pharmacyPerformance.reduce((sum, r) => sum + r.totalPayments, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(pharmacyPerformance.reduce((sum, r) => sum + r.total340BCost, 0))}
                        </TableCell>
                        <TableCell className={`text-right ${pharmacyPerformance.reduce((sum, r) => sum + r.benefit340B, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(pharmacyPerformance.reduce((sum, r) => sum + r.benefit340B, 0))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Section 3: Payer Mix Analysis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <CardTitle>Payer Mix Analysis</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  payerMix.map((p) => ({
                    "Payer Type": p.payerType,
                    "Claim Count": p.claimCount,
                    "% of Total": p.percentOfTotal,
                    "Avg Payment": p.avgPayment,
                    "Avg 340B Cost": p.avg340BCost,
                  })),
                  "payer-mix-analysis"
                )}
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
              >
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : payerMix.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground">
                No payer data available
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payer Type</TableHead>
                      <TableHead className="text-right">Claim Count</TableHead>
                      <TableHead className="text-right">% of Total</TableHead>
                      <TableHead className="text-right">Avg Payment</TableHead>
                      <TableHead className="text-right">Avg 340B Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payerMix.map((row) => (
                      <TableRow key={row.payerType}>
                        <TableCell className="font-medium">{row.payerType}</TableCell>
                        <TableCell className="text-right">{row.claimCount.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatPercent(row.percentOfTotal)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avgPayment)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.avg340BCost)}</TableCell>
                      </TableRow>
                    ))}
                    {/* Totals Row */}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {payerMix.reduce((sum, r) => sum + r.claimCount, 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">100.0%</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          payerMix.reduce((sum, r) => sum + r.avgPayment * r.claimCount, 0) /
                          Math.max(payerMix.reduce((sum, r) => sum + r.claimCount, 0), 1)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          payerMix.reduce((sum, r) => sum + r.avg340BCost * r.claimCount, 0) /
                          Math.max(payerMix.reduce((sum, r) => sum + r.claimCount, 0), 1)
                        )}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
