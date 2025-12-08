import { format } from "date-fns";
import { 
  FileText, 
  User, 
  Pill, 
  DollarSign, 
  Building2, 
  Calendar,
  Hash
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tables } from "@/integrations/supabase/types";

type Claim = Tables<"claims">;

interface ClaimDetailDrawerProps {
  claim: Claim | null;
  onClose: () => void;
}

export function ClaimDetailDrawer({ claim, onClose }: ClaimDetailDrawerProps) {
  if (!claim) return null;

  return (
    <Sheet open={!!claim} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col">
        <SheetHeader className="p-6 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="text-xl">Claim Details</SheetTitle>
              <SheetDescription>
                Claim #{claim.claim_id || "-"} • Rx #{claim.prescription_number}
              </SheetDescription>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {claim.refill_number === 0 ? "Original Fill" : `Refill #${claim.refill_number}`}
            </Badge>
          </div>
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-6">
            {/* Transaction Info */}
            <Section title="Transaction Information" icon={FileText}>
              <DetailGrid>
                <DetailRow label="Claim ID" value={claim.claim_id?.toString() || "-"} />
                <DetailRow label="Prescription #" value={claim.prescription_number?.toString() || "-"} />
                <DetailRow label="Refill #" value={claim.refill_number?.toString() || "-"} />
                <DetailRow label="Fill Date" value={claim.fill_date ? format(new Date(claim.fill_date), "MMM d, yyyy") : "-"} />
                <DetailRow label="Claim Date" value={claim.claim_date ? format(new Date(claim.claim_date), "MMM d, yyyy") : "-"} />
                <DetailRow label="Claim Captured" value={claim.claim_captured_date ? format(new Date(claim.claim_captured_date), "MMM d, yyyy") : "-"} />
                <DetailRow label="Date Rx Written" value={claim.date_rx_written ? format(new Date(claim.date_rx_written), "MMM d, yyyy") : "-"} />
                <DetailRow label="Claim Type" value={claim.claim_type || "-"} />
                <DetailRow label="Claim Sub Type" value={claim.claim_sub_type || "-"} />
                <DetailRow label="Transaction Code" value={claim.transaction_code || "-"} />
                <DetailRow label="Billing Model" value={claim.billing_model || "-"} />
                <DetailRow label="Replenishment Status" value={claim.replenishment_status || "-"} />
              </DetailGrid>
            </Section>

            {/* Patient Info */}
            <Section title="Patient Information" icon={User}>
              <DetailGrid>
                <DetailRow label="First Name" value={claim.first_name || "-"} />
                <DetailRow label="Last Name" value={claim.last_name || "-"} />
                <DetailRow label="Date of Birth" value={claim.date_of_birth ? format(new Date(claim.date_of_birth), "MMM d, yyyy") : "-"} />
                <DetailRow label="Gender" value={claim.gender || "-"} />
                <DetailRow label="MRN" value={claim.medical_record_number || "-"} />
                <DetailRow label="External Patient ID" value={claim.patient_id_external || "-"} />
              </DetailGrid>
            </Section>

            {/* Drug Info */}
            <Section title="Drug Information" icon={Pill}>
              <DetailGrid>
                <DetailRow label="Drug Name" value={claim.drug_name || "-"} />
                <DetailRow label="NDC" value={claim.ndc?.toString() || "-"} />
                <DetailRow label="Drug Indicator" value={claim.drug_indicator || "-"} />
                <DetailRow label="Manufacturer" value={claim.manufacturer_name || "-"} />
                <DetailRow label="Qty Dispensed" value={claim.qty_dispensed?.toString() || "-"} />
                <DetailRow label="Days Supply" value={claim.days_supply?.toString() || "-"} />
                <DetailRow label="Package Size" value={claim.package_size?.toString() || "-"} />
              </DetailGrid>
            </Section>

            {/* Prescriber Info */}
            <Section title="Prescriber Information" icon={User}>
              <DetailGrid>
                <DetailRow label="Prescriber Name" value={claim.prescriber_name || "-"} />
                <DetailRow label="NPI/DEA" value={claim.prescriber_npi_dea || "-"} />
              </DetailGrid>
            </Section>

            {/* Pharmacy Info */}
            <Section title="Pharmacy Information" icon={Building2}>
              <DetailGrid>
                <DetailRow label="Pharmacy Name" value={claim.pharmacy_name || "-"} />
                <DetailRow label="Chain Pharmacy" value={claim.chain_pharmacy || "-"} />
                <DetailRow label="NABP/NPI" value={claim.pharmacy_nabp_npi?.toString() || "-"} />
              </DetailGrid>
            </Section>

            {/* Insurance Info */}
            <Section title="Insurance Information" icon={FileText}>
              <DetailGrid>
                <DetailRow label="BIN" value={claim.bin?.toString() || "-"} />
                <DetailRow label="PCN" value={claim.pcn || "-"} />
                <DetailRow label="Plan Group" value={claim.plan_group || "-"} />
                <DetailRow label="Secondary BIN" value={claim.secondary_bin?.toString() || "-"} />
                <DetailRow label="Secondary PCN" value={claim.secondary_pcn || "-"} />
                <DetailRow label="Secondary Group" value={claim.secondary_group || "-"} />
                <DetailRow label="Other Coverage Code" value={claim.other_coverage_code || "-"} />
                <DetailRow label="Submission Clarification" value={claim.submission_clarification_code || "-"} />
              </DetailGrid>
            </Section>

            {/* Financial Info */}
            <Section title="Financial Information" icon={DollarSign}>
              <DetailGrid>
                <DetailRow label="Retail Drug Cost" value={formatCurrency(claim.retail_drug_cost)} />
                <DetailRow label="340B Drug Cost" value={formatCurrency(claim.drug_cost_340b)} />
                <DetailRow label="Total Claim Cost" value={formatCurrency(claim.total_claim_cost)} />
                <DetailRow label="Dispensing Fee" value={formatCurrency(claim.dispensing_fee)} />
                <DetailRow label="Patient Pay" value={formatCurrency(claim.patient_pay)} />
                <DetailRow label="Third Party Payment" value={formatCurrency(claim.third_party_payment)} />
                <DetailRow label="Total Payment" value={formatCurrency(claim.total_payment)} highlight />
                <DetailRow label="CE Receivable" value={formatCurrency(claim.ce_receivable)} />
                <DetailRow label="Profit/Loss" value={formatCurrency(claim.profit_or_loss)} />
                <DetailRow label="Trued Up Cost" value={formatCurrency(claim.trued_up_cost)} />
                <DetailRow label="Trued Up Units" value={claim.trued_up_units?.toString() || "-"} />
                <DetailRow label="Trued Up Date" value={claim.trued_up_date ? format(new Date(claim.trued_up_date), "MMM d, yyyy") : "-"} />
              </DetailGrid>
            </Section>

            {/* Covered Entity Info */}
            <Section title="Covered Entity Information" icon={Building2}>
              <DetailGrid>
                <DetailRow label="Entity Name" value={claim.covered_entity_name || "-"} />
                <DetailRow label="OPA ID" value={claim.opaid || "-"} />
              </DetailGrid>
            </Section>

            {/* Reason/Payer Info */}
            <Section title="Payer & Reason" icon={Hash}>
              <DetailGrid>
                <DetailRow label="Reason" value={claim.reason || "-"} />
                <DetailRow label="Sub Reason" value={claim.sub_reason || "-"} />
              </DetailGrid>
            </Section>

            {/* Comments */}
            {claim.comments && (
              <Section title="Comments" icon={FileText}>
                <p className="text-sm text-foreground bg-muted/30 rounded-lg p-3">
                  {claim.comments}
                </p>
              </Section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" />
      <h4 className="font-semibold text-foreground">{title}</h4>
    </div>
    <Separator />
    <div className="bg-muted/30 rounded-lg p-4">
      {children}
    </div>
  </div>
);

const DetailGrid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-2 gap-x-4 gap-y-2">
    {children}
  </div>
);

const DetailRow = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <>
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium ${highlight ? "text-success" : "text-foreground"}`}>{value}</span>
  </>
);

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
