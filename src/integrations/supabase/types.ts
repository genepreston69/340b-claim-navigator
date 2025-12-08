export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      covered_entities: {
        Row: {
          created_at: string | null
          entity_name: string
          id: string
          opaid: string
          organization_identifier: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          entity_name: string
          id?: string
          opaid: string
          organization_identifier?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          entity_name?: string
          id?: string
          opaid?: string
          organization_identifier?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      drugs: {
        Row: {
          created_at: string | null
          dose: string | null
          dose_units: string | null
          drug_form: string | null
          drug_indicator: string | null
          drug_name: string | null
          id: string
          manufacturer_name: string | null
          ndc_code: string
          package_size: number | null
          route_of_administration: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dose?: string | null
          dose_units?: string | null
          drug_form?: string | null
          drug_indicator?: string | null
          drug_name?: string | null
          id?: string
          manufacturer_name?: string | null
          ndc_code: string
          package_size?: number | null
          route_of_administration?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dose?: string | null
          dose_units?: string | null
          drug_form?: string | null
          drug_indicator?: string | null
          drug_name?: string | null
          id?: string
          manufacturer_name?: string | null
          ndc_code?: string
          package_size?: number | null
          route_of_administration?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      insurance_plans: {
        Row: {
          bin: string | null
          created_at: string | null
          id: string
          insurance_company: string
          is_medicaid: boolean | null
          is_primary: boolean | null
          pcn: string | null
          plan_group: string | null
          updated_at: string | null
        }
        Insert: {
          bin?: string | null
          created_at?: string | null
          id?: string
          insurance_company: string
          is_medicaid?: boolean | null
          is_primary?: boolean | null
          pcn?: string | null
          plan_group?: string | null
          updated_at?: string | null
        }
        Update: {
          bin?: string | null
          created_at?: string | null
          id?: string
          insurance_company?: string
          is_medicaid?: boolean | null
          is_primary?: boolean | null
          pcn?: string | null
          plan_group?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          covered_entity_id: string | null
          created_at: string | null
          id: string
          location_identifier: string | null
          location_name: string
          updated_at: string | null
        }
        Insert: {
          covered_entity_id?: string | null
          created_at?: string | null
          id?: string
          location_identifier?: string | null
          location_name: string
          updated_at?: string | null
        }
        Update: {
          covered_entity_id?: string | null
          created_at?: string | null
          id?: string
          location_identifier?: string | null
          location_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_covered_entity_id_fkey"
            columns: ["covered_entity_id"]
            isOneToOne: false
            referencedRelation: "covered_entities"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          created_at: string | null
          date_of_birth: string | null
          first_name: string
          gender: string | null
          id: string
          last_name: string
          middle_name: string | null
          mrn: string | null
          patient_id_external: string | null
          suffix: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name: string
          gender?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          mrn?: string | null
          patient_id_external?: string | null
          suffix?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date_of_birth?: string | null
          first_name?: string
          gender?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          mrn?: string | null
          patient_id_external?: string | null
          suffix?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pharmacies: {
        Row: {
          chain_pharmacy: string | null
          created_at: string | null
          id: string
          nabp_number: number | null
          npi_number: number | null
          pharmacy_name: string
          updated_at: string | null
        }
        Insert: {
          chain_pharmacy?: string | null
          created_at?: string | null
          id?: string
          nabp_number?: number | null
          npi_number?: number | null
          pharmacy_name: string
          updated_at?: string | null
        }
        Update: {
          chain_pharmacy?: string | null
          created_at?: string | null
          id?: string
          nabp_number?: number | null
          npi_number?: number | null
          pharmacy_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      prescribers: {
        Row: {
          created_at: string | null
          dea_number: string | null
          first_name: string | null
          id: string
          last_name: string
          middle_name: string | null
          npi: number | null
          suffix: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          dea_number?: string | null
          first_name?: string | null
          id?: string
          last_name: string
          middle_name?: string | null
          npi?: number | null
          suffix?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          dea_number?: string | null
          first_name?: string | null
          id?: string
          last_name?: string
          middle_name?: string | null
          npi?: number | null
          suffix?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
