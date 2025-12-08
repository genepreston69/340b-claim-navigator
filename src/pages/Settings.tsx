import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Building2, Settings2, Database, Info, Trash2, Download, ExternalLink, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AppSettings {
  coveredEntityName: string;
  opaid: string;
  organizationIdentifier: string;
  defaultDateRangeDays: number;
  staleScriptThreshold: number;
  patientMatchMethod: "mrn_only" | "mrn_name" | "name_dob";
}

const defaultSettings: AppSettings = {
  coveredEntityName: "",
  opaid: "",
  organizationIdentifier: "",
  defaultDateRangeDays: 90,
  staleScriptThreshold: 14,
  patientMatchMethod: "mrn_only",
};

const Settings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Fetch covered entity data
  const { data: coveredEntity } = useQuery({
    queryKey: ["covered-entity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("covered_entities")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch last import dates
  const { data: lastScriptImport } = useQuery({
    queryKey: ["last-script-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescriptions")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.created_at;
    },
  });

  const { data: lastClaimsImport } = useQuery({
    queryKey: ["last-claims-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("claims")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.created_at;
    },
  });

  // Check database connection
  const { data: dbConnected, isLoading: dbCheckLoading } = useQuery({
    queryKey: ["db-connection"],
    queryFn: async () => {
      try {
        const { error } = await supabase.from("covered_entities").select("id").limit(1);
        return !error;
      } catch {
        return false;
      }
    },
    refetchInterval: 30000, // Check every 30 seconds
  });

  // Update settings when covered entity loads
  useEffect(() => {
    if (coveredEntity) {
      setSettings((prev) => ({
        ...prev,
        coveredEntityName: coveredEntity.entity_name || "",
        opaid: coveredEntity.opaid || "",
        organizationIdentifier: coveredEntity.organization_identifier || "",
      }));
    }
  }, [coveredEntity]);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("app-settings");
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSettings((prev) => ({
        ...prev,
        defaultDateRangeDays: parsed.defaultDateRangeDays ?? prev.defaultDateRangeDays,
        staleScriptThreshold: parsed.staleScriptThreshold ?? prev.staleScriptThreshold,
        patientMatchMethod: parsed.patientMatchMethod ?? prev.patientMatchMethod,
      }));
    }
  }, []);

  // Save organization settings
  const saveOrgSettings = useMutation({
    mutationFn: async () => {
      if (coveredEntity) {
        const { error } = await supabase
          .from("covered_entities")
          .update({
            entity_name: settings.coveredEntityName,
            organization_identifier: settings.organizationIdentifier,
          })
          .eq("id", coveredEntity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("covered_entities").insert({
          entity_name: settings.coveredEntityName,
          opaid: settings.opaid || "PENDING",
          organization_identifier: settings.organizationIdentifier,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["covered-entity"] });
      toast({
        title: "Settings saved",
        description: "Organization settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Save import settings to localStorage
  const saveImportSettings = () => {
    localStorage.setItem(
      "app-settings",
      JSON.stringify({
        defaultDateRangeDays: settings.defaultDateRangeDays,
        staleScriptThreshold: settings.staleScriptThreshold,
        patientMatchMethod: settings.patientMatchMethod,
      })
    );
    toast({
      title: "Settings saved",
      description: "Import settings have been updated.",
    });
  };

  // Clear all data
  const clearAllData = async () => {
    setIsClearing(true);
    try {
      // Clear in order to avoid foreign key issues
      await supabase.from("claims").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("prescriptions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("patients").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("drugs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("prescribers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("pharmacies").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("locations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await supabase.from("insurance_plans").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      queryClient.invalidateQueries();
      toast({
        title: "Data cleared",
        description: "All data has been removed from the system.",
      });
    } catch (error: any) {
      toast({
        title: "Error clearing data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

  // Export all data
  const exportAllData = async () => {
    setIsExporting(true);
    try {
      const csvFiles: { name: string; content: string }[] = [];

      // Fetch each table separately
      const { data: claimsData } = await supabase.from("claims").select("*");
      const { data: prescriptionsData } = await supabase.from("prescriptions").select("*");
      const { data: patientsData } = await supabase.from("patients").select("*");
      const { data: drugsData } = await supabase.from("drugs").select("*");
      const { data: prescribersData } = await supabase.from("prescribers").select("*");
      const { data: pharmaciesData } = await supabase.from("pharmacies").select("*");

      const tableData = [
        { name: "claims", data: claimsData },
        { name: "prescriptions", data: prescriptionsData },
        { name: "patients", data: patientsData },
        { name: "drugs", data: drugsData },
        { name: "prescribers", data: prescribersData },
        { name: "pharmacies", data: pharmaciesData },
      ];

      for (const table of tableData) {
        if (table.data && table.data.length > 0) {
          const headers = Object.keys(table.data[0]);
          const csvContent = [
            headers.join(","),
            ...table.data.map((row) =>
              headers
                .map((header) => {
                  const value = (row as Record<string, unknown>)[header];
                  if (value === null) return "";
                  if (typeof value === "string" && value.includes(",")) {
                    return `"${value}"`;
                  }
                  return String(value);
                })
                .join(",")
            ),
          ].join("\n");

          csvFiles.push({ name: `${table.name}.csv`, content: csvContent });
        }
      }

      // Download each file
      for (const file of csvFiles) {
        const blob = new Blob([file.content], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = file.name;
        link.click();
      }

      toast({
        title: "Export complete",
        description: `Exported ${csvFiles.length} data files.`,
      });
    } catch (error: any) {
      toast({
        title: "Error exporting data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings</h2>
          <p className="text-muted-foreground">
            Configure your 340B Claims Tracker application
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Section 1: Organization Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle>Organization Settings</CardTitle>
              </div>
              <CardDescription>
                Configure your covered entity information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entityName">Covered Entity Name</Label>
                <Input
                  id="entityName"
                  value={settings.coveredEntityName}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, coveredEntityName: e.target.value }))
                  }
                  placeholder="Enter covered entity name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="opaid">OPAID</Label>
                <Input
                  id="opaid"
                  value={settings.opaid}
                  disabled
                  placeholder="Populated from import"
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Automatically set from first data import
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgId">Organization Identifier</Label>
                <Input
                  id="orgId"
                  value={settings.organizationIdentifier}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, organizationIdentifier: e.target.value }))
                  }
                  placeholder="Enter organization identifier"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => saveOrgSettings.mutate()}
                disabled={saveOrgSettings.isPending}
              >
                {saveOrgSettings.isPending ? "Saving..." : "Save Organization Settings"}
              </Button>
            </CardContent>
          </Card>

          {/* Section 2: Import Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" />
                <CardTitle>Import Settings</CardTitle>
              </div>
              <CardDescription>
                Configure data import and matching preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dateRange">Default Date Range (days)</Label>
                <Input
                  id="dateRange"
                  type="number"
                  min={7}
                  max={365}
                  value={settings.defaultDateRangeDays}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      defaultDateRangeDays: parseInt(e.target.value) || 90,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Default lookback period for adjudication checks
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staleThreshold">Stale Script Alert Threshold (days)</Label>
                <Input
                  id="staleThreshold"
                  type="number"
                  min={1}
                  max={90}
                  value={settings.staleScriptThreshold}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      staleScriptThreshold: parseInt(e.target.value) || 14,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Scripts unfilled beyond this threshold trigger alerts
                </p>
              </div>
              <div className="space-y-2">
                <Label>Auto-Match Patients By</Label>
                <Select
                  value={settings.patientMatchMethod}
                  onValueChange={(value: "mrn_only" | "mrn_name" | "name_dob") =>
                    setSettings((prev) => ({ ...prev, patientMatchMethod: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mrn_only">MRN Only</SelectItem>
                    <SelectItem value="mrn_name">MRN + Name</SelectItem>
                    <SelectItem value="name_dob">Name + Date of Birth</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Method used to match patients during import
                </p>
              </div>
              <Button className="w-full" onClick={saveImportSettings}>
                Save Import Settings
              </Button>
            </CardContent>
          </Card>

          {/* Section 3: Data Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <CardTitle>Data Management</CardTitle>
              </div>
              <CardDescription>
                Export or clear your application data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <h4 className="font-medium text-sm">Last Import Dates</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Scripts:</span>
                    <p className="font-medium">
                      {lastScriptImport
                        ? format(new Date(lastScriptImport), "MMM d, yyyy h:mm a")
                        : "Never imported"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Claims:</span>
                    <p className="font-medium">
                      {lastClaimsImport
                        ? format(new Date(lastClaimsImport), "MMM d, yyyy h:mm a")
                        : "Never imported"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={exportAllData}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isExporting ? "Exporting..." : "Export All Data"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear All Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all claims,
                        prescriptions, patients, drugs, and other data from the system.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={clearAllData}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={isClearing}
                      >
                        {isClearing ? "Clearing..." : "Yes, delete all data"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: About */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle>About</CardTitle>
              </div>
              <CardDescription>
                Application information and status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">App Version</span>
                  <span className="font-mono text-sm font-medium">1.0.0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Database Status</span>
                  <div className="flex items-center gap-2">
                    {dbCheckLoading ? (
                      <div className="h-3 w-3 rounded-full bg-yellow-500 animate-pulse" />
                    ) : dbConnected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-600">Connected</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm font-medium text-red-600">Disconnected</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Build Date</span>
                  <span className="font-mono text-sm">{format(new Date(), "yyyy-MM-dd")}</span>
                </div>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <a
                  href="https://docs.lovable.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Documentation
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Settings;
