// Supabase 가 만든 DB 타입. 손으로 고치지 않는다.
// 마이그레이션을 바꾸면 다시 만든다: Supabase MCP generate_typescript_types 또는
// npx supabase@3.2.0 gen types typescript --project-id szqxjeegveouzjorkvbj > shared/lib/supabase/database.types.ts
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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          entry_id: string
          hidden_at: string | null
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          entry_id: string
          hidden_at?: string | null
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          entry_id?: string
          hidden_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entries: {
        Row: {
          bio: string | null
          board: Database["public"]["Enums"]["board_kind"]
          created_at: string
          deleted_at: string | null
          hidden_at: string | null
          id: string
          instagram: string | null
          last_pick_at: string | null
          owner_id: string
          pet_name: string
          pick_count: number
          round_id: number
          source_entry_id: string | null
          threads: string | null
          updated_at: string
          view_count: number
          youtube: string | null
        }
        Insert: {
          bio?: string | null
          board: Database["public"]["Enums"]["board_kind"]
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: string
          instagram?: string | null
          last_pick_at?: string | null
          owner_id: string
          pet_name: string
          pick_count?: number
          round_id: number
          source_entry_id?: string | null
          threads?: string | null
          updated_at?: string
          view_count?: number
          youtube?: string | null
        }
        Update: {
          bio?: string | null
          board?: Database["public"]["Enums"]["board_kind"]
          created_at?: string
          deleted_at?: string | null
          hidden_at?: string | null
          id?: string
          instagram?: string | null
          last_pick_at?: string | null
          owner_id?: string
          pet_name?: string
          pick_count?: number
          round_id?: number
          source_entry_id?: string | null
          threads?: string | null
          updated_at?: string
          view_count?: number
          youtube?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "entries_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "entries_source_entry_id_fkey"
            columns: ["source_entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_photos: {
        Row: {
          entry_id: string
          path: string
          position: number
          thumb_path: string
        }
        Insert: {
          entry_id: string
          path: string
          position: number
          thumb_path: string
        }
        Update: {
          entry_id?: string
          path?: string
          position?: number
          thumb_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_photos_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      entry_views: {
        Row: {
          entry_id: string
          kst_date: string
          viewer_key: string
        }
        Insert: {
          entry_id: string
          kst_date: string
          viewer_key: string
        }
        Update: {
          entry_id?: string
          kst_date?: string
          viewer_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "entry_views_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          emailed_at: string | null
          id: number
          kind: string
          payload: Json
          pushed_at: string | null
          read_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emailed_at?: string | null
          id?: never
          kind: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emailed_at?: string | null
          id?: never
          kind?: string
          payload?: Json
          pushed_at?: string | null
          read_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      picks: {
        Row: {
          board: Database["public"]["Enums"]["board_kind"]
          created_at: string
          entry_id: string
          id: number
          kst_date: string
          voter_id: string
        }
        Insert: {
          board: Database["public"]["Enums"]["board_kind"]
          created_at?: string
          entry_id: string
          id?: never
          kst_date: string
          voter_id: string
        }
        Update: {
          board?: Database["public"]["Enums"]["board_kind"]
          created_at?: string
          entry_id?: string
          id?: never
          kst_date?: string
          voter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "picks_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email_opt_in: boolean
          id: string
          is_admin: boolean
          nickname: string
        }
        Insert: {
          created_at?: string
          email_opt_in?: boolean
          id: string
          is_admin?: boolean
          nickname: string
        }
        Update: {
          created_at?: string
          email_opt_in?: boolean
          id?: string
          is_admin?: boolean
          nickname?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: number
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: never
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: never
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      rank_snapshots: {
        Row: {
          board: Database["public"]["Enums"]["board_kind"]
          entry_id: string
          kst_date: string
          rank: number
          round_id: number
        }
        Insert: {
          board: Database["public"]["Enums"]["board_kind"]
          entry_id: string
          kst_date: string
          rank: number
          round_id: number
        }
        Update: {
          board?: Database["public"]["Enums"]["board_kind"]
          entry_id?: string
          kst_date?: string
          rank?: number
          round_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "rank_snapshots_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rank_snapshots_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      sns_daily: {
        Row: {
          kst_date: string
          n: number
        }
        Insert: {
          kst_date: string
          n?: number
        }
        Update: {
          kst_date?: string
          n?: number
        }
        Relationships: []
      }
      sns_events: {
        Row: {
          created_at: string
          entry_id: string
          kind: string
          kst_date: string
          place: string
          viewer_key: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          kind: string
          kst_date: string
          place: string
          viewer_key: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          kind?: string
          kst_date?: string
          place?: string
          viewer_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "sns_events_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          id: number
          reason: string | null
          reporter_id: string
          resolved_at: string | null
          target: Database["public"]["Enums"]["report_target"]
          target_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          reason?: string | null
          reporter_id: string
          resolved_at?: string | null
          target: Database["public"]["Enums"]["report_target"]
          target_id: string
        }
        Update: {
          created_at?: string
          id?: never
          reason?: string | null
          reporter_id?: string
          resolved_at?: string | null
          target?: Database["public"]["Enums"]["report_target"]
          target_id?: string
        }
        Relationships: []
      }
      round_results: {
        Row: {
          board: Database["public"]["Enums"]["board_kind"]
          entry_id: string | null
          rank: number
          role: Database["public"]["Enums"]["result_role"] | null
          round_id: number
          votes: number
        }
        Insert: {
          board: Database["public"]["Enums"]["board_kind"]
          entry_id?: string | null
          rank: number
          role?: Database["public"]["Enums"]["result_role"] | null
          round_id: number
          votes: number
        }
        Update: {
          board?: Database["public"]["Enums"]["board_kind"]
          entry_id?: string | null
          rank?: number
          role?: Database["public"]["Enums"]["result_role"] | null
          round_id?: number
          votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "round_results_entry_id_fkey"
            columns: ["entry_id"]
            isOneToOne: false
            referencedRelation: "entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "round_results_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      rounds: {
        Row: {
          ends_at: string
          finalized_at: string | null
          id: number
          kind: Database["public"]["Enums"]["round_kind"]
          month: string
          seq: number
          starts_at: string
        }
        Insert: {
          ends_at: string
          finalized_at?: string | null
          id?: never
          kind: Database["public"]["Enums"]["round_kind"]
          month: string
          seq: number
          starts_at: string
        }
        Update: {
          ends_at?: string
          finalized_at?: string | null
          id?: never
          kind?: Database["public"]["Enums"]["round_kind"]
          month?: string
          seq?: number
          starts_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_comment: {
        Args: { p_body: string; p_entry_id: string }
        Returns: string
      }
      board_entries: {
        Args: {
          p_board: Database["public"]["Enums"]["board_kind"]
          p_limit?: number
          p_offset?: number
          p_q?: string
          p_seed?: string
          p_sort?: string
        }
        Returns: {
          bio: string
          created_at: string
          id: string
          is_mine: boolean
          pet_name: string
          photo_count: number
          pick_count: number
          picked_today: boolean
          prev_rank: number
          rank: number
          thumb_path: string
          view_count: number
        }[]
      }
      caller_is_anonymous: { Args: never; Returns: boolean }
      caller_is_member: { Args: never; Returns: boolean }
      can_add_push_subscription: { Args: never; Returns: boolean }
      can_upload_photo: { Args: { p_name: string }; Returns: boolean }
      cast_pick: { Args: { p_entry_id: string }; Returns: Json }
      check_entry_fields: {
        Args: {
          p_bio: string
          p_instagram: string
          p_pet_name: string
          p_threads: string
          p_youtube: string
        }
        Returns: undefined
      }
      check_photos: {
        Args: { p_owner: string; p_photos: Json }
        Returns: undefined
      }
      create_entry: {
        Args: {
          p_bio: string
          p_board: Database["public"]["Enums"]["board_kind"]
          p_instagram: string
          p_pet_name: string
          p_photos: Json
          p_threads: string
          p_youtube: string
        }
        Returns: string
      }
      current_round: {
        Args: never
        Returns: {
          ends_at: string
          finalized_at: string | null
          id: number
          kind: Database["public"]["Enums"]["round_kind"]
          month: string
          seq: number
          starts_at: string
        }
        SetofOptions: {
          from: "*"
          to: "rounds"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_comment: { Args: { p_comment_id: string }; Returns: undefined }
      delete_entry: { Args: { p_entry_id: string }; Returns: undefined }
      ensure_month_rounds: { Args: { p_month?: string }; Returns: undefined }
      entry_comments: {
        Args: { p_entry_id: string; p_limit?: number; p_offset?: number }
        Returns: {
          body: string
          created_at: string
          id: string
          is_entry_owner: boolean
          is_mine: boolean
          nickname: string
        }[]
      }
      get_entry: { Args: { p_entry_id: string }; Returns: Json }
      get_featured: { Args: never; Returns: Json }
      get_featured_at: { Args: { p_at: string }; Returns: Json }
      has_hidden_chars: { Args: { t: string }; Returns: boolean }
      is_blind: {
        Args: { r: Database["public"]["Tables"]["rounds"]["Row"] }
        Returns: boolean
      }
      kst_today: { Args: never; Returns: string }
      my_entries: { Args: never; Returns: Json }
      merge_anon_picks: {
        Args: { p_anon: string; p_target: string }
        Returns: number
      }
      my_picks_today: {
        Args: never
        Returns: {
          board: Database["public"]["Enums"]["board_kind"]
          picked: string[]
          remaining: number
        }[]
      }
      photo_in_use: { Args: { p_name: string }; Returns: boolean }
      record_view: {
        Args: { p_entry_id: string; p_viewer_key: string }
        Returns: boolean
      }
      report: {
        Args: {
          p_reason?: string
          p_target: Database["public"]["Enums"]["report_target"]
          p_target_id: string
        }
        Returns: undefined
      }
      record_auth: {
        Args: { p_detail: string; p_kind: string }
        Returns: undefined
      }
      record_sns: {
        Args: {
          p_entry_ids: string[]
          p_kind: string
          p_place: string
          p_viewer_key: string
        }
        Returns: number
      }
      require_member: { Args: never; Returns: string }
      snapshot_ranks: { Args: never; Returns: number }
      update_entry: {
        Args: {
          p_bio: string
          p_entry_id: string
          p_instagram: string
          p_pet_name: string
          p_photos?: Json
          p_threads: string
          p_youtube: string
        }
        Returns: Json
      }
      valid_sns: { Args: { kind: string; url: string }; Returns: boolean }
    }
    Enums: {
      board_kind: "dog" | "cat"
      report_target: "entry" | "comment"
      result_role: "center" | "finalist" | "debut"
      round_kind: "weekly" | "final"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      board_kind: ["dog", "cat"],
      report_target: ["entry", "comment"],
      result_role: ["center", "finalist", "debut"],
      round_kind: ["weekly", "final"],
    },
  },
} as const
