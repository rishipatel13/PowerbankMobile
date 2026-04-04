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
      active_rentals: {
        Row: {
          bajie_order_id: string | null
          battery_id: string
          borrow_time: string
          cabinet_id: string
          created_at: string | null
          id: string
          slot: number | null
        }
        Insert: {
          bajie_order_id?: string | null
          battery_id: string
          borrow_time?: string
          cabinet_id: string
          created_at?: string | null
          id?: string
          slot?: number | null
        }
        Update: {
          bajie_order_id?: string | null
          battery_id?: string
          borrow_time?: string
          cabinet_id?: string
          created_at?: string | null
          id?: string
          slot?: number | null
        }
        Relationships: []
      }
      bajie_orders: {
        Row: {
          bajie_order_id: string
          battery_id: string | null
          borrow_slot: number | null
          borrow_status: number | null
          borrow_time: string | null
          cabinet_id: string
          created_at: string | null
          currency: string | null
          daily_max_price: number | null
          deposit: number | null
          device_type: string | null
          free_minutes: number | null
          id: string
          location_name: string | null
          order_amount: number | null
          price: number | null
          price_minute: string | null
          raw_data: Json | null
          return_time: string | null
          stripe_rental_id: string | null
          updated_at: string | null
        }
        Insert: {
          bajie_order_id: string
          battery_id?: string | null
          borrow_slot?: number | null
          borrow_status?: number | null
          borrow_time?: string | null
          cabinet_id: string
          created_at?: string | null
          currency?: string | null
          daily_max_price?: number | null
          deposit?: number | null
          device_type?: string | null
          free_minutes?: number | null
          id?: string
          location_name?: string | null
          order_amount?: number | null
          price?: number | null
          price_minute?: string | null
          raw_data?: Json | null
          return_time?: string | null
          stripe_rental_id?: string | null
          updated_at?: string | null
        }
        Update: {
          bajie_order_id?: string
          battery_id?: string | null
          borrow_slot?: number | null
          borrow_status?: number | null
          borrow_time?: string | null
          cabinet_id?: string
          created_at?: string | null
          currency?: string | null
          daily_max_price?: number | null
          deposit?: number | null
          device_type?: string | null
          free_minutes?: number | null
          id?: string
          location_name?: string | null
          order_amount?: number | null
          price?: number | null
          price_minute?: string | null
          raw_data?: Json | null
          return_time?: string | null
          stripe_rental_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bajie_orders_stripe_rental_id_fkey"
            columns: ["stripe_rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
        ]
      }
      batteries: {
        Row: {
          battery_fault_cause: string
          battery_fault_type: number
          battery_id: string
          cabinet_id: string
          charge_pct: number
          created_at: string
          first_seen_at: string
          is_healthy: boolean
          last_seen_at: string
          slot: number
          slot_fault_cause: string
          slot_fault_type: number
          updated_at: string
        }
        Insert: {
          battery_fault_cause?: string
          battery_fault_type?: number
          battery_id: string
          cabinet_id: string
          charge_pct?: number
          created_at?: string
          first_seen_at?: string
          is_healthy?: boolean
          last_seen_at?: string
          slot: number
          slot_fault_cause?: string
          slot_fault_type?: number
          updated_at?: string
        }
        Update: {
          battery_fault_cause?: string
          battery_fault_type?: number
          battery_id?: string
          cabinet_id?: string
          charge_pct?: number
          created_at?: string
          first_seen_at?: string
          is_healthy?: boolean
          last_seen_at?: string
          slot?: number
          slot_fault_cause?: string
          slot_fault_type?: number
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_contacted_at: string | null
          last_name: string
          notes: string
          phone: string
          prospect_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          notes?: string
          phone?: string
          prospect_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_contacted_at?: string | null
          last_name?: string
          notes?: string
          phone?: string
          prospect_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "prospects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_briefs: {
        Row: {
          created_at: string | null
          date: string
          generated_at: string | null
          id: string
          sections: Json
        }
        Insert: {
          created_at?: string | null
          date: string
          generated_at?: string | null
          id?: string
          sections?: Json
        }
        Update: {
          created_at?: string | null
          date?: string
          generated_at?: string | null
          id?: string
          sections?: Json
        }
        Relationships: []
      }
      dc_liquor_licenses: {
        Row: {
          address: string | null
          city: string | null
          co_capacity: number | null
          created_at: string
          id: string
          license_class: string | null
          license_number: string
          license_status: string | null
          state: string | null
          total_capacity: number | null
          trade_name: string
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          co_capacity?: number | null
          created_at?: string
          id?: string
          license_class?: string | null
          license_number: string
          license_status?: string | null
          state?: string | null
          total_capacity?: number | null
          trade_name: string
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          co_capacity?: number | null
          created_at?: string
          id?: string
          license_class?: string | null
          license_number?: string
          license_status?: string | null
          state?: string | null
          total_capacity?: number | null
          trade_name?: string
          updated_at?: string
          zip?: string | null
        }
        Relationships: []
      }
      incidents: {
        Row: {
          created_at: string | null
          duration_minutes: number | null
          id: string
          incident_type: string
          location_name: string | null
          metadata: Json | null
          resolve_event_id: string | null
          resolved_at: string | null
          source_event_id: string | null
          started_at: string
          station_id: string
        }
        Insert: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          incident_type: string
          location_name?: string | null
          metadata?: Json | null
          resolve_event_id?: string | null
          resolved_at?: string | null
          source_event_id?: string | null
          started_at: string
          station_id: string
        }
        Update: {
          created_at?: string | null
          duration_minutes?: number | null
          id?: string
          incident_type?: string
          location_name?: string | null
          metadata?: Json | null
          resolve_event_id?: string | null
          resolved_at?: string | null
          source_event_id?: string | null
          started_at?: string
          station_id?: string
        }
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          id: string
          location_id: string
          machine_id: string
          product_id: string | null
          product_image: string | null
          product_name: string | null
          slot_id: string
          snapshot_at: string | null
          stock_count: number | null
          unit_price: number | null
          venue_name: string | null
        }
        Insert: {
          id?: string
          location_id: string
          machine_id: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          slot_id: string
          snapshot_at?: string | null
          stock_count?: number | null
          unit_price?: number | null
          venue_name?: string | null
        }
        Update: {
          id?: string
          location_id?: string
          machine_id?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string | null
          slot_id?: string
          snapshot_at?: string | null
          stock_count?: number | null
          unit_price?: number | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nicbox_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          created_at: string
          daily_cap: number | null
          empty_slots: number | null
          go_live_date: string | null
          hourly_rate: number | null
          investment_cost: number
          last_status_update_at: string | null
          lost_fee: number | null
          machine_status: string | null
          name: string
          pos_sn: string | null
          pos_status: string | null
          postal_code: string | null
          state: string
          station_id: string | null
          stripe_id: string | null
          tax_rate: number
          total_slots: number | null
          updated_at: string
          venue_split: number
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          daily_cap?: number | null
          empty_slots?: number | null
          go_live_date?: string | null
          hourly_rate?: number | null
          investment_cost?: number
          last_status_update_at?: string | null
          lost_fee?: number | null
          machine_status?: string | null
          name: string
          pos_sn?: string | null
          pos_status?: string | null
          postal_code?: string | null
          state?: string
          station_id?: string | null
          stripe_id?: string | null
          tax_rate?: number
          total_slots?: number | null
          updated_at?: string
          venue_split?: number
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          daily_cap?: number | null
          empty_slots?: number | null
          go_live_date?: string | null
          hourly_rate?: number | null
          investment_cost?: number
          last_status_update_at?: string | null
          lost_fee?: number | null
          machine_status?: string | null
          name?: string
          pos_sn?: string | null
          pos_status?: string | null
          postal_code?: string | null
          state?: string
          station_id?: string | null
          stripe_id?: string | null
          tax_rate?: number
          total_slots?: number | null
          updated_at?: string
          venue_split?: number
        }
        Relationships: []
      }
      machine_events: {
        Row: {
          alert_reasons: string[]
          cabinet_id: string | null
          created_at: string | null
          event_data: Json | null
          event_timestamp: string | null
          event_type: string
          id: string
          is_abnormal: boolean
          location_name: string | null
          parsed_summary: string
        }
        Insert: {
          alert_reasons?: string[]
          cabinet_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_timestamp?: string | null
          event_type: string
          id?: string
          is_abnormal?: boolean
          location_name?: string | null
          parsed_summary?: string
        }
        Update: {
          alert_reasons?: string[]
          cabinet_id?: string | null
          created_at?: string | null
          event_data?: Json | null
          event_timestamp?: string | null
          event_type?: string
          id?: string
          is_abnormal?: boolean
          location_name?: string | null
          parsed_summary?: string
        }
        Relationships: []
      }
      nayax_sales: {
        Row: {
          authorization_time: string | null
          authorization_value: number | null
          card_brand: string | null
          created_at: string | null
          currency_code: string | null
          fetched_at: string | null
          id: string
          machine_id: string
          machine_name: string | null
          nayax_transaction_id: string
          payment_method: string | null
          product_name: string | null
          raw_json: Json | null
          settlement_time: string | null
          settlement_value: number | null
        }
        Insert: {
          authorization_time?: string | null
          authorization_value?: number | null
          card_brand?: string | null
          created_at?: string | null
          currency_code?: string | null
          fetched_at?: string | null
          id?: string
          machine_id: string
          machine_name?: string | null
          nayax_transaction_id: string
          payment_method?: string | null
          product_name?: string | null
          raw_json?: Json | null
          settlement_time?: string | null
          settlement_value?: number | null
        }
        Update: {
          authorization_time?: string | null
          authorization_value?: number | null
          card_brand?: string | null
          created_at?: string | null
          currency_code?: string | null
          fetched_at?: string | null
          id?: string
          machine_id?: string
          machine_name?: string | null
          nayax_transaction_id?: string
          payment_method?: string | null
          product_name?: string | null
          raw_json?: Json | null
          settlement_time?: string | null
          settlement_value?: number | null
        }
        Relationships: []
      }
      nicbox_locations: {
        Row: {
          commission_rate: number
          created_at: string
          id: string
          machine_id: string | null
          nayax_id: string | null
          venue_name: string
        }
        Insert: {
          commission_rate?: number
          created_at?: string
          id?: string
          machine_id?: string | null
          nayax_id?: string | null
          venue_name: string
        }
        Update: {
          commission_rate?: number
          created_at?: string
          id?: string
          machine_id?: string | null
          nayax_id?: string | null
          venue_name?: string
        }
        Relationships: []
      }
      nicbox_orders: {
        Row: {
          card_number: string | null
          card_type: string | null
          cogs_amount: number | null
          created_at: string
          credit_card_type: string | null
          customer_email: string | null
          customer_phone: string | null
          excise_tax_amount: number | null
          id: string
          is_refunded: boolean | null
          location_id: string
          nayax_transaction_id: string | null
          net_profit: number | null
          order_number: string | null
          order_time: string
          price: number | null
          processing_fee: number | null
          product_name: string | null
          venue_payout: number | null
        }
        Insert: {
          card_number?: string | null
          card_type?: string | null
          cogs_amount?: number | null
          created_at?: string
          credit_card_type?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          excise_tax_amount?: number | null
          id?: string
          is_refunded?: boolean | null
          location_id: string
          nayax_transaction_id?: string | null
          net_profit?: number | null
          order_number?: string | null
          order_time: string
          price?: number | null
          processing_fee?: number | null
          product_name?: string | null
          venue_payout?: number | null
        }
        Update: {
          card_number?: string | null
          card_type?: string | null
          cogs_amount?: number | null
          created_at?: string
          credit_card_type?: string | null
          customer_email?: string | null
          customer_phone?: string | null
          excise_tax_amount?: number | null
          id?: string
          is_refunded?: boolean | null
          location_id?: string
          nayax_transaction_id?: string | null
          net_profit?: number | null
          order_number?: string | null
          order_time?: string
          price?: number | null
          processing_fee?: number | null
          product_name?: string | null
          venue_payout?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nicbox_orders_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nicbox_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          id: string
          location_name: string
          notes: string | null
          payout_date: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          location_name: string
          notes?: string | null
          payout_date: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          location_name?: string
          notes?: string | null
          payout_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_location_name_fkey"
            columns: ["location_name"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["name"]
          },
        ]
      }
      products: {
        Row: {
          aliases: string[] | null
          category: string | null
          created_at: string | null
          id: string
          is_taxable: boolean | null
          name: string
        }
        Insert: {
          aliases?: string[] | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_taxable?: boolean | null
          name: string
        }
        Update: {
          aliases?: string[] | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_taxable?: boolean | null
          name?: string
        }
        Relationships: []
      }
      prospects: {
        Row: {
          address: string | null
          business_name: string
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          estimated_monthly_revenue: number | null
          follow_up_date: string | null
          id: string
          notes: string | null
          stage: string
          state: string | null
          updated_at: string | null
          venue_capacity: number | null
          venue_type: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          estimated_monthly_revenue?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          stage?: string
          state?: string | null
          updated_at?: string | null
          venue_capacity?: number | null
          venue_type?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          estimated_monthly_revenue?: number | null
          follow_up_date?: string | null
          id?: string
          notes?: string | null
          stage?: string
          state?: string | null
          updated_at?: string | null
          venue_capacity?: number | null
          venue_type?: string | null
        }
        Relationships: []
      }
      proxy_upload_logs: {
        Row: {
          created_at: string | null
          id: string
          response_data: string | null
          status_code: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          response_data?: string | null
          status_code?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          response_data?: string | null
          status_code?: number | null
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          remaining_quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          remaining_quantity: number
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          remaining_quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string | null
          id: string
          invoice_number: string | null
          notes: string | null
          order_date: string
          payment_method: string | null
          shipping_cost: number | null
          vendor_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          order_date: string
          payment_method?: string | null
          shipping_cost?: number | null
          vendor_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          invoice_number?: string | null
          notes?: string | null
          order_date?: string
          payment_method?: string | null
          shipping_cost?: number | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          amount_authorized: number | null
          amount_captured: number | null
          amount_override: number | null
          amount_refunded: number | null
          card_brand: string | null
          card_last4: string | null
          created_at: string
          currency: string | null
          daily_cap_snapshot: number | null
          deleted_at: string | null
          disputed: boolean | null
          effective_amount: number | null
          failure_code: string | null
          failure_message: string | null
          hourly_rate_snapshot: number | null
          id: string
          is_accidental_multi: boolean
          is_damaged: boolean
          is_lost: boolean
          is_paid: boolean | null
          is_refunded: boolean | null
          location_name: string | null
          lost_fee_snapshot: number | null
          my_profit: number | null
          raw_data: Json | null
          receipt_url: string | null
          rental_hours: number | null
          sales_tax: number | null
          station_id: string | null
          status: string | null
          transaction_type: string
          venue_payout: number | null
          wallet_type: string | null
        }
        Insert: {
          amount_authorized?: number | null
          amount_captured?: number | null
          amount_override?: number | null
          amount_refunded?: number | null
          card_brand?: string | null
          card_last4?: string | null
          created_at: string
          currency?: string | null
          daily_cap_snapshot?: number | null
          deleted_at?: string | null
          disputed?: boolean | null
          effective_amount?: number | null
          failure_code?: string | null
          failure_message?: string | null
          hourly_rate_snapshot?: number | null
          id: string
          is_accidental_multi?: boolean
          is_damaged?: boolean
          is_lost?: boolean
          is_paid?: boolean | null
          is_refunded?: boolean | null
          location_name?: string | null
          lost_fee_snapshot?: number | null
          my_profit?: number | null
          raw_data?: Json | null
          receipt_url?: string | null
          rental_hours?: number | null
          sales_tax?: number | null
          station_id?: string | null
          status?: string | null
          transaction_type?: string
          venue_payout?: number | null
          wallet_type?: string | null
        }
        Update: {
          amount_authorized?: number | null
          amount_captured?: number | null
          amount_override?: number | null
          amount_refunded?: number | null
          card_brand?: string | null
          card_last4?: string | null
          created_at?: string
          currency?: string | null
          daily_cap_snapshot?: number | null
          deleted_at?: string | null
          disputed?: boolean | null
          effective_amount?: number | null
          failure_code?: string | null
          failure_message?: string | null
          hourly_rate_snapshot?: number | null
          id?: string
          is_accidental_multi?: boolean
          is_damaged?: boolean
          is_lost?: boolean
          is_paid?: boolean | null
          is_refunded?: boolean | null
          location_name?: string | null
          lost_fee_snapshot?: number | null
          my_profit?: number | null
          raw_data?: Json | null
          receipt_url?: string | null
          rental_hours?: number | null
          sales_tax?: number | null
          station_id?: string | null
          status?: string | null
          transaction_type?: string
          venue_payout?: number | null
          wallet_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_location_name_fkey"
            columns: ["location_name"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["name"]
          },
        ]
      }
      tax_rates: {
        Row: {
          end_date: string | null
          id: string
          rate: number
          start_date: string
        }
        Insert: {
          end_date?: string | null
          id?: string
          rate: number
          start_date: string
        }
        Update: {
          end_date?: string | null
          id?: string
          rate?: number
          start_date?: string
        }
        Relationships: []
      }
      vendors: {
        Row: {
          account_number: string | null
          contact_name: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          website: string | null
        }
        Insert: {
          account_number?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Update: {
          account_number?: string | null
          contact_name?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          website?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          accessibility_options: Json | null
          active: boolean | null
          address_components: Json | null
          address_descriptor: Json | null
          adr_format_address: string | null
          allows_dogs: boolean | null
          attributions: Json | null
          business_status: string | null
          co_capacity: number | null
          containing_places: Json | null
          created_at: string | null
          curbside_pickup: boolean | null
          current_opening_hours: Json | null
          current_secondary_opening_hours: Json | null
          custom_name: string | null
          custom_neighborhood: string | null
          delivery: boolean | null
          dine_in: boolean | null
          display_name: string | null
          editorial_summary: string | null
          ev_charge_amenity_summary: Json | null
          ev_charge_options: Json | null
          formatted_address: string | null
          fuel_options: Json | null
          generative_summary: Json | null
          good_for_children: boolean | null
          good_for_groups: boolean | null
          good_for_watching_sports: boolean | null
          google_maps_links: Json | null
          google_maps_uri: string | null
          google_place_id: string | null
          icon_background_color: string | null
          icon_mask_base_uri: string | null
          international_phone_number: string | null
          later: boolean
          live_music: boolean | null
          location: Json | null
          matched_license_name: string | null
          menu_for_children: boolean | null
          moved_place: Json | null
          moved_place_id: string | null
          name: string | null
          national_phone_number: string | null
          neighborhood_summary: Json | null
          next_page_token: string | null
          outdoor_seating: boolean | null
          parking_options: Json | null
          payment_options: Json | null
          photos: Json | null
          plus_code: Json | null
          postal_address: Json | null
          price_level: string | null
          price_range: Json | null
          primary_type: string | null
          primary_type_display_name: string | null
          pure_service_area_business: boolean | null
          rating: number | null
          raw_google_data: Json | null
          regular_opening_hours: Json | null
          regular_secondary_opening_hours: Json | null
          reservable: boolean | null
          restroom: boolean | null
          review_summary: Json | null
          reviews: Json | null
          routing_summaries: Json | null
          sbid: string
          serves_beer: boolean | null
          serves_breakfast: boolean | null
          serves_brunch: boolean | null
          serves_cocktails: boolean | null
          serves_coffee: boolean | null
          serves_dessert: boolean | null
          serves_dinner: boolean | null
          serves_lunch: boolean | null
          serves_vegetarian_food: boolean | null
          serves_wine: boolean | null
          short_formatted_address: string | null
          smart_type: string | null
          sub_destinations: Json | null
          takeout: boolean | null
          time_zone: string | null
          total_capacity: number | null
          types: Json | null
          user_rating_count: number | null
          utc_offset_minutes: number | null
          viewport: Json | null
          website_uri: string | null
        }
        Insert: {
          accessibility_options?: Json | null
          active?: boolean | null
          address_components?: Json | null
          address_descriptor?: Json | null
          adr_format_address?: string | null
          allows_dogs?: boolean | null
          attributions?: Json | null
          business_status?: string | null
          co_capacity?: number | null
          containing_places?: Json | null
          created_at?: string | null
          curbside_pickup?: boolean | null
          current_opening_hours?: Json | null
          current_secondary_opening_hours?: Json | null
          custom_name?: string | null
          custom_neighborhood?: string | null
          delivery?: boolean | null
          dine_in?: boolean | null
          display_name?: string | null
          editorial_summary?: string | null
          ev_charge_amenity_summary?: Json | null
          ev_charge_options?: Json | null
          formatted_address?: string | null
          fuel_options?: Json | null
          generative_summary?: Json | null
          good_for_children?: boolean | null
          good_for_groups?: boolean | null
          good_for_watching_sports?: boolean | null
          google_maps_links?: Json | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          icon_background_color?: string | null
          icon_mask_base_uri?: string | null
          international_phone_number?: string | null
          later?: boolean
          live_music?: boolean | null
          location?: Json | null
          matched_license_name?: string | null
          menu_for_children?: boolean | null
          moved_place?: Json | null
          moved_place_id?: string | null
          name?: string | null
          national_phone_number?: string | null
          neighborhood_summary?: Json | null
          next_page_token?: string | null
          outdoor_seating?: boolean | null
          parking_options?: Json | null
          payment_options?: Json | null
          photos?: Json | null
          plus_code?: Json | null
          postal_address?: Json | null
          price_level?: string | null
          price_range?: Json | null
          primary_type?: string | null
          primary_type_display_name?: string | null
          pure_service_area_business?: boolean | null
          rating?: number | null
          raw_google_data?: Json | null
          regular_opening_hours?: Json | null
          regular_secondary_opening_hours?: Json | null
          reservable?: boolean | null
          restroom?: boolean | null
          review_summary?: Json | null
          reviews?: Json | null
          routing_summaries?: Json | null
          sbid?: string
          serves_beer?: boolean | null
          serves_breakfast?: boolean | null
          serves_brunch?: boolean | null
          serves_cocktails?: boolean | null
          serves_coffee?: boolean | null
          serves_dessert?: boolean | null
          serves_dinner?: boolean | null
          serves_lunch?: boolean | null
          serves_vegetarian_food?: boolean | null
          serves_wine?: boolean | null
          short_formatted_address?: string | null
          smart_type?: string | null
          sub_destinations?: Json | null
          takeout?: boolean | null
          time_zone?: string | null
          total_capacity?: number | null
          types?: Json | null
          user_rating_count?: number | null
          utc_offset_minutes?: number | null
          viewport?: Json | null
          website_uri?: string | null
        }
        Update: {
          accessibility_options?: Json | null
          active?: boolean | null
          address_components?: Json | null
          address_descriptor?: Json | null
          adr_format_address?: string | null
          allows_dogs?: boolean | null
          attributions?: Json | null
          business_status?: string | null
          co_capacity?: number | null
          containing_places?: Json | null
          created_at?: string | null
          curbside_pickup?: boolean | null
          current_opening_hours?: Json | null
          current_secondary_opening_hours?: Json | null
          custom_name?: string | null
          custom_neighborhood?: string | null
          delivery?: boolean | null
          dine_in?: boolean | null
          display_name?: string | null
          editorial_summary?: string | null
          ev_charge_amenity_summary?: Json | null
          ev_charge_options?: Json | null
          formatted_address?: string | null
          fuel_options?: Json | null
          generative_summary?: Json | null
          good_for_children?: boolean | null
          good_for_groups?: boolean | null
          good_for_watching_sports?: boolean | null
          google_maps_links?: Json | null
          google_maps_uri?: string | null
          google_place_id?: string | null
          icon_background_color?: string | null
          icon_mask_base_uri?: string | null
          international_phone_number?: string | null
          later?: boolean
          live_music?: boolean | null
          location?: Json | null
          matched_license_name?: string | null
          menu_for_children?: boolean | null
          moved_place?: Json | null
          moved_place_id?: string | null
          name?: string | null
          national_phone_number?: string | null
          neighborhood_summary?: Json | null
          next_page_token?: string | null
          outdoor_seating?: boolean | null
          parking_options?: Json | null
          payment_options?: Json | null
          photos?: Json | null
          plus_code?: Json | null
          postal_address?: Json | null
          price_level?: string | null
          price_range?: Json | null
          primary_type?: string | null
          primary_type_display_name?: string | null
          pure_service_area_business?: boolean | null
          rating?: number | null
          raw_google_data?: Json | null
          regular_opening_hours?: Json | null
          regular_secondary_opening_hours?: Json | null
          reservable?: boolean | null
          restroom?: boolean | null
          review_summary?: Json | null
          reviews?: Json | null
          routing_summaries?: Json | null
          sbid?: string
          serves_beer?: boolean | null
          serves_breakfast?: boolean | null
          serves_brunch?: boolean | null
          serves_cocktails?: boolean | null
          serves_coffee?: boolean | null
          serves_dessert?: boolean | null
          serves_dinner?: boolean | null
          serves_lunch?: boolean | null
          serves_vegetarian_food?: boolean | null
          serves_wine?: boolean | null
          short_formatted_address?: string | null
          smart_type?: string | null
          sub_destinations?: Json | null
          takeout?: boolean | null
          time_zone?: string | null
          total_capacity?: number | null
          types?: Json | null
          user_rating_count?: number | null
          utc_offset_minutes?: number | null
          viewport?: Json | null
          website_uri?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      latest_inventory_view: {
        Row: {
          id: string | null
          location_id: string | null
          machine_id: string | null
          product_id: string | null
          product_image: string | null
          product_name: string | null
          slot_id: string | null
          snapshot_at: string | null
          stock_count: number | null
          unit_price: number | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "nicbox_locations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      bulk_update_orders: {
        Args: {
          new_cogs?: number
          new_is_refunded?: boolean
          selected_ids: string[]
        }
        Returns: undefined
      }
      bulk_upsert_orders: { Args: { orders: Json }; Returns: number }
      get_dashboard_metrics: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          out_my_profit: number
          out_total_processing_fees: number
          out_total_revenue: number
          out_venue_payout: number
        }[]
      }
      get_dashboard_venue_stats: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: {
          location_id: string
          orders_count: number
          revenue: number
          venue_name: string
        }[]
      }
      get_excise_tax_stats: {
        Args: never
        Returns: {
          quarter: number
          total_excise_tax: number
          total_sales: number
          year: number
        }[]
      }
      get_stock_overview: {
        Args: never
        Returns: {
          avg_cost: number
          category: string
          is_taxable: boolean
          product_id: string
          product_name: string
          total_purchased: number
          total_remaining: number
          total_sold: number
        }[]
      }
      get_transaction_stats: {
        Args: {
          p_end_date?: string
          p_filter_status?: string
          p_search?: string
          p_start_date?: string
          p_venue_id?: string
        }
        Returns: {
          out_net_revenue: number
          out_total_orders: number
          out_total_processing_fees: number
          out_total_revenue: number
          out_total_venue_payouts: number
        }[]
      }
      get_unmatched_product_names: {
        Args: never
        Returns: {
          occurrence_count: number
          product_name: string
        }[]
      }
      resolve_product_id: { Args: { p_product_name: string }; Returns: string }
      venue_payout_rounded_up: { Args: { payout: number }; Returns: number }
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
