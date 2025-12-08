import { FileText, Receipt, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  type: "script" | "claim" | "adjudicated" | "pending" | "error";
  title: string;
  description: string;
  timestamp: string;
}

const activityIcons = {
  script: FileText,
  claim: Receipt,
  adjudicated: CheckCircle2,
  pending: Clock,
  error: AlertCircle,
};

const activityStyles = {
  script: "bg-info/10 text-info",
  claim: "bg-primary/10 text-primary",
  adjudicated: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  error: "bg-destructive/10 text-destructive",
};

const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "adjudicated",
    title: "Claim #CL-2024-1234 Adjudicated",
    description: "Successfully matched with Script #RX-5678",
    timestamp: "2 minutes ago",
  },
  {
    id: "2",
    type: "script",
    title: "New Script Imported",
    description: "45 prescriptions added from pharmacy feed",
    timestamp: "15 minutes ago",
  },
  {
    id: "3",
    type: "pending",
    title: "Pending Adjudication",
    description: "12 claims awaiting manufacturer response",
    timestamp: "1 hour ago",
  },
  {
    id: "4",
    type: "error",
    title: "Matching Error",
    description: "Script #RX-9012 requires manual review",
    timestamp: "2 hours ago",
  },
  {
    id: "5",
    type: "claim",
    title: "Claims Batch Received",
    description: "78 new claims from PBM partner",
    timestamp: "3 hours ago",
  },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivities.map((activity) => {
          const Icon = activityIcons[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-lg p-3 transition-colors hover:bg-muted/50"
            >
              <div className={cn("rounded-lg p-2", activityStyles[activity.type])}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">{activity.title}</p>
                <p className="text-xs text-muted-foreground">{activity.description}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {activity.timestamp}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
