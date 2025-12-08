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
      claims: {
        Row: {
          billing_model: string | null
          bin: number | null
          ce_receivable: number | null
          chain_pharmacy: string | null
          claim_captured_date: string | null
          claim_date: string | null
          claim_id: number | null
          claim_sub_type: string | null
          claim_type: string | null
          comments: string | null
          covered_entity_id: string | null
          covered_entity_name: string | null
          created_at: string | null
          date_of_birth: string | null
          date_rx_written: string
          days_supply: number | null
          dispensing_fee: number | null
          drug_cost_340b: number | null
          drug_id: string | null
          drug_indicator: string | null
          drug_name: string | null
          fill_date: string
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          manufacturer_name: string | null
          medical_record_number: string | null
          ndc: number | null
          opaid: string | null
          other_coverage_code: string | null
          package_size: number | null
          patient_id: string | null
          patient_id_external: string | null
          patient_pay: number | null
          pcn: string | null
          pharmacy_id: string | null
          pharmacy_nabp_npi: number | null
          pharmacy_name: string | null
          plan_group: string | null
          prescriber_id: string | null
          prescriber_name: string | null
          prescriber_npi_dea: string | null
          prescription_number: number
          profit_or_loss: number | null
          qty_dispensed: number | null
          reason: string | null
          refill_number: number
          replenishment_status: string | null
          retail_drug_cost: number | null
          secondary_bin: number | null
          secondary_group: string | null
          secondary_pcn: string | null
          sub_reason: string | null
          submission_clarification_code: string | null
          third_party_payment: number | null
          total_claim_cost: number | null
          total_payment: number | null
          transaction_code: string | null
          trued_up_cost: number | null
          trued_up_date: string | null
          trued_up_units: number | null
          updated_at: string | null
        }
        Insert: {
          billing_model?: string | null
          bin?: number | null
          ce_receivable?: number | null
          chain_pharmacy?: string | null
          claim_captured_date?: string | null
          claim_date?: string | null
          claim_id?: number | null
          claim_sub_type?: string | null
          claim_type?: string | null
          comments?: string | null
          covered_entity_id?: string | null
          covered_entity_name?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_rx_written: string
          days_supply?: number | null
          dispensing_fee?: number | null
          drug_cost_340b?: number | null
          drug_id?: string | null
          drug_indicator?: string | null
          drug_name?: string | null
          fill_date: string
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          manufacturer_name?: string | null
          medical_record_number?: string | null
          ndc?: number | null
          opaid?: string | null
          other_coverage_code?: string | null
          package_size?: number | null
          patient_id?: string | null
          patient_id_external?: string | null
          patient_pay?: number | null
          pcn?: string | null
          pharmacy_id?: string | null
          pharmacy_nabp_npi?: number | null
          pharmacy_name?: string | null
          plan_group?: string | null
          prescriber_id?: string | null
          prescriber_name?: string | null
          prescriber_npi_dea?: string | null
          prescription_number: number
          profit_or_loss?: number | null
          qty_dispensed?: number | null
          reason?: string | null
          refill_number: number
          replenishment_status?: string | null
          retail_drug_cost?: number | null
          secondary_bin?: number | null
          secondary_group?: string | null
          secondary_pcn?: string | null
          sub_reason?: string | null
          submission_clarification_code?: string | null
          third_party_payment?: number | null
          total_claim_cost?: number | null
          total_payment?: number | null
          transaction_code?: string | null
          trued_up_cost?: number | null
          trued_up_date?: string | null
          trued_up_units?: number | null
          updated_at?: string | null
        }
        Update: {
          billing_model?: string | null
          bin?: number | null
          ce_receivable?: number | null
          chain_pharmacy?: string | null
          claim_captured_date?: string | null
          claim_date?: string | null
          claim_id?: number | null
          claim_sub_type?: string | null
          claim_type?: string | null
          comments?: string | null
          covered_entity_id?: string | null
          covered_entity_name?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          date_rx_written?: string
          days_supply?: number | null
          dispensing_fee?: number | null
          drug_cost_340b?: number | null
          drug_id?: string | null
          drug_indicator?: string | null
          drug_name?: string | null
          fill_date?: string
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          manufacturer_name?: string | null
          medical_record_number?: string | null
          ndc?: number | null
          opaid?: string | null
          other_coverage_code?: string | null
          package_size?: number | null
          patient_id?: string | null
          patient_id_external?: string | null
          patient_pay?: number | null
          pcn?: string | null
          pharmacy_id?: string | null
          pharmacy_nabp_npi?: number | null
          pharmacy_name?: string | null
          plan_group?: string | null
          prescriber_id?: string | null
          prescriber_name?: string | null
          prescriber_npi_dea?: string | null
          prescription_number?: number
          profit_or_loss?: number | null
          qty_dispensed?: number | null
          reason?: string | null
          refill_number?: number
          replenishment_status?: string | null
          retail_drug_cost?: number | null
          secondary_bin?: number | null
          secondary_group?: string | null
          secondary_pcn?: string | null
          sub_reason?: string | null
          submission_clarification_code?: string | null
          third_party_payment?: number | null
          total_claim_cost?: number | null
          total_payment?: number | null
          transaction_code?: string | null
          trued_up_cost?: number | null
          trued_up_date?: string | null
          trued_up_units?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claims_covered_entity_id_fkey"
            columns: ["covered_entity_id"]
            isOneToOne: false
            referencedRelation: "covered_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_prescriber_id_fkey"
            columns: ["prescriber_id"]
            isOneToOne: false
            referencedRelation: "prescribers"
            referencedColumns: ["id"]
          },
        ]
      }
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
      prescriptions: {
        Row: {
          covered_entity_id: string | null
          created_at: string | null
          days_supply: number | null
          dispense_quantity: number | null
          dispense_quantity_unit: string | null
          drug_id: string | null
          encounter_end_date: string | null
          encounter_fin: number | null
          encounter_start_date: string | null
          frequency: string | null
          id: string
          location_id: string | null
          medication_name: string | null
          ndc_code: string | null
          organization_identifier: string | null
          patient_id: string | null
          patient_mrn: string | null
          pharmacy_id: string | null
          prescribed_date: string
          prescriber_id: string | null
          prescription_identifier: number | null
          primary_insurance_id: string | null
          primary_subscriber_number: string | null
          refills_authorized: number | null
          secondary_insurance_id: string | null
          secondary_subscriber_number: string | null
          source_file: string | null
          status: string | null
          transmission_method: string | null
          updated_at: string | null
        }
        Insert: {
          covered_entity_id?: string | null
          created_at?: string | null
          days_supply?: number | null
          dispense_quantity?: number | null
          dispense_quantity_unit?: string | null
          drug_id?: string | null
          encounter_end_date?: string | null
          encounter_fin?: number | null
          encounter_start_date?: string | null
          frequency?: string | null
          id?: string
          location_id?: string | null
          medication_name?: string | null
          ndc_code?: string | null
          organization_identifier?: string | null
          patient_id?: string | null
          patient_mrn?: string | null
          pharmacy_id?: string | null
          prescribed_date: string
          prescriber_id?: string | null
          prescription_identifier?: number | null
          primary_insurance_id?: string | null
          primary_subscriber_number?: string | null
          refills_authorized?: number | null
          secondary_insurance_id?: string | null
          secondary_subscriber_number?: string | null
          source_file?: string | null
          status?: string | null
          transmission_method?: string | null
          updated_at?: string | null
        }
        Update: {
          covered_entity_id?: string | null
          created_at?: string | null
          days_supply?: number | null
          dispense_quantity?: number | null
          dispense_quantity_unit?: string | null
          drug_id?: string | null
          encounter_end_date?: string | null
          encounter_fin?: number | null
          encounter_start_date?: string | null
          frequency?: string | null
          id?: string
          location_id?: string | null
          medication_name?: string | null
          ndc_code?: string | null
          organization_identifier?: string | null
          patient_id?: string | null
          patient_mrn?: string | null
          pharmacy_id?: string | null
          prescribed_date?: string
          prescriber_id?: string | null
          prescription_identifier?: number | null
          primary_insurance_id?: string | null
          primary_subscriber_number?: string | null
          refills_authorized?: number | null
          secondary_insurance_id?: string | null
          secondary_subscriber_number?: string | null
          source_file?: string | null
          status?: string | null
          transmission_method?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_covered_entity_id_fkey"
            columns: ["covered_entity_id"]
            isOneToOne: false
            referencedRelation: "covered_entities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drugs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_pharmacy_id_fkey"
            columns: ["pharmacy_id"]
            isOneToOne: false
            referencedRelation: "pharmacies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_prescriber_id_fkey"
            columns: ["prescriber_id"]
            isOneToOne: false
            referencedRelation: "prescribers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_primary_insurance_id_fkey"
            columns: ["primary_insurance_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_secondary_insurance_id_fkey"
            columns: ["secondary_insurance_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      adjudication_status: {
        Row: {
          adjudication_status: string | null
          days_supply: number | null
          dispense_quantity: number | null
          fills_adjudicated: number | null
          fills_remaining: number | null
          last_fill_date: string | null
          medication_name: string | null
          ndc_code: string | null
          patient_mrn: string | null
          patient_name: string | null
          pharmacy_name: string | null
          prescribed_date: string | null
          prescriber_name: string | null
          prescription_id: string | null
          prescription_identifier: number | null
          prescription_status: string | null
          refills_authorized: number | null
          total_340b_cost: number | null
          total_payments: number | null
        }
        Relationships: []
      }
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
