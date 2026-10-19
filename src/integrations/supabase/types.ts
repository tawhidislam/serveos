export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      addon_coupons: {
        Row: {
          applies_to_addons: string[] | null
          applies_to_billing_types: string[] | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_amount: number
          redemption_count: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_addons?: string[] | null
          applies_to_billing_types?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_amount?: number
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_addons?: string[] | null
          applies_to_billing_types?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_amount?: number
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      addon_purchase_requests: {
        Row: {
          addon_coupon_id: string | null
          addon_id: string
          admin_notes: string | null
          amount: number
          billing_type: string
          coupon_code: string | null
          created_at: string
          currency: string
          discount_amount: number
          id: string
          notes: string | null
          original_amount: number | null
          payment_method: string | null
          payment_reference: string | null
          quantity: number
          reference_code: string | null
          requested_by: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_number: string | null
          status: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          addon_coupon_id?: string | null
          addon_id: string
          admin_notes?: string | null
          amount?: number
          billing_type?: string
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          quantity?: number
          reference_code?: string | null
          requested_by?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          addon_coupon_id?: string | null
          addon_id?: string
          admin_notes?: string | null
          amount?: number
          billing_type?: string
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string | null
          payment_reference?: string | null
          quantity?: number
          reference_code?: string | null
          requested_by?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number?: string | null
          status?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "addon_purchase_requests_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "platform_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addon_purchase_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      bkash_settings: {
        Row: {
          account_type: string
          created_at: string
          id: string
          instructions: string | null
          is_enabled: boolean
          merchant_number: string
          reference_prefix: string | null
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          merchant_number?: string
          reference_prefix?: string | null
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          merchant_number?: string
          reference_prefix?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_alerts: {
        Row: {
          alert_threshold_pct: number
          branch_id: string | null
          category_id: string | null
          created_at: string
          id: string
          is_active: boolean
          monthly_budget: number
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          alert_threshold_pct?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_budget?: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          alert_threshold_pct?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          monthly_budget?: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alerts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_alerts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawer_sessions: {
        Row: {
          branch_id: string | null
          cash_in: number
          cash_out: number
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          restaurant_id: string | null
          status: string
        }
        Insert: {
          branch_id?: string | null
          cash_in?: number
          cash_out?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          restaurant_id?: string | null
          status?: string
        }
        Update: {
          branch_id?: string | null
          cash_in?: number
          cash_out?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          restaurant_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_drawer_sessions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          name: string
          restaurant_id: string | null
          sort_order: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          name?: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      cta_clicks: {
        Row: {
          created_at: string
          destination: string
          destination_type: string
          fulfillment: string | null
          id: string
          label: string | null
          page_path: string | null
          restaurant_id: string
          source: string | null
        }
        Insert: {
          created_at?: string
          destination: string
          destination_type?: string
          fulfillment?: string | null
          id?: string
          label?: string | null
          page_path?: string | null
          restaurant_id: string
          source?: string | null
        }
        Update: {
          created_at?: string
          destination?: string
          destination_type?: string
          fulfillment?: string | null
          id?: string
          label?: string | null
          page_path?: string | null
          restaurant_id?: string
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cta_clicks_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domain_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          message: string | null
          requested_by: string | null
          requested_domain: string
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by?: string | null
          requested_domain: string
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          message?: string | null
          requested_by?: string | null
          requested_domain?: string
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_domain_requests_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          created_at: string
          customer_id: string
          id: string
          instructions: string | null
          is_default: boolean
          label: string
          phone: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          address: string
          created_at?: string
          customer_id: string
          id?: string
          instructions?: string | null
          is_default?: boolean
          label?: string
          phone?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          address?: string
          created_at?: string
          customer_id?: string
          id?: string
          instructions?: string | null
          is_default?: boolean
          label?: string
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      customization_tags: {
        Row: {
          category: string
          color: string | null
          created_at: string
          emoji: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string | null
          sort_order: number
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "customization_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_page_config: {
        Row: {
          created_at: string
          credentials: Json
          cta: Json
          embeds: Json
          features: Json
          hero: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          cta?: Json
          embeds?: Json
          features?: Json
          hero?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          cta?: Json
          embeds?: Json
          features?: Json
          hero?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      employee_shifts: {
        Row: {
          branch_id: string | null
          created_at: string
          end_time: string
          hourly_rate: number
          hours_worked: number
          id: string
          notes: string | null
          restaurant_id: string | null
          shift_date: string
          start_time: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          end_time?: string
          hourly_rate?: number
          hours_worked?: number
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          shift_date?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          end_time?: string
          hourly_rate?: number
          hours_worked?: number
          id?: string
          notes?: string | null
          restaurant_id?: string | null
          shift_date?: string
          start_time?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_shifts_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_tips: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          restaurant_id: string | null
          source: string
          tip_date: string
          user_id: string
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          restaurant_id?: string | null
          source?: string
          tip_date?: string
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          restaurant_id?: string | null
          source?: string
          tip_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_tips_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_tips_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_tips_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          branch_id: string | null
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string | null
          category_id: string | null
          created_at: string
          description: string | null
          expense_date: string
          id: string
          is_recurring: boolean
          payment_method: string | null
          receipt_url: string | null
          recorded_by: string | null
          recurring_interval: string | null
          reference_number: string | null
          restaurant_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          recurring_interval?: string | null
          reference_number?: string | null
          restaurant_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          expense_date?: string
          id?: string
          is_recurring?: boolean
          payment_method?: string | null
          receipt_url?: string | null
          recorded_by?: string | null
          recurring_interval?: string | null
          reference_number?: string | null
          restaurant_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      floor_plans: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          restaurant_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "floor_plans_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floor_plans_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_content: {
        Row: {
          content: Json
          id: string
          restaurant_id: string | null
          section_key: string
          updated_at: string
        }
        Insert: {
          content?: Json
          id?: string
          restaurant_id?: string | null
          section_key: string
          updated_at?: string
        }
        Update: {
          content?: Json
          id?: string
          restaurant_id?: string | null
          section_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homepage_content_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_adjustments: {
        Row: {
          adjusted_by: string | null
          branch_id: string | null
          cost_impact: number
          created_at: string
          delta: number
          id: string
          item_id: string
          notes: string | null
          quantity_after: number
          quantity_before: number
          reason: string
          reference: string | null
          restaurant_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          adjusted_by?: string | null
          branch_id?: string | null
          cost_impact?: number
          created_at?: string
          delta?: number
          id?: string
          item_id: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          reason: string
          reference?: string | null
          restaurant_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          adjusted_by?: string | null
          branch_id?: string | null
          cost_impact?: number
          created_at?: string
          delta?: number
          id?: string
          item_id?: string
          notes?: string | null
          quantity_after?: number
          quantity_before?: number
          reason?: string
          reference?: string | null
          restaurant_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_adjustments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          branch_id: string | null
          category: string
          cost_per_unit: number
          created_at: string
          current_stock: number
          id: string
          is_active: boolean
          min_stock: number
          name: string
          restaurant_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category?: string
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          min_stock?: number
          name: string
          restaurant_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category?: string
          cost_per_unit?: number
          created_at?: string
          current_stock?: number
          id?: string
          is_active?: boolean
          min_stock?: number
          name?: string
          restaurant_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transactions: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          item_id: string
          notes: string | null
          quantity: number
          recorded_by: string | null
          restaurant_id: string | null
          total_cost: number
          transaction_date: string
          type: string
          unit_cost: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          item_id: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          restaurant_id?: string | null
          total_cost?: number
          transaction_date?: string
          type?: string
          unit_cost?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          item_id?: string
          notes?: string | null
          quantity?: number
          recorded_by?: string | null
          restaurant_id?: string | null
          total_cost?: number
          transaction_date?: string
          type?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          created_at: string
          earn_type: string
          expiry_days: number
          expiry_enabled: boolean
          id: string
          is_enabled: boolean
          min_redeem_points: number
          point_value: number
          points_per_currency: number
          points_per_order: number
          redemption_tiers: Json
          redemption_type: string
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          earn_type?: string
          expiry_days?: number
          expiry_enabled?: boolean
          id?: string
          is_enabled?: boolean
          min_redeem_points?: number
          point_value?: number
          points_per_currency?: number
          points_per_order?: number
          redemption_tiers?: Json
          redemption_type?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          earn_type?: string
          expiry_days?: number
          expiry_enabled?: boolean
          id?: string
          is_enabled?: boolean
          min_redeem_points?: number
          point_value?: number
          points_per_currency?: number
          points_per_order?: number
          redemption_tiers?: Json
          redemption_type?: string
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transactions: {
        Row: {
          created_at: string
          customer_id: string | null
          description: string | null
          expires_at: string | null
          id: string
          order_id: string | null
          points: number
          restaurant_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points: number
          restaurant_id?: string | null
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          order_id?: string | null
          points?: number
          restaurant_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transactions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_about_settings: {
        Row: {
          created_at: string
          cta_primary_href: string
          cta_primary_label: string
          cta_secondary_href: string
          cta_secondary_label: string
          cta_title: string
          hero_description: string
          hero_eyebrow: string
          hero_image_url: string | null
          hero_title: string
          id: string
          meta_description: string
          meta_title: string
          pillars: Json
          story_eyebrow: string
          story_image_url: string | null
          story_paragraphs: Json
          story_title: string
          updated_at: string
          values_items: Json
          why_eyebrow: string
          why_title: string
        }
        Insert: {
          created_at?: string
          cta_primary_href?: string
          cta_primary_label?: string
          cta_secondary_href?: string
          cta_secondary_label?: string
          cta_title?: string
          hero_description?: string
          hero_eyebrow?: string
          hero_image_url?: string | null
          hero_title?: string
          id?: string
          meta_description?: string
          meta_title?: string
          pillars?: Json
          story_eyebrow?: string
          story_image_url?: string | null
          story_paragraphs?: Json
          story_title?: string
          updated_at?: string
          values_items?: Json
          why_eyebrow?: string
          why_title?: string
        }
        Update: {
          created_at?: string
          cta_primary_href?: string
          cta_primary_label?: string
          cta_secondary_href?: string
          cta_secondary_label?: string
          cta_title?: string
          hero_description?: string
          hero_eyebrow?: string
          hero_image_url?: string | null
          hero_title?: string
          id?: string
          meta_description?: string
          meta_title?: string
          pillars?: Json
          story_eyebrow?: string
          story_image_url?: string | null
          story_paragraphs?: Json
          story_title?: string
          updated_at?: string
          values_items?: Json
          why_eyebrow?: string
          why_title?: string
        }
        Relationships: []
      }
      marketing_contact_settings: {
        Row: {
          contact_info: Json
          created_at: string
          description: string
          eyebrow: string
          id: string
          reasons: Json
          response_time_text: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_info?: Json
          created_at?: string
          description?: string
          eyebrow?: string
          id?: string
          reasons?: Json
          response_time_text?: string
          title?: string
          updated_at?: string
        }
        Update: {
          contact_info?: Json
          created_at?: string
          description?: string
          eyebrow?: string
          id?: string
          reasons?: Json
          response_time_text?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_contact_submissions: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          message: string
          name: string
          reason: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          reason?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      marketing_footer_settings: {
        Row: {
          bottom_tagline: string
          columns: Json
          copyright_text: string
          created_at: string
          id: string
          social_links: Json
          tagline: string
          updated_at: string
        }
        Insert: {
          bottom_tagline?: string
          columns?: Json
          copyright_text?: string
          created_at?: string
          id?: string
          social_links?: Json
          tagline?: string
          updated_at?: string
        }
        Update: {
          bottom_tagline?: string
          columns?: Json
          copyright_text?: string
          created_at?: string
          id?: string
          social_links?: Json
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketing_page_sections: {
        Row: {
          content: Json
          created_at: string
          id: string
          is_enabled: boolean
          page_key: string
          section_type: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          page_key: string
          section_type: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          is_enabled?: boolean
          page_key?: string
          section_type?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      menu_item_addon_options: {
        Row: {
          addon_id: string
          created_at: string
          id: string
          name: string
          price_modifier: number
          restaurant_id: string | null
          sort_order: number
        }
        Insert: {
          addon_id: string
          created_at?: string
          id?: string
          name: string
          price_modifier?: number
          restaurant_id?: string | null
          sort_order?: number
        }
        Update: {
          addon_id?: string
          created_at?: string
          id?: string
          name?: string
          price_modifier?: number
          restaurant_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addon_options_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "menu_item_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_addon_options_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_addons: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          name: string
          required: boolean
          restaurant_id: string | null
          sort_order: number
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          name: string
          required?: boolean
          restaurant_id?: string | null
          sort_order?: number
          type?: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          name?: string
          required?: boolean
          restaurant_id?: string | null
          sort_order?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_addons_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_images: {
        Row: {
          caption: string | null
          created_at: string
          id: string
          image_url: string
          menu_item_id: string
          restaurant_id: string | null
          sort_order: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url: string
          menu_item_id: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          id?: string
          image_url?: string
          menu_item_id?: string
          restaurant_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_images_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_images_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_ingredients: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          inventory_item_id: string
          menu_item_id: string
          quantity_per_unit: number
          restaurant_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id: string
          menu_item_id: string
          quantity_per_unit?: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          inventory_item_id?: string
          menu_item_id?: string
          quantity_per_unit?: number
          restaurant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_ingredients_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_ingredients_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_item_tags: {
        Row: {
          created_at: string
          id: string
          menu_item_id: string
          restaurant_id: string | null
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          menu_item_id: string
          restaurant_id?: string | null
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          menu_item_id?: string
          restaurant_id?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_item_tags_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_tags_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_item_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customization_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          branch_id: string | null
          category_id: string
          created_at: string
          custom_slug: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean
          name: string
          prep_time_minutes: number | null
          price: number
          restaurant_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id: string
          created_at?: string
          custom_slug?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name: string
          prep_time_minutes?: number | null
          price: number
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string
          created_at?: string
          custom_slug?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean
          name?: string
          prep_time_minutes?: number | null
          price?: number
          restaurant_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      mobile_payment_settings: {
        Row: {
          account_type: string
          created_at: string
          display_name: string
          id: string
          instructions: string | null
          is_enabled: boolean
          provider: string
          receiver_number: string
          reference_prefix: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          account_type?: string
          created_at?: string
          display_name: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          provider: string
          receiver_number?: string
          reference_prefix?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          account_type?: string
          created_at?: string
          display_name?: string
          id?: string
          instructions?: string | null
          is_enabled?: boolean
          provider?: string
          receiver_number?: string
          reference_prefix?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          unit_price: number | null
          created_at: string
          id: string
          menu_item_id: string
          notes: string | null
          order_id: string
          quantity: number
          restaurant_id: string | null
          selected_addons: Json
          selected_tags: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          unit_price?: number | null
          created_at?: string
          id?: string
          menu_item_id: string
          notes?: string | null
          order_id: string
          quantity?: number
          restaurant_id?: string | null
          selected_addons?: Json
          selected_tags?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          unit_price?: number | null
          created_at?: string
          id?: string
          menu_item_id?: string
          notes?: string | null
          order_id?: string
          quantity?: number
          restaurant_id?: string | null
          selected_addons?: Json
          selected_tags?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          kitchen_started_at: string | null
          kitchen_due_at: string | null
          kitchen_ready_at: string | null
          kitchen_target_minutes: number | null
          branch_id: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_address: string | null
          delivery_fee: number
          delivery_instructions: string | null
          discount_amount: number
          id: string
          notes: string | null
          order_type: string
          paid_at: string | null
          payment_method: string | null
          payment_splits: Json
          requested_for: string | null
          restaurant_id: string | null
          status: string
          table_id: string | null
          tax_rate: number
          ticket_number: number | null
          total_amount: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          kitchen_started_at?: string | null
          kitchen_due_at?: string | null
          kitchen_ready_at?: string | null
          kitchen_target_minutes?: number | null
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_type?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_splits?: Json
          requested_for?: string | null
          restaurant_id?: string | null
          status?: string
          table_id?: string | null
          tax_rate?: number
          ticket_number?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          kitchen_started_at?: string | null
          kitchen_due_at?: string | null
          kitchen_ready_at?: string | null
          kitchen_target_minutes?: number | null
          branch_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          delivery_address?: string | null
          delivery_fee?: number
          delivery_instructions?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          order_type?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_splits?: Json
          requested_for?: string | null
          restaurant_id?: string | null
          status?: string
          table_id?: string | null
          tax_rate?: number
          ticket_number?: number | null
          total_amount?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_records: {
        Row: {
          base_pay: number
          bonuses: number
          branch_id: string | null
          created_at: string
          deductions: number
          id: string
          net_pay: number
          notes: string | null
          paid_at: string | null
          period_end: string
          period_start: string
          restaurant_id: string | null
          status: string
          tips_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          base_pay?: number
          bonuses?: number
          branch_id?: string | null
          created_at?: string
          deductions?: number
          id?: string
          net_pay?: number
          notes?: string | null
          paid_at?: string | null
          period_end: string
          period_start: string
          restaurant_id?: string | null
          status?: string
          tips_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          base_pay?: number
          bonuses?: number
          branch_id?: string | null
          created_at?: string
          deductions?: number
          id?: string
          net_pay?: number
          notes?: string | null
          paid_at?: string | null
          period_end?: string
          period_start?: string
          restaurant_id?: string | null
          status?: string
          tips_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_records_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_records_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_addons: {
        Row: {
          allow_multiple: boolean
          badge: string | null
          billing_type: string
          created_at: string
          currency: string
          description: string | null
          extra_branches: number
          extra_menu_items: number
          extra_staff: number
          feature_key: string | null
          icon: string | null
          id: string
          is_active: boolean
          is_public: boolean
          key: string
          max_quantity: number | null
          name: string
          price_amount: number
          sort_order: number
          unlimited_branches: boolean
          unlimited_menu_items: boolean
          unlimited_staff: boolean
          updated_at: string
        }
        Insert: {
          allow_multiple?: boolean
          badge?: string | null
          billing_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          extra_branches?: number
          extra_menu_items?: number
          extra_staff?: number
          feature_key?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          key: string
          max_quantity?: number | null
          name: string
          price_amount?: number
          sort_order?: number
          unlimited_branches?: boolean
          unlimited_menu_items?: boolean
          unlimited_staff?: boolean
          updated_at?: string
        }
        Update: {
          allow_multiple?: boolean
          badge?: string | null
          billing_type?: string
          created_at?: string
          currency?: string
          description?: string | null
          extra_branches?: number
          extra_menu_items?: number
          extra_staff?: number
          feature_key?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          is_public?: boolean
          key?: string
          max_quantity?: number | null
          name?: string
          price_amount?: number
          sort_order?: number
          unlimited_branches?: boolean
          unlimited_menu_items?: boolean
          unlimited_staff?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      platform_admins: {
        Row: {
          created_at: string
          email: string
          id: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      platform_app_downloads: {
        Row: { id: boolean; content: Json; updated_at: string }
        Insert: { id?: boolean; content: Json; updated_at?: string }
        Update: { content?: Json; updated_at?: string }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          custom_domain_a_record_ip: string
          custom_domain_cname_target: string
          favicon_url: string | null
          id: string
          logo_url: string | null
          site_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_domain_a_record_ip?: string
          custom_domain_cname_target?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_domain_a_record_ip?: string
          custom_domain_cname_target?: string
          favicon_url?: string | null
          id?: string
          logo_url?: string | null
          site_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_themes: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          preview_image: string | null
          sort_order: number
          tokens: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          preview_image?: string | null
          sort_order?: number
          tokens?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          preview_image?: string | null
          sort_order?: number
          tokens?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promotion_uses: {
        Row: {
          discount_applied: number
          id: string
          order_id: string | null
          promotion_id: string
          restaurant_id: string | null
          used_at: string
          user_id: string | null
        }
        Insert: {
          discount_applied?: number
          id?: string
          order_id?: string | null
          promotion_id: string
          restaurant_id?: string | null
          used_at?: string
          user_id?: string | null
        }
        Update: {
          discount_applied?: number
          id?: string
          order_id?: string | null
          promotion_id?: string
          restaurant_id?: string | null
          used_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotion_uses_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_uses_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_uses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          applies_to: string
          applies_to_ids: string[] | null
          branch_id: string | null
          created_at: string
          description: string | null
          discount_value: number
          ends_at: string | null
          happy_hour_days: number[] | null
          happy_hour_end: string | null
          happy_hour_start: string | null
          id: string
          is_active: boolean
          is_first_order_only: boolean
          max_discount_amount: number | null
          max_uses: number | null
          max_uses_per_user: number | null
          min_order_amount: number | null
          name: string
          promo_code: string | null
          restaurant_id: string | null
          starts_at: string
          type: string
          updated_at: string
          used_count: number
        }
        Insert: {
          applies_to?: string
          applies_to_ids?: string[] | null
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discount_value?: number
          ends_at?: string | null
          happy_hour_days?: number[] | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          is_active?: boolean
          is_first_order_only?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          name: string
          promo_code?: string | null
          restaurant_id?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
          used_count?: number
        }
        Update: {
          applies_to?: string
          applies_to_ids?: string[] | null
          branch_id?: string | null
          created_at?: string
          description?: string | null
          discount_value?: number
          ends_at?: string | null
          happy_hour_days?: number[] | null
          happy_hour_end?: string | null
          happy_hour_start?: string | null
          id?: string
          is_active?: boolean
          is_first_order_only?: boolean
          max_discount_amount?: number | null
          max_uses?: number | null
          max_uses_per_user?: number | null
          min_order_amount?: number | null
          name?: string
          promo_code?: string | null
          restaurant_id?: string | null
          starts_at?: string
          type?: string
          updated_at?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_scans: {
        Row: {
          created_at: string
          device_hash: string | null
          id: string
          referrer: string | null
          restaurant_id: string
          scanned_at: string
          short_link_id: string
          table_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_hash?: string | null
          id?: string
          referrer?: string | null
          restaurant_id: string
          scanned_at?: string
          short_link_id: string
          table_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_hash?: string | null
          id?: string
          referrer?: string | null
          restaurant_id?: string
          scanned_at?: string
          short_link_id?: string
          table_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "qr_scans_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_scans_short_link_id_fkey"
            columns: ["short_link_id"]
            isOneToOne: false
            referencedRelation: "qr_short_links"
            referencedColumns: ["id"]
          },
        ]
      }
      qr_short_links: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          restaurant_id: string
          table_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          restaurant_id: string
          table_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          restaurant_id?: string
          table_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "qr_short_links_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "qr_short_links_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          created_at: string
          customer_id: string | null
          email: string
          guest_name: string
          id: string
          notes: string | null
          party_size: number
          phone: string | null
          reservation_date: string
          reservation_time: string
          restaurant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          email: string
          guest_name: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reservation_date: string
          reservation_time: string
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          email?: string
          guest_name?: string
          id?: string
          notes?: string | null
          party_size?: number
          phone?: string | null
          reservation_date?: string
          reservation_time?: string
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "restaurant_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_addons: {
        Row: {
          addon_id: string
          created_at: string
          expires_at: string | null
          granted_by: string | null
          granted_via_request_id: string | null
          id: string
          notes: string | null
          quantity: number
          restaurant_id: string
          source: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          addon_id: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          granted_via_request_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          restaurant_id: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          addon_id?: string
          created_at?: string
          expires_at?: string | null
          granted_by?: string | null
          granted_via_request_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          restaurant_id?: string
          source?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_addons_addon_id_fkey"
            columns: ["addon_id"]
            isOneToOne: false
            referencedRelation: "platform_addons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_addons_granted_via_request_id_fkey"
            columns: ["granted_via_request_id"]
            isOneToOne: false
            referencedRelation: "addon_purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_addons_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          label: string | null
          last_check_at: string | null
          last_check_error: string | null
          restaurant_id: string
          updated_at: string
          verification_token: string
          verified: boolean
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          label?: string | null
          last_check_at?: string | null
          last_check_error?: string | null
          restaurant_id: string
          updated_at?: string
          verification_token?: string
          verified?: boolean
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          label?: string | null
          last_check_at?: string | null
          last_check_error?: string | null
          restaurant_id?: string
          updated_at?: string
          verification_token?: string
          verified?: boolean
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_custom_domains_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_customers: {
        Row: {
          auth_user_id: string
          created_at: string
          display_name: string | null
          email: string
          id: string
          phone: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          phone?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_customers_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_members: {
        Row: {
          created_at: string
          id: string
          role: string | null
          restaurant_id: string
          user_id: string
        }
        Insert: {
          role?: string | null
          created_at?: string
          id?: string
          restaurant_id: string
          user_id: string
        }
        Update: {
          role?: string | null
          created_at?: string
          id?: string
          restaurant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_members_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          accent_color: string
          address: string | null
          contact_phone: string | null
          created_at: string
          currency: string
          delivery_area_note: string | null
          delivery_enabled: boolean
          delivery_eta_minutes: number
          delivery_fee: number
          delivery_min_order: number
          free_delivery_min: number | null
          homepage_template: string
          id: string
          logo_url: string | null
          order_page_header_text: string | null
          order_page_logo_url: string | null
          order_page_primary_color: string | null
          order_page_subtext: string | null
          order_page_template: string
          pickup_enabled: boolean
          pickup_eta_minutes: number
          primary_color: string
          qr_color_overrides: Json
          qr_ordering_enabled: boolean
          qr_template: string
          restaurant_id: string | null
          restaurant_name: string
          tagline: string | null
          tax_percentage: number
          updated_at: string
        }
        Insert: {
          accent_color?: string
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          delivery_area_note?: string | null
          delivery_enabled?: boolean
          delivery_eta_minutes?: number
          delivery_fee?: number
          delivery_min_order?: number
          free_delivery_min?: number | null
          homepage_template?: string
          id?: string
          logo_url?: string | null
          order_page_header_text?: string | null
          order_page_logo_url?: string | null
          order_page_primary_color?: string | null
          order_page_subtext?: string | null
          order_page_template?: string
          pickup_enabled?: boolean
          pickup_eta_minutes?: number
          primary_color?: string
          qr_color_overrides?: Json
          qr_ordering_enabled?: boolean
          qr_template?: string
          restaurant_id?: string | null
          restaurant_name?: string
          tagline?: string | null
          tax_percentage?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string
          address?: string | null
          contact_phone?: string | null
          created_at?: string
          currency?: string
          delivery_area_note?: string | null
          delivery_enabled?: boolean
          delivery_eta_minutes?: number
          delivery_fee?: number
          delivery_min_order?: number
          free_delivery_min?: number | null
          homepage_template?: string
          id?: string
          logo_url?: string | null
          order_page_header_text?: string | null
          order_page_logo_url?: string | null
          order_page_primary_color?: string | null
          order_page_subtext?: string | null
          order_page_template?: string
          pickup_enabled?: boolean
          pickup_eta_minutes?: number
          primary_color?: string
          qr_color_overrides?: Json
          qr_ordering_enabled?: boolean
          qr_template?: string
          restaurant_id?: string | null
          restaurant_name?: string
          tagline?: string | null
          tax_percentage?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_settings_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_tables: {
        Row: {
          branch_id: string | null
          capacity: number
          created_at: string
          floor_plan_id: string | null
          id: string
          label: string
          position_x: number | null
          position_y: number | null
          qr_code_url: string | null
          restaurant_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          capacity?: number
          created_at?: string
          floor_plan_id?: string | null
          id?: string
          label: string
          position_x?: number | null
          position_y?: number | null
          qr_code_url?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          capacity?: number
          created_at?: string
          floor_plan_id?: string | null
          id?: string
          label?: string
          position_x?: number | null
          position_y?: number | null
          qr_code_url?: string | null
          restaurant_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_tables_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "floor_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_tables_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          accent_color: string
          address: string | null
          created_at: string
          cuisine_type: string | null
          custom_domain: string | null
          custom_domain_verified: boolean
          custom_domain_verified_at: string | null
          favicon_url: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          onboarded_at: string | null
          onboarding_completed: boolean
          owner_id: string | null
          page_slugs: Json
          phone: string | null
          primary_color: string
          slug: string
          tagline: string | null
          theme_id: string | null
          theme_overrides: Json | null
          updated_at: string
        }
        Insert: {
          accent_color?: string
          address?: string | null
          created_at?: string
          cuisine_type?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean
          custom_domain_verified_at?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          onboarded_at?: string | null
          onboarding_completed?: boolean
          owner_id?: string | null
          page_slugs?: Json
          phone?: string | null
          primary_color?: string
          slug: string
          tagline?: string | null
          theme_id?: string | null
          theme_overrides?: Json | null
          updated_at?: string
        }
        Update: {
          accent_color?: string
          address?: string | null
          created_at?: string
          cuisine_type?: string | null
          custom_domain?: string | null
          custom_domain_verified?: boolean
          custom_domain_verified_at?: string | null
          favicon_url?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          onboarded_at?: string | null
          onboarding_completed?: boolean
          owner_id?: string | null
          page_slugs?: Json
          phone?: string | null
          primary_color?: string
          slug?: string
          tagline?: string | null
          theme_id?: string | null
          theme_overrides?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "restaurants_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "platform_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          restaurant_id: string | null
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          restaurant_id?: string | null
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          restaurant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_branches_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipt_lines: {
        Row: {
          batch_code: string | null
          created_at: string
          expiry_date: string | null
          id: string
          item_id: string
          quantity: number
          receipt_id: string
          restaurant_id: string
          total_cost: number
          unit_cost: number
        }
        Insert: {
          batch_code?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id: string
          quantity?: number
          receipt_id: string
          restaurant_id: string
          total_cost?: number
          unit_cost?: number
        }
        Update: {
          batch_code?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          item_id?: string
          quantity?: number
          receipt_id?: string
          restaurant_id?: string
          total_cost?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipt_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "stock_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_receipts: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          notes: string | null
          received_date: string
          recorded_by: string | null
          reference: string | null
          restaurant_id: string
          supplier_id: string | null
          supplier_name: string | null
          total_cost: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          received_date?: string
          recorded_by?: string | null
          reference?: string | null
          restaurant_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          received_date?: string
          recorded_by?: string | null
          reference?: string | null
          restaurant_id?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      subdomain_pool: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          assigned_restaurant_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          status: string
          subdomain: string
          updated_at: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_restaurant_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          subdomain: string
          updated_at?: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_restaurant_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          status?: string
          subdomain?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_coupons: {
        Row: {
          applies_to_cycles: string[] | null
          applies_to_plans: string[] | null
          code: string
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          is_active: boolean
          max_redemptions: number | null
          min_amount: number
          redemption_count: number
          updated_at: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_cycles?: string[] | null
          applies_to_plans?: string[] | null
          code: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_amount?: number
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_cycles?: string[] | null
          applies_to_plans?: string[] | null
          code?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          is_active?: boolean
          max_redemptions?: number | null
          min_amount?: number
          redemption_count?: number
          updated_at?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      subscription_expiry_notices: {
        Row: {
          acknowledged: boolean
          created_at: string
          id: string
          notice_type: string
          period_end: string | null
          plan: string | null
          restaurant_id: string
        }
        Insert: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          notice_type: string
          period_end?: string | null
          plan?: string | null
          restaurant_id: string
        }
        Update: {
          acknowledged?: boolean
          created_at?: string
          id?: string
          notice_type?: string
          period_end?: string | null
          plan?: string | null
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_expiry_notices_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payments: {
        Row: {
          admin_notes: string | null
          amount: number
          billing_cycle: string
          coupon_code: string | null
          coupon_id: string | null
          created_at: string
          currency: string
          discount_amount: number
          id: string
          notes: string | null
          original_amount: number | null
          payment_method: string
          plan: string
          reference_code: string | null
          restaurant_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          sender_number: string
          status: string
          submitted_by: string | null
          transaction_id: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          amount?: number
          billing_cycle?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string
          plan: string
          reference_code?: string | null
          restaurant_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number: string
          status?: string
          submitted_by?: string | null
          transaction_id: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          billing_cycle?: string
          coupon_code?: string | null
          coupon_id?: string | null
          created_at?: string
          currency?: string
          discount_amount?: number
          id?: string
          notes?: string | null
          original_amount?: number | null
          payment_method?: string
          plan?: string
          reference_code?: string | null
          restaurant_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          sender_number?: string
          status?: string
          submitted_by?: string | null
          transaction_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "subscription_coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payments_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          badge: string | null
          created_at: string
          currency: string
          description: string | null
          feature_accounting: boolean
          feature_ai_images: boolean
          feature_custom_domain: boolean
          feature_floor_plans: boolean
          feature_kds: boolean
          feature_loyalty: boolean
          feature_multi_branch: boolean
          feature_pos: boolean
          feature_promotions: boolean
          features: Json
          features_heading: string | null
          features_visible: boolean
          id: string
          is_active: boolean
          is_public: boolean
          max_branches: number | null
          max_menu_items: number | null
          max_monthly_orders: number | null
          max_staff: number | null
          name: string
          original_price_monthly: number | null
          original_price_yearly: number | null
          price_monthly: number
          price_yearly: number
          prices: Json
          sort_order: number
          tier: string
          updated_at: string
        }
        Insert: {
          badge?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          feature_accounting?: boolean
          feature_ai_images?: boolean
          feature_custom_domain?: boolean
          feature_floor_plans?: boolean
          feature_kds?: boolean
          feature_loyalty?: boolean
          feature_multi_branch?: boolean
          feature_pos?: boolean
          feature_promotions?: boolean
          features?: Json
          features_heading?: string | null
          features_visible?: boolean
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_branches?: number | null
          max_menu_items?: number | null
          max_monthly_orders?: number | null
          max_staff?: number | null
          name: string
          original_price_monthly?: number | null
          original_price_yearly?: number | null
          price_monthly?: number
          price_yearly?: number
          prices?: Json
          sort_order?: number
          tier: string
          updated_at?: string
        }
        Update: {
          badge?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          feature_accounting?: boolean
          feature_ai_images?: boolean
          feature_custom_domain?: boolean
          feature_floor_plans?: boolean
          feature_kds?: boolean
          feature_loyalty?: boolean
          feature_multi_branch?: boolean
          feature_pos?: boolean
          feature_promotions?: boolean
          features?: Json
          features_heading?: string | null
          features_visible?: boolean
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_branches?: number | null
          max_menu_items?: number | null
          max_monthly_orders?: number | null
          max_staff?: number | null
          name?: string
          original_price_monthly?: number | null
          original_price_yearly?: number | null
          price_monthly?: number
          price_yearly?: number
          prices?: Json
          sort_order?: number
          tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: string
          restaurant_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          restaurant_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: string
          restaurant_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: true
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          branch_id: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          phone: string | null
          restaurant_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          restaurant_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          restaurant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          ai_enabled: boolean
          assigned_admin_id: string | null
          category: string
          channel: string
          contact_company: string | null
          created_at: string
          first_response_at: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          last_message_sender: string | null
          priority: string
          rating: string | null
          rating_comment: string | null
          requester_kind: string
          requester_user_id: string | null
          resolved_at: string | null
          restaurant_id: string | null
          source_url: string | null
          status: string
          subject: string | null
          unread_for_agent: number
          unread_for_requester: number
          updated_at: string
          user_agent: string | null
          visitor_email: string | null
          visitor_name: string | null
        }
        Insert: {
          ai_enabled?: boolean
          assigned_admin_id?: string | null
          category?: string
          channel?: string
          contact_company?: string | null
          created_at?: string
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_message_sender?: string | null
          priority?: string
          rating?: string | null
          rating_comment?: string | null
          requester_kind: string
          requester_user_id?: string | null
          resolved_at?: string | null
          restaurant_id?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          unread_for_agent?: number
          unread_for_requester?: number
          updated_at?: string
          user_agent?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Update: {
          ai_enabled?: boolean
          assigned_admin_id?: string | null
          category?: string
          channel?: string
          contact_company?: string | null
          created_at?: string
          first_response_at?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_message_sender?: string | null
          priority?: string
          rating?: string | null
          rating_comment?: string | null
          requester_kind?: string
          requester_user_id?: string | null
          resolved_at?: string | null
          restaurant_id?: string | null
          source_url?: string | null
          status?: string
          subject?: string | null
          unread_for_agent?: number
          unread_for_requester?: number
          updated_at?: string
          user_agent?: string | null
          visitor_email?: string | null
          visitor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_conversations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_knowledge_articles: {
        Row: { id: string; slug: string; title: string; category: string; body: string; is_active: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; slug: string; title: string; category?: string; body: string; is_active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; slug?: string; title?: string; category?: string; body?: string; is_active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          id: string
          is_internal: boolean
          sender_kind: string
          sender_user_id: string | null
        }
        Insert: {
          attachments?: Json
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_kind: string
          sender_user_id?: string | null
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_internal?: boolean
          sender_kind?: string
          sender_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_saved_replies: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          shortcut: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          shortcut?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_settings: {
        Row: {
          auto_reply_enabled: boolean
          ai_enabled: boolean
          ai_extra_instructions: string
          business_hours: Json
          greeting: string
          id: boolean
          offline_message: string
          timezone: string
          updated_at: string
          widget_enabled: boolean
        }
        Insert: {
          auto_reply_enabled?: boolean
          ai_enabled?: boolean
          ai_extra_instructions?: string
          business_hours?: Json
          greeting?: string
          id?: boolean
          offline_message?: string
          timezone?: string
          updated_at?: string
          widget_enabled?: boolean
        }
        Update: {
          auto_reply_enabled?: boolean
          ai_enabled?: boolean
          ai_extra_instructions?: string
          business_hours?: Json
          greeting?: string
          id?: boolean
          offline_message?: string
          timezone?: string
          updated_at?: string
          widget_enabled?: boolean
        }
        Relationships: []
      }
      tenant_contact_submissions: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          restaurant_id: string
          status: string
          subject: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          restaurant_id: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          restaurant_id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_contact_submissions_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      kitchen_updates: {
        Row: {
          id: string
          restaurant_id: string
          order_id: string
          branch_id: string | null
          author_id: string | null
          message: string
          extra_minutes: number | null
          created_at: string
        }
        Insert: {
          id?: string
          restaurant_id: string
          order_id: string
          branch_id?: string | null
          author_id?: string | null
          message: string
          extra_minutes?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          restaurant_id?: string
          order_id?: string
          branch_id?: string | null
          author_id?: string | null
          message?: string
          extra_minutes?: number | null
          created_at?: string
        }
        Relationships: []
      }
      waiter_calls: {
        Row: {
          created_at: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          restaurant_id: string | null
          status: string
          table_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          restaurant_id?: string | null
          status?: string
          table_id: string
        }
        Update: {
          created_at?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          restaurant_id?: string | null
          status?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waiter_calls_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waiter_calls_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "restaurant_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_inventory_adjustments: {
        Args: {
          _lines: Json
          _notes: string
          _reason: string
          _reference: string
          _restaurant_id: string
        }
        Returns: number
      }
      can_write_order_pricing: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      canonical_billing_cycle_for_plan: {
        Args: { _plan: string }
        Returns: string
      }
      current_restaurant_customer_id: {
        Args: { _restaurant_id: string }
        Returns: string
      }
      current_restaurant_id: { Args: never; Returns: string }
      kitchen_menu: { Args: { _restaurant: string }; Returns: Json }
      kitchen_set_availability: { Args: { _restaurant: string; _item: string; _available: boolean }; Returns: undefined }
      kitchen_set_eta: { Args: { _restaurant: string; _order: string; _minutes: number }; Returns: undefined }
      kitchen_send_update: { Args: { _restaurant: string; _order: string; _message: string; _extra_minutes?: number }; Returns: string }
      kitchen_history: { Args: { _restaurant: string; _days?: number; _offset?: number }; Returns: Json }
      kitchen_report: { Args: { _restaurant: string; _days?: number }; Returns: Json }
      pos_checkout: {
        Args: { _restaurant: string; _request_key: string; _payload: Json }
        Returns: Json
      }
      staff_set_order_status: {
        Args: { _restaurant: string; _order: string; _status: string; _expected_status: string }
        Returns: Json
      }
      pos_settle_order: {
        Args: { _restaurant: string; _order: string; _payment: string; _tax_rate: number; _discount: number }
        Returns: Json
      }
      get_restaurant_subscription_access: {
        Args: { _restaurant_id: string }
        Returns: {
          plan: string
          status: string
          current_period_end: string | null
        }[]
      }
      get_loyalty_balance: {
        Args: { _restaurant_id?: string; _user_id: string }
        Returns: number
      }
      get_owner_sitemap_menu_items: {
        Args: { _restaurant_id: string }
        Returns: {
          custom_slug: string
          id: string
          is_available: boolean
          updated_at: string
        }[]
      }
      get_owner_sitemap_restaurant: {
        Args: { _restaurant_id: string }
        Returns: {
          created_at: string
          custom_domain: string
          custom_domain_verified: boolean
          id: string
          page_slugs: Json
          slug: string
          updated_at: string
        }[]
      }
      get_public_order: { Args: { _order_id: string }; Returns: Json }
      get_public_order_items: {
        Args: { _order_id: string }
        Returns: {
          id: string
          item_name: string
          item_price: number
          notes: string
          quantity: number
          status: string
        }[]
      }
      has_active_addon: {
        Args: { _feature_key: string; _restaurant_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_promotion_usage: {
        Args: { promo_id: string }
        Returns: undefined
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_restaurant_owner: {
        Args: { _restaurant_id: string }
        Returns: boolean
      }
      place_customer_order: {
        Args: {
          _client_timezone?: string
          _customer_name?: string
          _customer_phone?: string
          _delivery_address?: string
          _delivery_instructions?: string
          _items: Json
          _loyalty_points?: number
          _order_type?: string
          _promotion_id?: string
          _restaurant_id: string
          _table_id?: string
        }
        Returns: string
      }
      place_guest_order: {
        Args: {
          _customer_name: string
          _customer_phone: string
          _delivery_address: string
          _delivery_instructions: string
          _items: Json
          _order_type: string
          _restaurant_id: string
        }
        Returns: string
      }
      process_subscription_expiries: {
        Args: never
        Returns: {
          expired: number
          warned: number
        }[]
      }
      receive_stock_batch: {
        Args: {
          _lines: Json
          _notes: string
          _received_date: string
          _reference: string
          _restaurant_id: string
          _supplier_id: string
          _supplier_name: string
        }
        Returns: string
      }
      reset_kitchen_ticket_seq: { Args: never; Returns: undefined }
      resolve_qr_short_link: {
        Args: {
          _code: string
          _device_hash?: string
          _referrer?: string
          _user_agent?: string
        }
        Returns: {
          code: string
          label: string
          restaurant_id: string
          table_id: string
        }[]
      }
      subscription_period_months: {
        Args: { _cycle: string; _plan: string }
        Returns: number
      }
      support_can_access_conversation: {
        Args: { _conversation_id: string }
        Returns: boolean
      }
      support_resume_ai: { Args: { _conversation_id: string }; Returns: undefined }
      support_typing_status: { Args: { _conversation_id: string }; Returns: Json }
      support_set_agent_typing: { Args: { _conversation_id: string; _typing?: boolean }; Returns: undefined }
      support_mark_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      support_object_conversation: { Args: { _name: string }; Returns: string }
      support_rate_conversation: {
        Args: { _comment?: string; _conversation_id: string; _rating: string }
        Returns: undefined
      }
      support_start_conversation: {
        Args: {
          _category?: string
          _message: string
          _source_url?: string
          _user_agent?: string
          _visitor_email?: string
          _visitor_name?: string
        }
        Returns: string
      }
      validate_addon_coupon: {
        Args: {
          _addon_id: string
          _amount: number
          _billing_type: string
          _code: string
        }
        Returns: {
          code: string
          coupon_id: string
          description: string
          discount_amount: number
          discount_type: string
          discount_value: number
          final_amount: number
          reason: string
          valid: boolean
        }[]
      }
      validate_subscription_coupon: {
        Args: { _amount: number; _code: string; _cycle: string; _plan: string }
        Returns: {
          code: string
          coupon_id: string
          description: string
          discount_amount: number
          discount_type: string
          discount_value: number
          final_amount: number
          reason: string
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "kitchen"
        | "server"
        | "customer"
        | "manager"
        | "waiter"
        | "owner"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "expired"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "admin",
        "kitchen",
        "server",
        "customer",
        "manager",
        "waiter",
        "owner",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "expired",
      ],
    },
  },
} as const

