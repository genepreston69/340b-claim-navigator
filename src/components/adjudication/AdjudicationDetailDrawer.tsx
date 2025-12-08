import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Clock, DollarSign, Pill, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type AdjudicationStatus = Tables<"adjudication_status">;
type Claim = Tables<"claims">;

interface AdjudicationDetailDrawerProps {
  selectedRow: AdjudicationStatus | null;
  onClose: () => void;
}

const statusColors: Record<string, { bg: string; text: string; border: string }> = {
  "Never Filled": { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/20" },
  "Partial": { bg: "bg-warning/10", text: "text-warning", border: "border-warning/20" },
  "Complete": { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
};

export const AdjudicationDetailDrawer = ({ selectedRow, onClose }: AdjudicationDetailDrawerProps) => {
  const navigate = useNavigate();

  // Fetch claims for this prescription
  const { data: claims, isLoading: claimsLoading } = useQuery({
    queryKey: ["claims", selectedRow?.prescription_identifier],
    queryFn: async () => {
      if (!selectedRow?.prescription_identifier) return [];
      
      const { data, error } = await supabase
        .from("claims")
        .select("*")
        .eq("prescription_number", selectedRow.prescription_identifier)
        .order("refill_number", { ascending: true });
      
      if (error) throw error;
      return data as Claim[];
    },
    enabled: !!selectedRow?.prescription_identifier,
  });

  // Calculate summary stats
  const totalFillsExpected = (selectedRow?.refills_authorized ?? 0) + 1;
  const fillsAdjudicated = claims?.length ?? 0;
  const fillsRemaining = totalFillsExpected - fillsAdjudicated;
  const total340BCost = claims?.reduce((sum, c) => sum + (c.drug_cost_340b ?? 0), 0) ?? 0;
  const totalPayments = claims?.reduce((sum, c) => sum + (c.total_payment ?? 0), 0) ?? 0;
  const totalRetailCost = claims?.reduce((sum, c) => sum + (c.retail_drug_cost ?? 0), 0) ?? 0;
  const estimatedSavings = totalRetailCost - total340BCost;

  const handleViewAllClaims = () => {
    if (selectedRow?.prescription_identifier) {
      navigate(`/claims?rx=${selectedRow.prescription_identifier}`);
    }
    onClose();
  };

  if (!selectedRow) return null;

  const status = selectedRow.adjudication_status || "Never Filled";
  const colors = statusColors[status] || statusColors["Never Filled"];

  return (
    <Sheet open={!!selectedRow} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-3xl w-full p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">Prescription Details</SheetTitle>
              <SheetDescription>
                Rx #{selectedRow.prescription_identifier || "-"}
              </SheetDescription>
            </div>
            <Badge 
              variant="outline" 
              className={cn("text-sm px-3 py-1", colors.bg, colors.text, colors.border)}
            >
              {status}
            </Badge>
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* Two Column Layout */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left Side - Prescription Details */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Prescription Information
                </h4>
                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                  <DetailRow label="Prescription #" value={selectedRow.prescription_identifier?.toString() || "-"} />
                  <DetailRow 
                    label="Date Written" 
                    value={selectedRow.prescribed_date ? format(new Date(selectedRow.prescribed_date), "MMM d, yyyy") : "-"} 
                  />
                  <Separator className="my-2" />
                  <DetailRow label="Patient Name" value={selectedRow.patient_name || "-"} />
                  <DetailRow label="MRN" value={selectedRow.patient_mrn || "-"} />
                  <Separator className="my-2" />
                  <DetailRow label="Prescriber" value={selectedRow.prescriber_name || "-"} />
                  <DetailRow label="Pharmacy" value={selectedRow.pharmacy_name || "-"} />
                  <Separator className="my-2" />
                  <DetailRow label="Medication" value={selectedRow.medication_name || "-"} />
                  <DetailRow label="NDC" value={selectedRow.ndc_code || "-"} />
                  <DetailRow label="Quantity" value={selectedRow.dispense_quantity?.toString() || "-"} />
                  <DetailRow label="Days Supply" value={selectedRow.days_supply?.toString() || "-"} />
                  <DetailRow label="Refills Authorized" value={selectedRow.refills_authorized?.toString() ?? "0"} />
                  <DetailRow label="Rx Status" value={selectedRow.prescription_status || "-"} />
                </div>
              </div>

              {/* Right Side - Claims History */}
              <div className="space-y-4">
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Claims History
                </h4>
                <div className="bg-muted/30 rounded-lg p-4">
                  {claimsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : !claims || claims.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Pill className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No claims found for this prescription</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {claims.map((claim, index) => (
                        <div 
                          key={claim.id} 
                          className="bg-card rounded-md p-3 border border-border space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              {claim.refill_number === 0 ? "Original Fill" : `Refill #${claim.refill_number}`}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              Claim #{claim.claim_id || "-"}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Fill Date: </span>
                              <span className="font-medium">
                                {claim.fill_date ? format(new Date(claim.fill_date), "MMM d, yyyy") : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Claim Date: </span>
                              <span className="font-medium">
                                {claim.claim_date ? format(new Date(claim.claim_date), "MMM d, yyyy") : "-"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Qty: </span>
                              <span className="font-medium">{claim.qty_dispensed || "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Payer: </span>
                              <span className="font-medium">{claim.reason || "-"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">340B Cost: </span>
                              <span className="font-medium">
                                ${(claim.drug_cost_340b || 0).toFixed(2)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Payment: </span>
                              <span className="font-medium text-success">
                                ${(claim.total_payment || 0).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom - Summary */}
            <div className="space-y-4">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                Adjudication Summary
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <SummaryCard 
                  label="Total Fills Expected" 
                  value={totalFillsExpected.toString()}
                  sublabel={`(1 original + ${selectedRow.refills_authorized ?? 0} refills)`}
                />
                <SummaryCard 
                  label="Fills Adjudicated" 
                  value={fillsAdjudicated.toString()}
                  valueClassName={fillsAdjudicated > 0 ? "text-success" : "text-muted-foreground"}
                />
                <SummaryCard 
                  label="Fills Remaining" 
                  value={fillsRemaining.toString()}
                  valueClassName={fillsRemaining > 0 ? "text-warning" : "text-success"}
                />
                <SummaryCard 
                  label="Total 340B Cost" 
                  value={`$${total340BCost.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                />
                <SummaryCard 
                  label="Total Payments Received" 
                  value={`$${totalPayments.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  valueClassName="text-success"
                />
                <SummaryCard 
                  label="Estimated Savings" 
                  value={`$${estimatedSavings.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                  valueClassName={estimatedSavings > 0 ? "text-primary" : "text-muted-foreground"}
                  sublabel="(Retail - 340B Cost)"
                />
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-6 pt-4 border-t border-border">
          <Button 
            onClick={handleViewAllClaims} 
            className="w-full gap-2"
            disabled={!selectedRow.prescription_identifier}
          >
            <ExternalLink className="h-4 w-4" />
            View All Claims for This Prescription
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium text-foreground">{value}</span>
  </div>
);

const SummaryCard = ({ 
  label, 
  value, 
  sublabel,
  valueClassName 
}: { 
  label: string; 
  value: string; 
  sublabel?: string;
  valueClassName?: string;
}) => (
  <div className="bg-muted/30 rounded-lg p-4 text-center">
    <p className="text-sm text-muted-foreground">{label}</p>
    <p className={cn("text-xl font-bold", valueClassName)}>{value}</p>
    {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
  </div>
);
