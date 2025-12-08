import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { Receipt, DollarSign, AlertTriangle, Building2, CalendarIcon } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ClaimsVolumeChart } from "@/components/dashboard/ClaimsVolumeChart";
import { PayerBreakdownChart } from "@/components/dashboard/PayerBreakdownChart";
import { RecentClaimsTable } from "@/components/dashboard/RecentClaimsTable";
import { AdjudicationAlerts } from "@/components/dashboard/AdjudicationAlerts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Claim = Tables<"claims">;
type AdjudicationStatus = Tables<"adjudication_status">;
type MonthlyFinancialSummary = Tables<"monthly_financial_summary">;
type MonthlyPayerSummary = Tables<"monthly_payer_summary">;

const Index = () => {
  const [dateRange, setDateRange] = useState<"1m" | "3m" | "6m" | "1y">("3m");
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();

  // Calculate date range
  const { dateFrom, dateTo } = useMemo(() => {
    if (customDateFrom && customDateTo) {
      return { dateFrom: customDateFrom, dateTo: customDateTo };
    }
    
    const now = new Date();
    let from: Date;
    
    switch (dateRange) {
      case "1m":
        from = subMonths(now, 1);
        break;
      case "3m":
        from = subMonths(now, 3);
        break;
      case "6m":
        from = subMonths(now, 6);
        break;
      case "1y":
        from = subMonths(now, 12);
        break;
      default:
        from = subMonths(now, 3);
    }
    
    return { dateFrom: from, dateTo: now };
  }, [dateRange, customDateFrom, customDateTo]);

  // Current month bounds for "this month" metrics
  const currentMonthStart = startOfMonth(new Date());
  const currentMonthEnd = endOfMonth(new Date());

  // Fetch monthly financial summary for chart and metrics
  const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
    queryKey: ["dashboard-monthly-summary", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_financial_summary")
        .select("*")
        .gte("month", format(dateFrom, "yyyy-MM-dd"))
        .lte("month", format(dateTo, "yyyy-MM-dd"))
        .order("month", { ascending: true });
      
      if (error) throw error;
      return data as MonthlyFinancialSummary[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch monthly payer summary for payer breakdown
  const { data: payerData, isLoading: payerLoading } = useQuery({
    queryKey: ["dashboard-payer-summary", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_payer_summary")
        .select("*")
        .gte("month", format(dateFrom, "yyyy-MM-dd"))
        .lte("month", format(dateTo, "yyyy-MM-dd"));
      
      if (error) throw error;
      return data as MonthlyPayerSummary[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch recent claims (limited to 10)
  const { data: recentClaims, isLoading: recentClaimsLoading } = useQuery({
    queryKey: ["dashboard-recent-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("fill_date", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data as Claim[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch top pharmacy this month
  const { data: topPharmacyData } = useQuery({
    queryKey: ["dashboard-top-pharmacy", currentMonthStart.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_pharmacy_summary")
        .select("pharmacy_name, total_claims")
        .gte("month", format(currentMonthStart, "yyyy-MM-dd"))
        .lte("month", format(currentMonthEnd, "yyyy-MM-dd"))
        .order("total_claims", { ascending: false })
        .limit(1);
      
      if (error) throw error;
      return data?.[0] || null;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch adjudication status (limited for alerts)
  const { data: adjudicationData, isLoading: adjudicationLoading } = useQuery({
    queryKey: ["dashboard-adjudication"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adjudication_status")
        .select("*");
      
      if (error) throw error;
      return data as AdjudicationStatus[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Calculate metrics from monthly summary
  const metrics = useMemo(() => {
    if (!monthlyData) {
      return {
        claimsThisMonth: 0,
        savings340B: 0,
        topPharmacy: "N/A",
      };
    }

    // Current month data
    const currentMonthStr = format(currentMonthStart, "yyyy-MM");
    const thisMonthData = monthlyData.find(m => m.month && m.month.startsWith(currentMonthStr));
    
    // Total 340B Savings across date range
    const savings = monthlyData.reduce((sum, m) => sum + (m.gross_savings || 0), 0);

    return {
      claimsThisMonth: thisMonthData?.total_claims || 0,
      savings340B: savings,
      topPharmacy: topPharmacyData?.pharmacy_name || "N/A",
    };
  }, [monthlyData, currentMonthStart, topPharmacyData]);

  // Scripts pending (not complete)
  const scriptsPending = useMemo(() => {
    if (!adjudicationData) return 0;
    return adjudicationData.filter(d => d.adjudication_status !== "Complete").length;
  }, [adjudicationData]);

  // Adjudication alerts (Never Filled > 14 days)
  const adjudicationAlerts = useMemo(() => {
    if (!adjudicationData) return [];
    return adjudicationData
      .filter(d => {
        if (d.adjudication_status !== "Never Filled") return false;
        if (!d.prescribed_date) return false;
        const daysSincePrescribed = differenceInDays(new Date(), new Date(d.prescribed_date));
        return daysSincePrescribed > 14;
      })
      .sort((a, b) => {
        const aDate = a.prescribed_date ? new Date(a.prescribed_date).getTime() : 0;
        const bDate = b.prescribed_date ? new Date(b.prescribed_date).getTime() : 0;
        return aDate - bDate; // Oldest first
      })
      .slice(0, 10);
  }, [adjudicationData]);

  // Monthly claims volume data for chart
  const monthlyVolumeData = useMemo(() => {
    if (!monthlyData) return [];
    return monthlyData.map(m => ({
      week: m.month ? format(new Date(m.month), "MMM yyyy") : "",
      count: Number(m.total_claims) || 0,
    }));
  }, [monthlyData]);

  // Payer breakdown data (aggregated across months)
  const payerBreakdownData = useMemo(() => {
    if (!payerData) return [];

    const payerTotals: Record<string, number> = {};
    payerData.forEach(p => {
      const payer = p.payer_type || "Unknown";
      payerTotals[payer] = (payerTotals[payer] || 0) + Number(p.claim_count || 0);
    });

    return Object.entries(payerTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value, color: "" }));
  }, [payerData]);

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header with Date Filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">
              Overview of your 340B claims and adjudication status
            </p>
          </div>
          
          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Select value={dateRange} onValueChange={(v) => {
              setDateRange(v as typeof dateRange);
              setCustomDateFrom(undefined);
              setCustomDateTo(undefined);
            }}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m">Last Month</SelectItem>
                <SelectItem value="3m">Last 3 Months</SelectItem>
                <SelectItem value="6m">Last 6 Months</SelectItem>
                <SelectItem value="1y">Last Year</SelectItem>
              </SelectContent>
            </Select>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal w-[130px]",
                    !customDateFrom && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateFrom ? format(customDateFrom, "MMM d") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateFrom}
                  onSelect={(date) => {
                    setCustomDateFrom(date);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal w-[130px]",
                    !customDateTo && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {customDateTo ? format(customDateTo, "MMM d") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={customDateTo}
                  onSelect={(date) => {
                    setCustomDateTo(date);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Row 1: Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Claims This Month"
            value={metrics.claimsThisMonth.toLocaleString()}
            description={format(new Date(), "MMMM yyyy")}
            icon={Receipt}
            variant="primary"
          />
          <StatsCard
            title="340B Savings"
            value={`$${metrics.savings340B.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            description="Retail - 340B cost"
            icon={DollarSign}
            variant="success"
          />
          <StatsCard
            title="Scripts Pending"
            value={scriptsPending.toLocaleString()}
            description="Not yet complete"
            icon={AlertTriangle}
            variant={scriptsPending > 0 ? "warning" : "default"}
          />
          <StatsCard
            title="Top Pharmacy"
            value={metrics.topPharmacy.length > 15 ? metrics.topPharmacy.substring(0, 15) + "..." : metrics.topPharmacy}
            description="Most claims this month"
            icon={Building2}
            variant="default"
          />
        </div>

        {/* Row 2: Charts */}
        <div className="grid gap-6 lg:grid-cols-5">
          <ClaimsVolumeChart 
            data={monthlyVolumeData} 
            isLoading={monthlyLoading} 
          />
          <PayerBreakdownChart 
            data={payerBreakdownData} 
            isLoading={payerLoading} 
          />
        </div>

        {/* Row 3: Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentClaimsTable 
            claims={recentClaims || []} 
            isLoading={recentClaimsLoading} 
          />
          <AdjudicationAlerts 
            alerts={adjudicationAlerts} 
            isLoading={adjudicationLoading} 
          />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
