import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek, subWeeks, differenceInDays } from "date-fns";
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

  // Fetch claims data
  const { data: claims, isLoading: claimsLoading } = useQuery({
    queryKey: ["dashboard-claims", dateFrom.toISOString(), dateTo.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .gte("fill_date", format(dateFrom, "yyyy-MM-dd"))
        .lte("fill_date", format(dateTo, "yyyy-MM-dd"))
        .order("fill_date", { ascending: false });
      
      if (error) throw error;
      return data as Claim[];
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  // Fetch adjudication status
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

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!claims) {
      return {
        claimsThisMonth: 0,
        savings340B: 0,
        topPharmacy: "N/A",
      };
    }

    // Claims this month
    const thisMonthClaims = claims.filter(c => {
      if (!c.fill_date) return false;
      const fillDate = new Date(c.fill_date);
      return fillDate >= currentMonthStart && fillDate <= currentMonthEnd;
    });

    // 340B Savings
    const savings = claims.reduce((sum, c) => {
      const retail = c.retail_drug_cost || 0;
      const cost340b = c.drug_cost_340b || 0;
      return sum + (retail - cost340b);
    }, 0);

    // Top pharmacy this month
    const pharmacyCounts: Record<string, number> = {};
    thisMonthClaims.forEach(c => {
      if (c.pharmacy_name) {
        pharmacyCounts[c.pharmacy_name] = (pharmacyCounts[c.pharmacy_name] || 0) + 1;
      }
    });
    const topPharmacy = Object.entries(pharmacyCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A";

    return {
      claimsThisMonth: thisMonthClaims.length,
      savings340B: savings,
      topPharmacy,
    };
  }, [claims, currentMonthStart, currentMonthEnd]);

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

  // Weekly claims volume data
  const weeklyVolumeData = useMemo(() => {
    if (!claims) return [];

    const weeks: Record<string, number> = {};
    
    // Generate week labels for last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(new Date(), i));
      const label = format(weekStart, "MMM d");
      weeks[label] = 0;
    }

    // Count claims per week
    claims.forEach(c => {
      if (!c.fill_date) return;
      const fillDate = new Date(c.fill_date);
      const weekStart = startOfWeek(fillDate);
      const label = format(weekStart, "MMM d");
      if (weeks[label] !== undefined) {
        weeks[label]++;
      }
    });

    return Object.entries(weeks).map(([week, count]) => ({ week, count }));
  }, [claims]);

  // Payer breakdown data
  const payerBreakdownData = useMemo(() => {
    if (!claims) return [];

    const payerCounts: Record<string, number> = {};
    claims.forEach(c => {
      const payer = c.reason || "Unknown";
      payerCounts[payer] = (payerCounts[payer] || 0) + 1;
    });

    return Object.entries(payerCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, value]) => ({ name, value, color: "" }));
  }, [claims]);

  // Recent claims (last 10)
  const recentClaims = useMemo(() => {
    if (!claims) return [];
    return claims.slice(0, 10);
  }, [claims]);

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
            data={weeklyVolumeData} 
            isLoading={claimsLoading} 
          />
          <PayerBreakdownChart 
            data={payerBreakdownData} 
            isLoading={claimsLoading} 
          />
        </div>

        {/* Row 3: Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentClaimsTable 
            claims={recentClaims} 
            isLoading={claimsLoading} 
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
