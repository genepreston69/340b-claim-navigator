import { Plus, Search, Filter, Download } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const mockClaims = [
  {
    id: "CL-2024-1001",
    scriptId: "RX-2024-001",
    payer: "CVS Caremark",
    amount: 245.67,
    submittedDate: "2024-01-16",
    status: "adjudicated",
  },
  {
    id: "CL-2024-1002",
    scriptId: "RX-2024-002",
    payer: "Express Scripts",
    amount: 89.99,
    submittedDate: "2024-01-16",
    status: "pending",
  },
  {
    id: "CL-2024-1003",
    scriptId: "RX-2024-003",
    payer: "OptumRx",
    amount: 156.32,
    submittedDate: "2024-01-15",
    status: "adjudicated",
  },
  {
    id: "CL-2024-1004",
    scriptId: "RX-2024-004",
    payer: "Cigna",
    amount: 78.45,
    submittedDate: "2024-01-15",
    status: "rejected",
  },
  {
    id: "CL-2024-1005",
    scriptId: "RX-2024-005",
    payer: "Humana",
    amount: 312.00,
    submittedDate: "2024-01-14",
    status: "under_review",
  },
];

const statusStyles = {
  adjudicated: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  under_review: "bg-info/10 text-info border-info/20",
};

const statusLabels = {
  adjudicated: "Adjudicated",
  pending: "Pending",
  rejected: "Rejected",
  under_review: "Under Review",
};

const Claims = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Claims</h2>
            <p className="text-muted-foreground">
              Track and manage submitted claims
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Submit Claim
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by claim ID, script ID, or payer..."
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filters
                </Button>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Claims Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Claims</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Claim ID</TableHead>
                  <TableHead>Script ID</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockClaims.map((claim) => (
                  <TableRow key={claim.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{claim.id}</TableCell>
                    <TableCell className="font-mono text-sm">{claim.scriptId}</TableCell>
                    <TableCell>{claim.payer}</TableCell>
                    <TableCell>${claim.amount.toFixed(2)}</TableCell>
                    <TableCell>{claim.submittedDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[claim.status as keyof typeof statusStyles]}
                      >
                        {statusLabels[claim.status as keyof typeof statusLabels]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Claims;
