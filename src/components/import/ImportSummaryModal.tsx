import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Users,
  Building2,
  Pill,
  Stethoscope,
  MapPin,
  CreditCard,
} from "lucide-react";
import { ImportSummary } from "@/utils/etlProcessor";
import { cn } from "@/lib/utils";

interface ImportSummaryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ImportSummary | null;
  fileType: "Scripts" | "Claims";
  fileName: string;
}

export function ImportSummaryModal({
  open,
  onOpenChange,
  summary,
  fileType,
  fileName,
}: ImportSummaryModalProps) {
  if (!summary) return null;

  const isSuccess = summary.errors.length === 0 && summary.recordsImported > 0;
  const hasWarnings = summary.recordsSkipped > 0 || summary.errors.length > 0;

  const referenceItems = [
    {
      label: "Covered Entities",
      count: summary.referenceDataCreated.coveredEntities,
      icon: Building2,
    },
    {
      label: "Pharmacies",
      count: summary.referenceDataCreated.pharmacies,
      icon: Building2,
    },
    {
      label: "Prescribers",
      count: summary.referenceDataCreated.prescribers,
      icon: Stethoscope,
    },
    {
      label: "Locations",
      count: summary.referenceDataCreated.locations,
      icon: MapPin,
    },
    {
      label: "Drugs",
      count: summary.referenceDataCreated.drugs,
      icon: Pill,
    },
    {
      label: "Patients",
      count: summary.referenceDataCreated.patients,
      icon: Users,
    },
    {
      label: "Insurance Plans",
      count: summary.referenceDataCreated.insurancePlans,
      icon: CreditCard,
    },
  ].filter((item) => item.count > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {isSuccess ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
            ) : hasWarnings ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
            )}
            <div>
              <DialogTitle>Import Complete</DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                {fileType === "Scripts" ? (
                  <FileSpreadsheet className="h-4 w-4" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {fileName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Main Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-lg border bg-muted/30 p-4 text-center">
              <p className="text-2xl font-bold text-foreground">
                {summary.totalRecords.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Total Records</p>
            </div>
            <div className="rounded-lg border bg-success/5 border-success/20 p-4 text-center">
              <p className="text-2xl font-bold text-success">
                {summary.recordsImported.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Imported</p>
            </div>
            <div
              className={cn(
                "rounded-lg border p-4 text-center",
                summary.recordsSkipped > 0
                  ? "bg-warning/5 border-warning/20"
                  : "bg-muted/30"
              )}
            >
              <p
                className={cn(
                  "text-2xl font-bold",
                  summary.recordsSkipped > 0 ? "text-warning" : "text-muted-foreground"
                )}
              >
                {summary.recordsSkipped.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Skipped</p>
            </div>
          </div>

          {/* Reference Data Created */}
          {referenceItems.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">
                New Reference Data Created
              </h4>
              <div className="flex flex-wrap gap-2">
                {referenceItems.map((item) => (
                  <Badge
                    key={item.label}
                    variant="secondary"
                    className="gap-1.5 py-1.5 px-3"
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.count} {item.label}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Errors */}
          {summary.errors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-destructive flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                Errors ({summary.errors.length})
              </h4>
              <ScrollArea className="h-32 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <div className="space-y-2">
                  {summary.errors.slice(0, 20).map((error, index) => (
                    <div key={index} className="text-sm">
                      <span className="font-medium text-destructive">
                        {error.field ? `[${error.field}]` : `Row ${error.row}`}:
                      </span>{" "}
                      <span className="text-muted-foreground">{error.message}</span>
                    </div>
                  ))}
                  {summary.errors.length > 20 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      ... and {summary.errors.length - 20} more errors
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
