import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

type Claim = Tables<"claims">;

interface RecentClaimsTableProps {
  claims: Claim[];
  isLoading?: boolean;
}

export function RecentClaimsTable({ claims, isLoading }: RecentClaimsTableProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold">Recent Claims</CardTitle>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate("/claims")}>
          View All
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[250px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : claims.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No recent claims
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>Pharmacy</TableHead>
                  <TableHead className="text-right">Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((claim) => (
                  <TableRow key={claim.id} className="hover:bg-muted/50">
                    <TableCell className="text-sm">
                      {claim.fill_date ? format(new Date(claim.fill_date), "MMM d") : "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[150px] truncate">
                      {claim.drug_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm max-w-[120px] truncate">
                      {claim.pharmacy_name || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium text-success">
                      ${(claim.total_payment || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
