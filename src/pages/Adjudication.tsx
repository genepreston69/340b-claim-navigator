import { Scale, CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const pendingAdjudications = [
  {
    id: "ADJ-001",
    scriptId: "RX-2024-002",
    claimId: "CL-2024-1002",
    drug: "Lisinopril 10mg",
    patient: "Sarah M.",
    daysWaiting: 3,
    estimatedSavings: 45.50,
  },
  {
    id: "ADJ-002",
    scriptId: "RX-2024-006",
    claimId: "CL-2024-1006",
    drug: "Metoprolol 25mg",
    patient: "James L.",
    daysWaiting: 5,
    estimatedSavings: 67.80,
  },
  {
    id: "ADJ-003",
    scriptId: "RX-2024-007",
    claimId: "CL-2024-1007",
    drug: "Gabapentin 300mg",
    patient: "Linda W.",
    daysWaiting: 2,
    estimatedSavings: 123.45,
  },
];

const Adjudication = () => {
  const totalPending = 156;
  const processedToday = 23;
  const avgProcessingTime = 4.2;

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Adjudication</h2>
            <p className="text-muted-foreground">
              Review and process pending claim adjudications
            </p>
          </div>
          <Button className="gap-2">
            <Scale className="h-4 w-4" />
            Batch Process
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-warning/10 p-3">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold text-foreground">{totalPending}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-success/10 p-3">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processed Today</p>
                  <p className="text-2xl font-bold text-foreground">{processedToday}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-primary/10 p-3">
                  <Scale className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg. Processing Time</p>
                  <p className="text-2xl font-bold text-foreground">{avgProcessingTime} days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Processing Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Processing Progress</CardTitle>
            <CardDescription>Target: 50 adjudications per day</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium text-foreground">{processedToday}/50</span>
              </div>
              <Progress value={(processedToday / 50) * 100} className="h-2" />
            </div>
          </CardContent>
        </Card>

        {/* Pending Adjudications */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Adjudications</CardTitle>
            <CardDescription>Claims awaiting review and processing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {pendingAdjudications.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{item.drug}</span>
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
                        {item.daysWaiting} days waiting
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>Patient: {item.patient}</span>
                      <span>Script: {item.scriptId}</span>
                      <span>Claim: {item.claimId}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Est. Savings</p>
                      <p className="font-semibold text-success">${item.estimatedSavings.toFixed(2)}</p>
                    </div>
                    <Button size="sm" className="gap-1">
                      Review
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Adjudication;
