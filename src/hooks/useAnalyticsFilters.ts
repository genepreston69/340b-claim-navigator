import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FilterOption {
  value: string;
  label: string;
}

export interface AnalyticsFilters {
  pharmacies: FilterOption[];
  prescribers: FilterOption[];
  locations: FilterOption[];
  isLoading: boolean;
  error: Error | null;
}

export function useAnalyticsFilters(): AnalyticsFilters {
  // Fetch pharmacies
  const {
    data: pharmacies = [],
    isLoading: pharmaciesLoading,
    error: pharmaciesError,
  } = useQuery({
    queryKey: ["filter-pharmacies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, pharmacy_name")
        .order("pharmacy_name");
      if (error) throw error;
      return (data || []).map((p) => ({
        value: p.id,
        label: p.pharmacy_name || "Unknown Pharmacy",
      }));
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch prescribers
  const {
    data: prescribers = [],
    isLoading: prescribersLoading,
    error: prescribersError,
  } = useQuery({
    queryKey: ["filter-prescribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescribers")
        .select("id, first_name, last_name, npi")
        .order("last_name");
      if (error) throw error;
      return (data || []).map((p) => ({
        value: p.id,
        label: `${p.last_name || ""}${p.first_name ? ", " + p.first_name : ""}${p.npi ? " (NPI: " + p.npi + ")" : ""}`.trim() || "Unknown Prescriber",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch locations
  const {
    data: locations = [],
    isLoading: locationsLoading,
    error: locationsError,
  } = useQuery({
    queryKey: ["filter-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, location_name")
        .order("location_name");
      if (error) throw error;
      return (data || []).map((l) => ({
        value: l.id,
        label: l.location_name || "Unknown Location",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = pharmaciesLoading || prescribersLoading || locationsLoading;
  const error = pharmaciesError || prescribersError || locationsError;

  return {
    pharmacies,
    prescribers,
    locations,
    isLoading,
    error: error as Error | null,
  };
}

// Hook for just pharmacy filter (when only pharmacy dimension is needed)
export function usePharmacyFilter() {
  return useQuery({
    queryKey: ["filter-pharmacies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, pharmacy_name")
        .order("pharmacy_name");
      if (error) throw error;
      return (data || []).map((p) => ({
        value: p.id,
        label: p.pharmacy_name || "Unknown Pharmacy",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for just prescriber filter
export function usePrescriberFilter() {
  return useQuery({
    queryKey: ["filter-prescribers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prescribers")
        .select("id, first_name, last_name, npi")
        .order("last_name");
      if (error) throw error;
      return (data || []).map((p) => ({
        value: p.id,
        label: `${p.last_name || ""}${p.first_name ? ", " + p.first_name : ""}${p.npi ? " (NPI: " + p.npi + ")" : ""}`.trim() || "Unknown Prescriber",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

// Hook for just location filter
export function useLocationFilter() {
  return useQuery({
    queryKey: ["filter-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, location_name")
        .order("location_name");
      if (error) throw error;
      return (data || []).map((l) => ({
        value: l.id,
        label: l.location_name || "Unknown Location",
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
}
