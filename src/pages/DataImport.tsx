import { useState } from "react";
import { Upload, FileSpreadsheet, FileText, CheckCircle2, XCircle, Loader2, Clock, RefreshCw } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { parseClaimsFile, ClaimParseProgress } from "@/utils/claimsParser";
import { processScriptsImport, processClaimsImport, ImportSummary } from "@/utils/etlProcessor";
import { ImportSummaryModal } from "@/components/import/ImportSummaryModal";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// Define ImportLog type locally since it may not be in generated types yet
interface ImportLog {
  id: string;
  user_id: string | null;
  file_name: string;
  file_type: "Scripts" | "Claims";
  file_size: number | null;
  status: "Processing" | "Success" | "Failed" | "Partial";
  records_imported: number | null;
  records_skipped: number | null;
  covered_entities_created: number | null;
  pharmacies_created: number | null;
  prescribers_created: number | null;
  patients_created: number | null;
  drugs_created: number | null;
  locations_created: number | null;
  insurance_plans_created: number | null;
  errors_json: unknown;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

const StatusBadge = ({ status }: { status: ImportLog["status"] }) => {
  const variants = {
    Success: "bg-success/10 text-success border-success/20",
    Failed: "bg-destructive/10 text-destructive border-destructive/20",
    Processing: "bg-warning/10 text-warning border-warning/20",
    Partial: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  };

  const icons = {
    Success: <CheckCircle2 className="h-3.5 w-3.5" />,
    Failed: <XCircle className="h-3.5 w-3.5" />,
    Processing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    Partial: <CheckCircle2 className="h-3.5 w-3.5" />,
  };

  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", variants[status])}>
      {icons[status]}
      {status}
    </Badge>
  );
};

const FileTypeBadge = ({ type }: { type: ImportLog["file_type"] }) => {
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
  const queryClient = useQueryClient();
  const [scriptsFile, setScriptsFile] = useState<File | null>(null);
  const [claimsFile, setClaimsFile] = useState<File | null>(null);
  const [scriptsProgress, setScriptsProgress] = useState<ParseProgress | null>(null);
  const [claimsProgress, setClaimsProgress] = useState<ParseProgress | null>(null);
  const [isProcessingScripts, setIsProcessingScripts] = useState(false);
  const [isProcessingClaims, setIsProcessingClaims] = useState(false);

  // Import summary modal state
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [summaryFileType, setSummaryFileType] = useState<"Scripts" | "Claims">("Scripts");
  const [summaryFileName, setSummaryFileName] = useState("");

  // Fetch import history from database
  const { data: importHistory, isLoading: isLoadingHistory, refetch: refetchHistory } = useQuery({
    queryKey: ["import-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("import_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as ImportLog[];
    },
  });

  // Create import log mutation
  const createImportLog = useMutation({
    mutationFn: async (params: {
      fileName: string;
      fileType: "Scripts" | "Claims";
      fileSize: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await (supabase as any)
        .from("import_logs")
        .insert({
          user_id: userData.user?.id,
          file_name: params.fileName,
          file_type: params.fileType,
          file_size_bytes: params.fileSize,
          status: "Processing",
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as ImportLog;
    },
  });

  // Update import log mutation
  const updateImportLog = useMutation({
    mutationFn: async (params: {
      id: string;
      summary: ImportSummary;
      startedAt: Date;
    }) => {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - params.startedAt.getTime();

      const status: ImportLog["status"] =
        params.summary.errors.length > 0 && params.summary.recordsImported === 0
          ? "Failed"
          : params.summary.errors.length > 0
          ? "Partial"
          : "Success";

      const { error } = await (supabase as any)
        .from("import_logs")
        .update({
          status,
          total_records: params.summary.totalRecords,
          records_imported: params.summary.recordsImported,
          records_skipped: params.summary.recordsSkipped,
          records_failed: params.summary.errors.length,
          covered_entities_created: params.summary.referenceDataCreated.coveredEntities,
          pharmacies_created: params.summary.referenceDataCreated.pharmacies,
          prescribers_created: params.summary.referenceDataCreated.prescribers,
          patients_created: params.summary.referenceDataCreated.patients,
          drugs_created: params.summary.referenceDataCreated.drugs,
          locations_created: params.summary.referenceDataCreated.locations,
          insurance_plans_created: params.summary.referenceDataCreated.insurancePlans,
          errors_json: params.summary.errors.slice(0, 100),
          completed_at: completedAt.toISOString(),
          duration_ms: durationMs,
        })
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });

  // Mark import as failed mutation
  const markImportFailed = useMutation({
    mutationFn: async (params: { id: string; errorMessage: string; startedAt: Date }) => {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - params.startedAt.getTime();

      const { error } = await (supabase as any)
        .from("import_logs")
        .update({
          status: "Failed",
          error_message: params.errorMessage,
          completed_at: completedAt.toISOString(),
          duration_ms: durationMs,
        })
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });

  const handleProcessScripts = async () => {
    if (!scriptsFile) return;

    const fileName = scriptsFile.name;
    const fileSize = scriptsFile.size;
    const startedAt = new Date();
    let importLogId: string | null = null;

    setIsProcessingScripts(true);
    setScriptsProgress(null);

    try {
      // Create import log entry
      const importLog = await createImportLog.mutateAsync({
        fileName,
        fileType: "Scripts",
        fileSize,
      });
      importLogId = importLog.id;

      // Step 1: Parse the Excel file
      setScriptsProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: "reading",
        message: "Parsing Excel file...",
      });

      const prescriptions = await parseScriptsFile(scriptsFile, (progress) => {
        // Scale parsing progress to 0-30%
        setScriptsProgress({
          ...progress,
          percentage: Math.floor(progress.percentage * 0.3),
          message: progress.message,
        });
      });

      if (prescriptions.length === 0) {
        await markImportFailed.mutateAsync({
          id: importLogId,
          errorMessage: "No valid prescription records found in file",
          startedAt,
        });
        toast({
          title: "No Records Found",
          description: "The file contains no valid prescription records to import.",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Process ETL (upsert reference data + insert prescriptions)
      const summary = await processScriptsImport(prescriptions, (message, pct) => {
        // Scale ETL progress to 30-100%
        const scaledPct = 30 + Math.floor(pct * 0.7);
        setScriptsProgress({
          current: 0,
          total: prescriptions.length,
          percentage: scaledPct,
          status: "parsing",
          message,
        });
      });

      // Update import log with results
      await updateImportLog.mutateAsync({
        id: importLogId,
        summary,
        startedAt,
      });

      // Show summary modal
      setImportSummary(summary);
      setSummaryFileType("Scripts");
      setSummaryFileName(fileName);
      setSummaryModalOpen(true);

      setScriptsFile(null);
    } catch (error) {
      if (importLogId) {
        await markImportFailed.mutateAsync({
          id: importLogId,
          errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
          startedAt,
        });
      }
      toast({
        title: "Error Processing Scripts",
        description: error instanceof Error ? error.message : "Failed to process the Excel file",
        variant: "destructive",
      });
    } finally {
      setIsProcessingScripts(false);
      setScriptsProgress(null);
    }
  };

  const handleProcessClaims = async () => {
    if (!claimsFile) return;

    const fileName = claimsFile.name;
    const fileSize = claimsFile.size;
    const startedAt = new Date();
    let importLogId: string | null = null;

    setIsProcessingClaims(true);
    setClaimsProgress(null);

    try {
      // Create import log entry
      const importLog = await createImportLog.mutateAsync({
        fileName,
        fileType: "Claims",
        fileSize,
      });
      importLogId = importLog.id;

      // Step 1: Parse the CSV file
      setClaimsProgress({
        current: 0,
        total: 0,
        percentage: 0,
        status: "reading",
        message: "Parsing CSV file...",
      });

      const claims = await parseClaimsFile(claimsFile, (progress) => {
        // Scale parsing progress to 0-30%
        setClaimsProgress({
          ...progress,
          percentage: Math.floor(progress.percentage * 0.3),
          message: progress.message,
        });
      });

      if (claims.length === 0) {
        await markImportFailed.mutateAsync({
          id: importLogId,
          errorMessage: "No valid claim records found in file",
          startedAt,
        });
        toast({
          title: "No Records Found",
          description: "The file contains no valid claim records to import.",
          variant: "destructive",
        });
        return;
      }

      // Step 2: Process ETL (upsert reference data + insert claims)
      const summary = await processClaimsImport(claims, (message, pct) => {
        // Scale ETL progress to 30-100%
        const scaledPct = 30 + Math.floor(pct * 0.7);
        setClaimsProgress({
          current: 0,
          total: claims.length,
          percentage: scaledPct,
          status: "parsing",
          message,
        });
      });

      // Update import log with results
      await updateImportLog.mutateAsync({
        id: importLogId,
        summary,
        startedAt,
      });

      // Show summary modal
      setImportSummary(summary);
      setSummaryFileType("Claims");
      setSummaryFileName(fileName);
      setSummaryModalOpen(true);

      setClaimsFile(null);
    } catch (error) {
      if (importLogId) {
        await markImportFailed.mutateAsync({
          id: importLogId,
          errorMessage: error instanceof Error ? error.message : "Unknown error occurred",
          startedAt,
        });
      }
      toast({
        title: "Error Processing Claims",
        description: error instanceof Error ? error.message : "Failed to process the CSV file",
        variant: "destructive",
      });
    } finally {
      setIsProcessingClaims(false);
      setClaimsProgress(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "yyyy-MM-dd HH:mm");
    } catch {
      return dateStr;
    }
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                  <Clock className="h-5 w-5 text-secondary-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">Import History</CardTitle>
                  <CardDescription>Recent file imports and their processing status</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchHistory()}
                disabled={isLoadingHistory}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isLoadingHistory && "animate-spin")} />
                Refresh
              </Button>
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
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHistory ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        <p className="mt-2 text-sm text-muted-foreground">Loading import history...</p>
                      </TableCell>
                    </TableRow>
                  ) : importHistory && importHistory.length > 0 ? (
                    importHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {formatDate(item.created_at)}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate" title={item.file_name}>
                          {item.file_name}
                        </TableCell>
                        <TableCell>
                          <FileTypeBadge type={item.file_type} />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {item.records_imported?.toLocaleString() ?? 0}
                          {item.records_skipped && item.records_skipped > 0 && (
                            <span className="text-muted-foreground text-xs ml-1">
                              ({item.records_skipped} skipped)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {item.duration_ms
                            ? item.duration_ms < 1000
                              ? `${item.duration_ms}ms`
                              : `${(item.duration_ms / 1000).toFixed(1)}s`
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={item.status} />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No import history found. Import your first file above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import Summary Modal */}
      <ImportSummaryModal
        open={summaryModalOpen}
        onOpenChange={setSummaryModalOpen}
        summary={importSummary}
        fileType={summaryFileType}
        fileName={summaryFileName}
      />
    </DashboardLayout>
  );
};

export default DataImport;
