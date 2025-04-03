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
      budget_history: {
        Row: {
          change_date: string | null
          change_type: string | null
          changes: Json | null
          created_at: string
          id: number
          mis: string
          previous_version: Json | null
          updated_version: Json | null
          user_id: number | null
        }
        Insert: {
          change_date?: string | null
          change_type?: string | null
          changes?: Json | null
          created_at?: string
          id?: number
          mis: string
          previous_version?: Json | null
          updated_version?: Json | null
          user_id?: number | null
        }
        Update: {
          change_date?: string | null
          change_type?: string | null
          changes?: Json | null
          created_at?: string
          id?: number
          mis?: string
          previous_version?: Json | null
          updated_version?: Json | null
          user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      budget_na853_split: {
        Row: {
          created_at: string
          id: number
          mis: string
          splits: Json | null
          sum: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          mis: string
          splits?: Json | null
          sum?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          mis?: string
          splits?: Json | null
          sum?: number | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          attachments: string[] | null
          comments: string | null
          contact_number: string | null
          created_at: string
          department: string | null
          expenditure_type: string | null
          id: number
          is_correction: boolean | null
          original_protocol_date: string | null
          original_protocol_number: string | null
          project_id: string | null
          project_na853: string | null
          protocol_date: string | null
          protocol_number: string | null
          protocol_number_input: string | null
          recipients: Json | null
          status: string | null
          total_amount: number | null
          unit: string | null
          user_id: number | null
          user_name: string | null
        }
        Insert: {
          attachments?: string[] | null
          comments?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          expenditure_type?: string | null
          id?: number
          is_correction?: boolean | null
          original_protocol_date?: string | null
          original_protocol_number?: string | null
          project_id?: string | null
          project_na853?: string | null
          protocol_date?: string | null
          protocol_number?: string | null
          protocol_number_input?: string | null
          recipients?: Json | null
          status?: string | null
          total_amount?: number | null
          unit?: string | null
          user_id?: number | null
          user_name?: string | null
        }
        Update: {
          attachments?: string[] | null
          comments?: string | null
          contact_number?: string | null
          created_at?: string
          department?: string | null
          expenditure_type?: string | null
          id?: number
          is_correction?: boolean | null
          original_protocol_date?: string | null
          original_protocol_number?: string | null
          project_id?: string | null
          project_na853?: string | null
          protocol_date?: string | null
          protocol_number?: string | null
          protocol_number_input?: string | null
          recipients?: Json | null
          status?: string | null
          total_amount?: number | null
          unit?: string | null
          user_id?: number | null
          user_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      Monada: {
        Row: {
          address: Json | null
          created_at: string
          email: string | null
          id: number
          manager: Json | null
          unit: string
          unit_name: Json | null
        }
        Insert: {
          address?: Json | null
          created_at?: string
          email?: string | null
          id?: number
          manager?: Json | null
          unit: string
          unit_name?: Json | null
        }
        Update: {
          address?: Json | null
          created_at?: string
          email?: string | null
          id?: number
          manager?: Json | null
          unit?: string
          unit_name?: Json | null
        }
        Relationships: []
      }
      Project: {
        Row: {
          agencies: string[] | null
          created_at: string
          expenditure_types: string[] | null
          id: number
          manager: string | null
          mis: string
          name: string | null
          order: string | null
          status: string | null
          total_budget: number | null
        }
        Insert: {
          agencies?: string[] | null
          created_at?: string
          expenditure_types?: string[] | null
          id?: number
          manager?: string | null
          mis: string
          name?: string | null
          order?: string | null
          status?: string | null
          total_budget?: number | null
        }
        Update: {
          agencies?: string[] | null
          created_at?: string
          expenditure_types?: string[] | null
          id?: number
          manager?: string | null
          mis?: string
          name?: string | null
          order?: string | null
          status?: string | null
          total_budget?: number | null
        }
        Relationships: []
      }
      recipients: {
        Row: {
          afm: string | null
          created_at: string
          fathername: string | null
          firstname: string | null
          id: number
          lastname: string | null
        }
        Insert: {
          afm?: string | null
          created_at?: string
          fathername?: string | null
          firstname?: string | null
          id?: number
          lastname?: string | null
        }
        Update: {
          afm?: string | null
          created_at?: string
          fathername?: string | null
          firstname?: string | null
          id?: number
          lastname?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          department: string | null
          email: string
          hashed_password: string | null
          id: number
          last_login: string | null
          name: string | null
          role: string | null
          telephone: number | null
          units: string[] | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email: string
          hashed_password?: string | null
          id?: number
          last_login?: string | null
          name?: string | null
          role?: string | null
          telephone?: number | null
          units?: string[] | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          hashed_password?: string | null
          id?: number
          last_login?: string | null
          name?: string | null
          role?: string | null
          telephone?: number | null
          units?: string[] | null
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