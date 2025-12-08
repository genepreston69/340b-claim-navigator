import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Scripts from "./pages/Scripts";
import Claims from "./pages/Claims";
import Adjudication from "./pages/Adjudication";
import Settings from "./pages/Settings";
import DataImport from "./pages/DataImport";
import Reports from "./pages/Reports";
import UserManagement from "./pages/UserManagement";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import PrescriptionAdherence from "./pages/PrescriptionAdherence";
import PhysicianCaptureRates from "./pages/PhysicianCaptureRates";
import DrugPharmacyComparison from "./pages/DrugPharmacyComparison";
import ContractCompliance from "./pages/ContractCompliance";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scripts"
              element={
                <ProtectedRoute requireAdmin>
                  <Scripts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/claims"
              element={
                <ProtectedRoute requireAdmin>
                  <Claims />
                </ProtectedRoute>
              }
            />
            <Route
              path="/adjudication"
              element={
                <ProtectedRoute requireAdmin>
                  <Adjudication />
                </ProtectedRoute>
              }
            />
            <Route
              path="/data-import"
              element={
                <ProtectedRoute requireAdmin>
                  <DataImport />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute requireAnalyticsAccess>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prescription-adherence"
              element={
                <ProtectedRoute requireAnalyticsAccess>
                  <PrescriptionAdherence />
                </ProtectedRoute>
              }
            />
            <Route
              path="/physician-capture-rates"
              element={
                <ProtectedRoute requireAnalyticsAccess>
                  <PhysicianCaptureRates />
                </ProtectedRoute>
              }
            />
            <Route
              path="/drug-pharmacy-comparison"
              element={
                <ProtectedRoute requireAnalyticsAccess>
                  <DrugPharmacyComparison />
                </ProtectedRoute>
              }
            />
            <Route
              path="/contract-compliance"
              element={
                <ProtectedRoute requireAnalyticsAccess>
                  <ContractCompliance />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute requireAdmin>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute requireAdmin>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
