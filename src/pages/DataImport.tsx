import { useState } from "react";
import { Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { parseScriptsFile, ParseProgress } from "@/utils/scriptsParser";
import { useToast } from "@/hooks/use-toast";
interface ImportHistoryItem {
  id: string;
  importDate: string;
  fileName: string;
  fileType: "Scripts" | "Claims";
  recordsProcessed: number;
  status: "Success" | "Failed" | "Processing";
}

// Mock import history data
const mockImportHistory: ImportHistoryItem[] = [
  {
    id: "1",
    importDate: "2024-12-08 14:30",
    fileName: "combinedscript_dec2024.xlsx",
    fileType: "Scripts",
    recordsProcessed: 1247,
    status: "Success",
  },
  {
    id: "2",
    importDate: "2024-12-08 14:25",
    fileName: "ClaimReports_Q4_2024.csv",
    fileType: "Claims",
    recordsProcessed: 3892,
    status: "Success",
  },
  {
    id: "3",
    importDate: "2024-12-07 09:15",
    fileName: "combinedscript_nov2024.xlsx",
    fileType: "Scripts",
    recordsProcessed: 0,
    status: "Failed",
  },
  {
    id: "4",
    importDate: "2024-12-06 16:45",
    fileName: "ClaimReports_Nov_2024.csv",
    fileType: "Claims",
    recordsProcessed: 2156,
    status: "Success",
  },
];

const StatusBadge = ({ status }: { status: ImportHistoryItem["status"] }) => {
  const variants = {
    Success: "bg-success/10 text-success border-success/20",
    Failed: "bg-destructive/10 text-destructive border-destructive/20",
    Processing: "bg-warning/10 text-warning border-warning/20",
  };

  const icons = {
    Success: <CheckCircle2 className="h-3.5 w-3.5" />,
    Failed: <XCircle className="h-3.5 w-3.5" />,
    Processing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  };

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", variants[status])}>
      {icons[status]}
      {status}
    </Badge>
  );
};

const FileTypeBadge = ({ type }: { type: ImportHistoryItem["fileType"] }) => {
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "gap-1.5",
        type === "Scripts" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
      )}
    >
      {type === "Scripts" ? (
        <FileSpreadsheet className="h-3.5 w-3.5" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      {type}
    </Badge>
  );
};

interface FileUploadSectionProps {
  title: string;
  description: string;
  label: string;
  accept: string;
  icon: React.ReactNode;
  buttonText: string;
  isProcessing: boolean;
  progress: ParseProgress | null;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onProcess: () => void;
}

const FileUploadSection = ({
  title,
  description,
  label,
  accept,
  icon,
  buttonText,
  isProcessing,
  progress,
  selectedFile,
  onFileSelect,
  onProcess,
}: FileUploadSectionProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <Card className="flex-1">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed p-6 transition-all duration-200",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50",
            isProcessing && "pointer-events-none opacity-50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            disabled={isProcessing}
          />
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">{label}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag and drop or click to browse
              </p>
            </div>
          </div>
        </div>

        {selectedFile && !isProcessing && (
          <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-background">
              {accept.includes("xlsx") ? (
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              ) : (
                <FileText className="h-5 w-5 text-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-sm">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
          </div>
        )}

        {/* Progress indicator */}
        {isProcessing && progress && (
          <div className="space-y-3 rounded-lg bg-muted/50 p-4">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{progress.message}</p>
                {progress.total > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {progress.current.toLocaleString()} of {progress.total.toLocaleString()} rows
                  </p>
                )}
              </div>
              <span className="text-sm font-medium text-primary">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} className="h-2" />
          </div>
        )}

        <Button
          onClick={onProcess}
          disabled={!selectedFile || isProcessing}
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            buttonText
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

const DataImport = () => {
  const { toast } = useToast();
  const [scriptsFile, setScriptsFile] = useState<File | null>(null);
  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [scriptsProgress, setScriptsProgress] = useState<ParseProgress | null>(null);
  const [claimsProgress, setClaimsProgress] = useState<ParseProgress | null>(null);
  const [isProcessingScripts, setIsProcessingScripts] = useState(false);
  const [isProcessingClaims, setIsProcessingClaims] = useState(false);

  const handleProcessScripts = async () => {
    if (!scriptsFile) return;

    setIsProcessingScripts(true);
    setScriptsProgress(null);

    try {
      const prescriptions = await parseScriptsFile(scriptsFile, setScriptsProgress);
      
      toast({
        title: "Scripts Parsed Successfully",
        description: `Parsed ${prescriptions.length.toLocaleString()} prescription records from ${scriptsFile.name}`,
      });

      console.log("Parsed prescriptions:", prescriptions);
      // TODO: Save to database
      
      setScriptsFile(null);
    } catch (error) {
      toast({
        title: "Error Parsing Scripts",
        description: error instanceof Error ? error.message : "Failed to parse the Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessingScripts(false);
    }
  };

  const handleProcessClaims = () => {
    // TODO: Implement claims parsing
    console.log("Processing claims...");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Data Import</h1>
          <p className="mt-1 text-muted-foreground">
            Import prescription scripts and claims data from external sources
          </p>
        </div>

        {/* Upload Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          <FileUploadSection
            title="Scripts Import"
            description="Upload the combinedscript.xlsx file containing prescription data from the EHR"
            label="Upload Combined Scripts File (Excel)"
            accept=".xlsx,.xls"
            icon={<FileSpreadsheet className="h-5 w-5" />}
            buttonText="Process Scripts"
            isProcessing={isProcessingScripts}
            progress={scriptsProgress}
            selectedFile={scriptsFile}
            onFileSelect={setScriptsFile}
            onProcess={handleProcessScripts}
          />

          <FileUploadSection
            title="Claims Import"
            description="Upload the ClaimReports CSV file from your 340B administrator"
            label="Upload Claims Report (CSV)"
            accept=".csv"
            icon={<FileText className="h-5 w-5" />}
            buttonText="Process Claims"
            isProcessing={isProcessingClaims}
            progress={claimsProgress}
            selectedFile={claimsFile}
            onFileSelect={setClaimsFile}
            onProcess={handleProcessClaims}
          />
        </div>

        {/* Import History */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Clock className="h-5 w-5 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-lg">Import History</CardTitle>
                <CardDescription>Recent file imports and their processing status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Import Date</TableHead>
                    <TableHead>File Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Records</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockImportHistory.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {item.importDate}
                      </TableCell>
                      <TableCell className="font-medium">{item.fileName}</TableCell>
                      <TableCell>
                        <FileTypeBadge type={item.fileType} />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.recordsProcessed.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default DataImport;
