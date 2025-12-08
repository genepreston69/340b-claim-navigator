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

const mockScripts = [
  {
    id: "RX-2024-001",
    patient: "John D.",
    drug: "Metformin 500mg",
    ndc: "00093-7212-01",
    quantity: 90,
    fillDate: "2024-01-15",
    status: "matched",
  },
  {
    id: "RX-2024-002",
    patient: "Sarah M.",
    drug: "Lisinopril 10mg",
    ndc: "00093-7310-01",
    quantity: 30,
    fillDate: "2024-01-15",
    status: "pending",
  },
  {
    id: "RX-2024-003",
    patient: "Robert K.",
    drug: "Atorvastatin 20mg",
    ndc: "00093-5057-01",
    quantity: 30,
    fillDate: "2024-01-14",
    status: "matched",
  },
  {
    id: "RX-2024-004",
    patient: "Emily R.",
    drug: "Omeprazole 20mg",
    ndc: "00093-5182-01",
    quantity: 30,
    fillDate: "2024-01-14",
    status: "unmatched",
  },
  {
    id: "RX-2024-005",
    patient: "Michael T.",
    drug: "Amlodipine 5mg",
    ndc: "00093-3162-01",
    quantity: 30,
    fillDate: "2024-01-13",
    status: "matched",
  },
];

const statusStyles = {
  matched: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  unmatched: "bg-destructive/10 text-destructive border-destructive/20",
};

const Scripts = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Scripts</h2>
            <p className="text-muted-foreground">
              Manage and track prescription scripts
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Import Scripts
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by script ID, patient, or drug..."
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

        {/* Scripts Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Scripts</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Script ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Drug</TableHead>
                  <TableHead>NDC</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Fill Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockScripts.map((script) => (
                  <TableRow key={script.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium">{script.id}</TableCell>
                    <TableCell>{script.patient}</TableCell>
                    <TableCell>{script.drug}</TableCell>
                    <TableCell className="font-mono text-sm">{script.ndc}</TableCell>
                    <TableCell>{script.quantity}</TableCell>
                    <TableCell>{script.fillDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusStyles[script.status as keyof typeof statusStyles]}
                      >
                        {script.status}
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

export default Scripts;
