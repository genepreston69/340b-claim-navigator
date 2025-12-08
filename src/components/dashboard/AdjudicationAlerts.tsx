import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type AdjudicationStatus = Tables<"adjudication_status">;

interface AdjudicationAlertsProps {
  alerts: AdjudicationStatus[];
  isLoading?: boolean;
}

export function AdjudicationAlerts({ alerts, isLoading }: AdjudicationAlertsProps) {
  const navigate = useNavigate();

  return (
    <Card className="border-l-4 border-l-destructive">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Adjudication Alerts
        </CardTitle>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/adjudication")}>
          View All
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : alerts.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <AlertCircle className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p>No overdue scripts</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 max-h-[280px] overflow-y-auto">
            {alerts.map((alert) => {
              const daysOverdue = alert.prescribed_date 
                ? differenceInDays(new Date(), new Date(alert.prescribed_date))
                : 0;
              
              return (
                <div 
                  key={alert.prescription_id} 
                  className="flex items-start justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20 hover:bg-destructive/10 transition-colors cursor-pointer"
                  onClick={() => navigate("/adjudication")}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{alert.medication_name || "Unknown Drug"}</span>
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-xs">
                        {daysOverdue} days
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {alert.patient_name || "Unknown"} • Rx #{alert.prescription_identifier || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Prescribed: {alert.prescribed_date ? format(new Date(alert.prescribed_date), "MMM d, yyyy") : "-"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{alert.pharmacy_name || "-"}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
