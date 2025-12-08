import { FileText, Receipt, Scale, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { AdjudicationChart } from "@/components/dashboard/AdjudicationChart";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your 340B claims and adjudication status
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            title="Total Scripts"
            value="2,847"
            description="This month"
            icon={FileText}
            trend={{ value: 12, isPositive: true }}
            variant="primary"
          />
          <StatsCard
            title="Active Claims"
            value="1,115"
            description="Awaiting adjudication"
            icon={Receipt}
            trend={{ value: 8, isPositive: true }}
            variant="default"
          />
          <StatsCard
            title="Adjudicated"
            value="847"
            description="Successfully processed"
            icon={Scale}
            trend={{ value: 15, isPositive: true }}
            variant="success"
          />
          <StatsCard
            title="Pending Review"
            value="156"
            description="Requires attention"
            icon={AlertTriangle}
            trend={{ value: 3, isPositive: false }}
            variant="warning"
          />
        </div>

        {/* Charts and Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AdjudicationChart />
          <RecentActivity />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
