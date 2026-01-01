export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      orders: {
        Row: {
          id: string
          order_number: string
          status: string
          customer_name: string
          customer_phone: string
          pickup_type: 'ASAP' | 'SCHEDULED'
          pickup_time: string | null
          total_amount: number
          slip_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          order_number: string
          status?: string
          customer_name: string
          customer_phone: string
          pickup_type: 'ASAP' | 'SCHEDULED'
          pickup_time?: string | null
          total_amount: number
          slip_url?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          order_number?: string
          status?: string
          customer_name?: string
          customer_phone?: string
          pickup_type?: 'ASAP' | 'SCHEDULED'
          pickup_time?: string | null
          total_amount?: number
          slip_url?: string | null
          created_at?: string
        }
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          menu_item_id: string
          name_th: string
          name_en: string
          qty: number
          base_price: number
          final_price: number
          note: string | null
          selected_options_json: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          menu_item_id: string
          name_th: string
          name_en: string
          qty: number
          base_price: number
          final_price: number
          note?: string | null
          selected_options_json?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          menu_item_id?: string
          name_th?: string
          name_en?: string
          qty?: number
          base_price?: number
          final_price?: number
          note?: string | null
          selected_options_json?: Json | null
          created_at?: string
        }
      }
    }
  }
}
