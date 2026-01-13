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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          created_at: string | null
          id: string
          line_approver_id: string
          line_staff_id: string
          pin_version: number
          promptpay_id: string | null
          staff_pin_hash: string
          updated_at: string | null
          admin_username: string | null
          admin_password_hash: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          line_approver_id?: string
          line_staff_id?: string
          pin_version?: number
          promptpay_id?: string | null
          staff_pin_hash: string
          updated_at?: string | null
          admin_username?: string | null
          admin_password_hash?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          line_approver_id?: string
          line_staff_id?: string
          pin_version?: number
          promptpay_id?: string | null
          staff_pin_hash?: string
          updated_at?: string | null
          admin_username?: string | null
          admin_password_hash?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_code: string
          created_at: string | null
          name: string
          updated_at: string | null
        }
        Insert: {
          category_code: string
          created_at?: string | null
          name: string
          updated_at?: string | null
        }
        Update: {
          category_code?: string
          created_at?: string | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      category_option_groups: {
        Row: {
          category_code: string
          group_code: string
        }
        Insert: {
          category_code: string
          group_code: string
        }
        Update: {
          category_code?: string
          group_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_option_groups_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_code"]
          },
          {
            foreignKeyName: "category_option_groups_group_code_fkey"
            columns: ["group_code"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["group_code"]
          },
        ]
      }
      category_schedules: {
        Row: {
          category_code: string
          day_of_week: number
          end_time: string
          id: number
          start_time: string
        }
        Insert: {
          category_code: string
          day_of_week: number
          end_time: string
          id?: number
          start_time: string
        }
        Update: {
          category_code?: string
          day_of_week?: number
          end_time?: string
          id?: number
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_schedules_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_code"]
          },
        ]
      }
      menu_item_categories: {
        Row: {
          category_code: string
          menu_code: string
          sort_order: number
        }
        Insert: {
          category_code: string
          menu_code: string
          sort_order?: number
        }
        Update: {
          category_code?: string
          menu_code?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_categories_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_code"]
          },
          {
            foreignKeyName: "menu_item_categories_menu_code_fkey"
            columns: ["menu_code"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["menu_code"]
          },
        ]
      }
      menu_items: {
        Row: {
          barcode: string | null
          category_code: string
          created_at: string | null
          description: string | null
          image_focus_y_1x1: number | null
          image_focus_y_4x3: number | null
          image_url: string | null
          is_active: boolean
          menu_code: string
          name_en: string | null
          name_th: string
          price: number
          promo_label: string | null
          promo_percent: number | null
          promo_price: number | null
          updated_at: string | null
        }
        Insert: {
          barcode?: string | null
          category_code: string
          created_at?: string | null
          description?: string | null
          image_focus_y_1x1?: number | null
          image_focus_y_4x3?: number | null
          image_url?: string | null
          is_active?: boolean
          menu_code: string
          name_en?: string | null
          name_th: string
          price: number
          promo_label?: string | null
          promo_percent?: number | null
          promo_price?: number | null
          updated_at?: string | null
        }
        Update: {
          barcode?: string | null
          category_code?: string
          created_at?: string | null
          description?: string | null
          image_focus_y_1x1?: number | null
          image_focus_y_4x3?: number | null
          image_url?: string | null
          is_active?: boolean
          menu_code?: string
          name_en?: string | null
          name_th?: string
          price?: number
          promo_label?: string | null
          promo_percent?: number | null
          promo_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_category_code_fkey"
            columns: ["category_code"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["category_code"]
          },
        ]
      }
      menu_option_groups: {
        Row: {
          created_at: string | null
          group_code: string
          menu_code: string
        }
        Insert: {
          created_at?: string | null
          group_code: string
          menu_code: string
        }
        Update: {
          created_at?: string | null
          group_code?: string
          menu_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_option_groups_group_code_fkey"
            columns: ["group_code"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["group_code"]
          },
          {
            foreignKeyName: "menu_option_groups_menu_code_fkey"
            columns: ["menu_code"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["menu_code"]
          },
        ]
      }
      option_groups: {
        Row: {
          created_at: string | null
          group_code: string
          group_name: string
          is_required: boolean
          max_select: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_code: string
          group_name: string
          is_required?: boolean
          max_select?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_code?: string
          group_name?: string
          is_required?: boolean
          max_select?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      options: {
        Row: {
          created_at: string | null
          group_code: string
          option_code: string
          option_name: string
          price_delta: number
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          group_code: string
          option_code: string
          option_name: string
          price_delta?: number
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          group_code?: string
          option_code?: string
          option_name?: string
          price_delta?: number
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "options_group_code_fkey"
            columns: ["group_code"]
            isOneToOne: false
            referencedRelation: "option_groups"
            referencedColumns: ["group_code"]
          },
        ]
      }
      order_items: {
        Row: {
          base_price: number
          created_at: string | null
          final_price: number
          id: string
          menu_item_id: string
          name_en: string
          name_th: string
          note: string | null
          order_id: string
          qty: number
          selected_options_json: Json | null
        }
        Insert: {
          base_price: number
          created_at?: string | null
          final_price: number
          id?: string
          menu_item_id: string
          name_en: string
          name_th: string
          note?: string | null
          order_id: string
          qty: number
          selected_options_json?: Json | null
        }
        Update: {
          base_price?: number
          created_at?: string | null
          final_price?: number
          id?: string
          menu_item_id?: string
          name_en?: string
          name_th?: string
          note?: string | null
          order_id?: string
          qty?: number
          selected_options_json?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string
          line_user_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          line_user_id: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          line_user_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          adjustment_note: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          customer_id: string | null
          customer_line_display_name: string | null
          customer_line_user_id: string | null
          customer_name: string
          customer_note: string | null
          customer_phone: string
          id: string
          invoice_address: string | null
          invoice_buyer_phone: string | null
          invoice_company_name: string | null
          invoice_requested: boolean | null
          invoice_tax_id: string | null
          order_number: string
          pickup_time: string | null
          pickup_type: string
          rejected_at: string | null
          rejected_reason: string | null
          slip_notified_at: string | null
          slip_url: string | null
          status: string
          subtotal_amount_dec: number | null
          total_amount_dec: number | null
          vat_amount_dec: number | null
          vat_rate: number | null
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_line_display_name?: string | null
          customer_line_user_id?: string | null
          customer_name: string
          customer_note?: string | null
          customer_phone: string
          id?: string
          invoice_address?: string | null
          invoice_buyer_phone?: string | null
          invoice_company_name?: string | null
          invoice_requested?: boolean | null
          invoice_tax_id?: string | null
          order_number: string
          pickup_time?: string | null
          pickup_type: string
          rejected_at?: string | null
          rejected_reason?: string | null
          slip_notified_at?: string | null
          slip_url?: string | null
          status?: string
          subtotal_amount_dec?: number | null
          total_amount_dec?: number | null
          vat_amount_dec?: number | null
          vat_rate?: number | null
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          adjustment_note?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_line_display_name?: string | null
          customer_line_user_id?: string | null
          customer_name?: string
          customer_note?: string | null
          customer_phone?: string
          id?: string
          invoice_address?: string | null
          invoice_buyer_phone?: string | null
          invoice_company_name?: string | null
          invoice_requested?: boolean | null
          invoice_tax_id?: string | null
          order_number?: string
          pickup_time?: string | null
          pickup_type?: string
          rejected_at?: string | null
          rejected_reason?: string | null
          slip_notified_at?: string | null
          slip_url?: string | null
          status?: string
          subtotal_amount_dec?: number | null
          total_amount_dec?: number | null
          vat_amount_dec?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
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
