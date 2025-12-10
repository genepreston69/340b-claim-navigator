import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths, startOfMonth, endOfMonth, startOfWeek } from "date-fns";
import { DateRange } from "react-day-picker";
import { DollarSign, FileText, Clock, Building2 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ClaimsVolumeChart } from "@/components/dashboard/ClaimsVolumeChart";
import { PayerBreakdownChart } from "@/components/dashboard/PayerBreakdownChart";
import { RecentClaimsTable } from "@/components/dashboard/RecentClaimsTable";
import { AdjudicationAlerts } from "@/components/dashboard/AdjudicationAlerts";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Fetch claims count for current month
  const { data: claimsThisMonth, isLoading: claimsLoading } = useQuery({
    queryKey: ["dashboard-claims-count", dateRange],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("claims")
        .select("*", { count: "exact", head: true })
        .gte("fill_date", format(dateRange.from!, "yyyy-MM-dd"))
        .lte("fill_date", format(dateRange.to!, "yyyy-MM-dd"));
      
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch 340B savings
  const { data: savings340b, isLoading: savingsLoading } = useQuery({
    queryKey: ["dashboard-savings", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("retail_drug_cost, drug_cost_340b")
        .gte("fill_date", format(dateRange.from!, "yyyy-MM-dd"))
        .lte("fill_date", format(dateRange.to!, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      const totalSavings = (data || []).reduce((acc, claim) => {
        const retail = claim.retail_drug_cost || 0;
        const cost340b = claim.drug_cost_340b || 0;
        return acc + (retail - cost340b);
      }, 0);
      
      return totalSavings;
    },
  });

  // Fetch pending adjudications count
  const { data: pendingScripts, isLoading: pendingLoading } = useQuery({
    queryKey: ["dashboard-pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("adjudication_status")
        .select("adjudication_status")
        .neq("adjudication_status", "Complete");
      
      if (error) throw error;
      return data?.length || 0;
    },
  });

  // Fetch top pharmacy
  const { data: topPharmacy, isLoading: pharmacyLoading } = useQuery({
    queryKey: ["dashboard-top-pharmacy", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("pharmacy_name")
        .gte("fill_date", format(dateRange.from!, "yyyy-MM-dd"))
        .lte("fill_date", format(dateRange.to!, "yyyy-MM-dd"))
        .not("pharmacy_name", "is", null);
      
      if (error) throw error;
      
      // Count by pharmacy
      const pharmacyCounts: Record<string, number> = {};
      (data || []).forEach((claim) => {
        const name = claim.pharmacy_name || "Unknown";
        pharmacyCounts[name] = (pharmacyCounts[name] || 0) + 1;
      });
      
      // Find top pharmacy
      let topName = "N/A";
      let topCount = 0;
      Object.entries(pharmacyCounts).forEach(([name, count]) => {
        if (count > topCount) {
          topName = name;
          topCount = count;
        }
      });
      
      return { name: topName, count: topCount };
    },
  });

  // Fetch claims volume trend (weekly for last 3 months)
  const { data: claimsVolumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ["dashboard-claims-volume"],
    queryFn: async () => {
      const threeMonthsAgo = subMonths(new Date(), 3);
      const { data, error } = await supabase
        .from("claims")
        .select("fill_date")
        .gte("fill_date", format(threeMonthsAgo, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      // Group by week
      const weeklyData: Record<string, number> = {};
      (data || []).forEach((claim) => {
        const date = new Date(claim.fill_date);
        const weekStart = startOfWeek(date);
        const weekKey = format(weekStart, "MMM d");
        weeklyData[weekKey] = (weeklyData[weekKey] || 0) + 1;
      });
      
      return Object.entries(weeklyData)
        .map(([week, count]) => ({ week, count }))
        .slice(-12);
    },
  });

  // Fetch payer breakdown
  const { data: payerData, isLoading: payerLoading } = useQuery({
    queryKey: ["dashboard-payer-breakdown", dateRange],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("reason")
        .gte("fill_date", format(dateRange.from!, "yyyy-MM-dd"))
        .lte("fill_date", format(dateRange.to!, "yyyy-MM-dd"));
      
      if (error) throw error;
      
      // Count by payer type (reason field)
      const payerCounts: Record<string, number> = {};
      (data || []).forEach((claim) => {
        const payer = claim.reason || "Unknown";
        payerCounts[payer] = (payerCounts[payer] || 0) + 1;
      });
      
      const colors = [
        "hsl(var(--chart-1))",
        "hsl(var(--chart-2))",
        "hsl(var(--chart-3))",
        "hsl(var(--chart-4))",
        "hsl(var(--chart-5))",
      ];
      
      return Object.entries(payerCounts).map(([name, value], index) => ({
        name,
        value,
        color: colors[index % colors.length],
      }));
    },
  });

  // Fetch recent claims
  const { data: recentClaims, isLoading: recentClaimsLoading } = useQuery({
    queryKey: ["dashboard-recent-claims"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .order("fill_date", { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch adjudication alerts (Never Filled scripts older than 14 days)
  const { data: adjudicationAlerts, isLoading: alertsLoading } = useQuery({
    queryKey: ["dashboard-adjudication-alerts"],
    queryFn: async () => {
      const fourteenDaysAgo = format(subMonths(new Date(), 0.5), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("adjudication_status")
        .select("*")
        .eq("adjudication_status", "Never Filled")
        .lt("prescribed_date", fourteenDaysAgo)
        .limit(5);
      
      if (error) throw error;
      return data || [];
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header with Date Range */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
            <p className="text-muted-foreground">
              340B program overview and key metrics
            </p>
          </div>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Claims This Month"
            value={claimsThisMonth?.toLocaleString() || "0"}
            icon={FileText}
            variant="default"
          />
          <StatsCard
            title="340B Savings"
            value={formatCurrency(savings340b || 0)}
            icon={DollarSign}
            variant="success"
          />
          <StatsCard
            title="Scripts Pending"
            value={pendingScripts?.toLocaleString() || "0"}
            icon={Clock}
            variant="warning"
          />
          <StatsCard
            title="Top Pharmacy"
            value={topPharmacy?.name || "N/A"}
            description={topPharmacy?.count ? `${topPharmacy.count} claims` : undefined}
            icon={Building2}
            variant="default"
          />
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ClaimsVolumeChart data={claimsVolumeData || []} isLoading={volumeLoading} />
          <PayerBreakdownChart data={payerData || []} isLoading={payerLoading} />
        </div>

        {/* Tables Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentClaimsTable claims={recentClaims || []} isLoading={recentClaimsLoading} />
          <AdjudicationAlerts alerts={adjudicationAlerts || []} isLoading={alertsLoading} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
