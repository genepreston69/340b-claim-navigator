import { useNavigate } from "react-router-dom";
import { BarChart3, Pill, Stethoscope, Building2, FileWarning, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const analyticsRoutes = [
  {
    title: "Financial Reports",
    description: "View 340B savings analysis, pharmacy performance, and payer mix breakdowns",
    icon: BarChart3,
    url: "/reports",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  {
    title: "Prescription Adherence",
    description: "Analyze prescription fill rates, adherence trends, and drug-level metrics",
    icon: Pill,
    url: "/prescription-adherence",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  {
    title: "Physician Capture Rates",
    description: "Track prescriber performance, capture rates, and estimated lost revenue",
    icon: Stethoscope,
    url: "/physician-capture-rates",
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
  },
  {
    title: "Drug-Pharmacy Comparison",
    description: "Compare drug dispensing across pharmacies, market share, and profitability",
    icon: Building2,
    url: "/drug-pharmacy-comparison",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  {
    title: "Contract Compliance",
    description: "Identify prescriptions written to non-contracted pharmacies",
    icon: FileWarning,
    url: "/contract-compliance",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
];

const Index = () => {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Select a report to view detailed 340B program analytics
          </p>
        </div>

        {/* Analytics Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {analyticsRoutes.map((route) => (
            <Card
              key={route.url}
              className="group cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-primary/50"
              onClick={() => navigate(route.url)}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-lg ${route.bgColor}`}>
                    <route.icon className={`h-6 w-6 ${route.color}`} />
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <CardTitle className="mt-4 text-lg">{route.title}</CardTitle>
                <CardDescription className="text-sm">
                  {route.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <span className="text-sm font-medium text-primary group-hover:underline">
                  View Report →
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;