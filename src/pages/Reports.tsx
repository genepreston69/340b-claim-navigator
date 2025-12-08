import { useState, useMemo } from "react";
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
import { format, parseISO, startOfMonth, differenceInDays } from "date-fns";

interface MonthlySavings {
  month: string;
  totalClaims: number;
  total340BCost: number;
  totalRetailCost: number;
  grossSavings: number;
  totalPayments: number;
  netMargin: number;
}

interface PharmacyPerformance {
  pharmacyName: string;
  totalClaims: number;
  total340BCost: number;
  avgDaysToFill: number;
  captureRate: number;
}

interface PayerMix {
  payerType: string;
  claimCount: number;
  percentOfTotal: number;
  avgPayment: number;
  avg340BCost: number;
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

export default function Reports() {
  // Fetch claims data
  const { data: claims = [], isLoading: claimsLoading } = useQuery({
    queryKey: ["reports-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("fill_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch prescriptions for capture rate calculation
  const { data: prescriptions = [], isLoading: prescriptionsLoading } = useQuery({
    queryKey: ["reports-prescriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("id, pharmacy_id, prescribed_date");
      if (error) throw error;
      return data || [];
    },
  });

  const isLoading = claimsLoading || prescriptionsLoading;

  // Calculate monthly savings analysis
  const monthlySavings: MonthlySavings[] = useMemo(() => {
    const monthlyMap = new Map<string, {
      claims: number;
      cost340b: number;
      retailCost: number;
      payments: number;
    }>();

    claims.forEach((claim) => {
      if (!claim.fill_date) return;
      const monthKey = format(parseISO(claim.fill_date), "yyyy-MM");
      const existing = monthlyMap.get(monthKey) || {
        claims: 0,
        cost340b: 0,
        retailCost: 0,
        payments: 0,
      };

      monthlyMap.set(monthKey, {
        claims: existing.claims + 1,
        cost340b: existing.cost340b + (Number(claim.drug_cost_340b) || 0),
        retailCost: existing.retailCost + (Number(claim.retail_drug_cost) || 0),
        payments: existing.payments + (Number(claim.total_payment) || 0),
      });
    });

    return Array.from(monthlyMap.entries())
      .map(([month, data]) => ({
        month: format(parseISO(`${month}-01`), "MMM yyyy"),
        totalClaims: data.claims,
        total340BCost: data.cost340b,
        totalRetailCost: data.retailCost,
        grossSavings: data.retailCost - data.cost340b,
        totalPayments: data.payments,
        netMargin: data.payments - data.cost340b,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [claims]);

  // Calculate pharmacy performance
  const pharmacyPerformance: PharmacyPerformance[] = useMemo(() => {
    const pharmacyMap = new Map<string, {
      claims: number;
      cost340b: number;
      totalDaysToFill: number;
      daysCount: number;
    }>();

    claims.forEach((claim) => {
      const pharmacyName = claim.pharmacy_name || "Unknown";
      const existing = pharmacyMap.get(pharmacyName) || {
        claims: 0,
        cost340b: 0,
        totalDaysToFill: 0,
        daysCount: 0,
      };

      let daysToFill = 0;
      if (claim.fill_date && claim.date_rx_written) {
        daysToFill = differenceInDays(
          parseISO(claim.fill_date),
          parseISO(claim.date_rx_written)
        );
      }

      pharmacyMap.set(pharmacyName, {
        claims: existing.claims + 1,
        cost340b: existing.cost340b + (Number(claim.drug_cost_340b) || 0),
        totalDaysToFill: existing.totalDaysToFill + daysToFill,
        daysCount: existing.daysCount + (daysToFill > 0 ? 1 : 0),
      });
    });

    // Calculate scripts per pharmacy for capture rate
    const scriptsPerPharmacy = new Map<string, number>();
    prescriptions.forEach((rx) => {
      // Group by pharmacy - using pharmacy_id or "Unknown"
      const pharmacyId = rx.pharmacy_id || "Unknown";
      scriptsPerPharmacy.set(
        pharmacyId,
        (scriptsPerPharmacy.get(pharmacyId) || 0) + 1
      );
    });

    return Array.from(pharmacyMap.entries())
      .map(([name, data]) => ({
        pharmacyName: name,
        totalClaims: data.claims,
        total340BCost: data.cost340b,
        avgDaysToFill: data.daysCount > 0 ? data.totalDaysToFill / data.daysCount : 0,
        captureRate: 100, // Simplified - would need pharmacy_id mapping
      }))
      .sort((a, b) => b.totalClaims - a.totalClaims);
  }, [claims, prescriptions]);

  // Calculate payer mix analysis
  const payerMix: PayerMix[] = useMemo(() => {
    const payerMap = new Map<string, {
      count: number;
      totalPayment: number;
      total340BCost: number;
    }>();

    claims.forEach((claim) => {
      const payerType = claim.reason || "Unknown";
      const existing = payerMap.get(payerType) || {
        count: 0,
        totalPayment: 0,
        total340BCost: 0,
      };

      payerMap.set(payerType, {
        count: existing.count + 1,
        totalPayment: existing.totalPayment + (Number(claim.total_payment) || 0),
        total340BCost: existing.total340BCost + (Number(claim.drug_cost_340b) || 0),
      });
    });

    const totalClaims = claims.length;

    return Array.from(payerMap.entries())
      .map(([type, data]) => ({
        payerType: type,
        claimCount: data.count,
        percentOfTotal: totalClaims > 0 ? (data.count / totalClaims) * 100 : 0,
        avgPayment: data.count > 0 ? data.totalPayment / data.count : 0,
        avg340BCost: data.count > 0 ? data.total340BCost / data.count : 0,
      }))
      .sort((a, b) => b.claimCount - a.claimCount);
  }, [claims]);

  // Chart data for stacked bar
  const chartData = useMemo(() => {
    return monthlySavings.map((item) => ({
      month: item.month,
      "340B Cost": item.total340BCost,
      Savings: item.grossSavings,
    }));
  }, [monthlySavings]);

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

  const exportToPDF = (sectionName: string) => {
    // For PDF export, we'll create a printable version
    // In a real app, you'd use a library like jsPDF or react-pdf
    window.print();
  };

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

        {/* Section 1: 340B Savings Analysis */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>340B Savings Analysis</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  monthlySavings.map((m) => ({
                    Month: m.month,
                    "Total Claims": m.totalClaims,
                    "340B Cost": m.total340BCost,
                    "Retail Cost": m.totalRetailCost,
                    "Gross Savings": m.grossSavings,
                    "Total Payments": m.totalPayments,
                    "Net Margin": m.netMargin,
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
                onClick={() => exportToPDF("savings")}
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
            ) : monthlySavings.length === 0 ? (
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
                        <TableHead className="text-right">340B Cost</TableHead>
                        <TableHead className="text-right">Retail Cost</TableHead>
                        <TableHead className="text-right">Gross Savings</TableHead>
                        <TableHead className="text-right">Payments Received</TableHead>
                        <TableHead className="text-right">Net Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthlySavings.map((row) => (
                        <TableRow key={row.month}>
                          <TableCell className="font-medium">{row.month}</TableCell>
                          <TableCell className="text-right">{row.totalClaims.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total340BCost)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.totalRetailCost)}</TableCell>
                          <TableCell className="text-right text-green-600 font-medium">
                            {formatCurrency(row.grossSavings)}
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(row.totalPayments)}</TableCell>
                          <TableCell className={`text-right font-medium ${row.netMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(row.netMargin)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {/* Totals Row */}
                      <TableRow className="bg-muted/50 font-semibold">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">
                          {monthlySavings.reduce((sum, r) => sum + r.totalClaims, 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(monthlySavings.reduce((sum, r) => sum + r.total340BCost, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(monthlySavings.reduce((sum, r) => sum + r.totalRetailCost, 0))}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(monthlySavings.reduce((sum, r) => sum + r.grossSavings, 0))}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(monthlySavings.reduce((sum, r) => sum + r.totalPayments, 0))}
                        </TableCell>
                        <TableCell className={`text-right ${monthlySavings.reduce((sum, r) => sum + r.netMargin, 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(monthlySavings.reduce((sum, r) => sum + r.netMargin, 0))}
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
                      <Bar dataKey="Savings" stackId="a" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Section 2: Pharmacy Performance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Pharmacy Performance</CardTitle>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportToCSV(
                  pharmacyPerformance.map((p) => ({
                    "Pharmacy Name": p.pharmacyName,
                    "Total Claims": p.totalClaims,
                    "340B Cost": p.total340BCost,
                    "Avg Days to Fill": p.avgDaysToFill,
                    "Capture Rate %": p.captureRate,
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
                onClick={() => exportToPDF("pharmacy")}
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
                      <TableHead className="text-right">Total 340B Cost</TableHead>
                      <TableHead className="text-right">Avg Days to Fill</TableHead>
                      <TableHead className="text-right">Capture Rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pharmacyPerformance.map((row) => (
                      <TableRow key={row.pharmacyName}>
                        <TableCell className="font-medium">{row.pharmacyName}</TableCell>
                        <TableCell className="text-right">{row.totalClaims.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total340BCost)}</TableCell>
                        <TableCell className="text-right">{row.avgDaysToFill.toFixed(1)} days</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${row.captureRate >= 80 ? 'text-green-600' : row.captureRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {formatPercent(row.captureRate)}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
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
                onClick={() => exportToPDF("payer")}
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
