// Supabase 가 만든 DB 타입. 손으로 고치지 않는다.
// 마이그레이션을 바꾸면 다시 만든다: Supabase MCP generate_typescript_types 또는
// npx supabase@3.2.0 gen types typescript --project-id szqxjeegveouzjorkvbj > shared/lib/supabase/database.types.ts


export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_actions": {
                  Row: {
                    "action": string,"actor_id": string,"created_at": string,"detail": Json | null,"id": number,"target": string,"target_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id": string,"created_at"?: string,"detail"?: Json | null,"id"?: never,"target": string,"target_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string,"created_at"?: string,"detail"?: Json | null,"id"?: never,"target"?: string,"target_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"anon_ip_daily": {
                  Row: {
                    "ip_hash": string,"kst_date": string,"n": number
                  }
                  ComputedFields: never
                  Insert: {
                    "ip_hash": string,"kst_date": string,"n"?: number
                  }
                  Update: {
                    "ip_hash"?: string,"kst_date"?: string,"n"?: number
                  }
                  Relationships: [
                    
                  ]
                },"auth_daily": {
                  Row: {
                    "detail": string,"kind": string,"kst_date": string,"n": number
                  }
                  ComputedFields: never
                  Insert: {
                    "detail": string,"kind": string,"kst_date": string,"n"?: number
                  }
                  Update: {
                    "detail"?: string,"kind"?: string,"kst_date"?: string,"n"?: number
                  }
                  Relationships: [
                    
                  ]
                },"comments": {
                  Row: {
                    "author_id": string,"body": string,"created_at": string,"deleted_at": string | null,"entry_id": string,"hidden_at": string | null,"id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id": string,"body": string,"created_at"?: string,"deleted_at"?: string | null,"entry_id": string,"hidden_at"?: string | null,"id"?: string
                  }
                  Update: {
                    "author_id"?: string,"body"?: string,"created_at"?: string,"deleted_at"?: string | null,"entry_id"?: string,"hidden_at"?: string | null,"id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"debut_photos": {
                  Row: {
                    "created_at": string,"entry_id": string,"path": string,"position": number,"thumb_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_id": string,"path": string,"position": number,"thumb_path": string
                  }
                  Update: {
                    "created_at"?: string,"entry_id"?: string,"path"?: string,"position"?: number,"thumb_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "debut_photos_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"entries": {
                  Row: {
                    "bio": string | null,"board": Database["public"]['Enums']["board_kind"],"created_at": string,"deleted_at": string | null,"hidden_at": string | null,"id": string,"instagram": string | null,"last_pick_at": string | null,"owner_id": string,"pet_name": string,"pick_count": number,"round_id": number,"source_entry_id": string | null,"threads": string | null,"updated_at": string,"view_count": number,"youtube": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string | null,"board": Database["public"]['Enums']["board_kind"],"created_at"?: string,"deleted_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"instagram"?: string | null,"last_pick_at"?: string | null,"owner_id": string,"pet_name": string,"pick_count"?: number,"round_id": number,"source_entry_id"?: string | null,"threads"?: string | null,"updated_at"?: string,"view_count"?: number,"youtube"?: string | null
                  }
                  Update: {
                    "bio"?: string | null,"board"?: Database["public"]['Enums']["board_kind"],"created_at"?: string,"deleted_at"?: string | null,"hidden_at"?: string | null,"id"?: string,"instagram"?: string | null,"last_pick_at"?: string | null,"owner_id"?: string,"pet_name"?: string,"pick_count"?: number,"round_id"?: number,"source_entry_id"?: string | null,"threads"?: string | null,"updated_at"?: string,"view_count"?: number,"youtube"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entries_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entries_source_entry_id_fkey"
      columns: ["source_entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"entry_photos": {
                  Row: {
                    "entry_id": string,"path": string,"position": number,"thumb_path": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entry_id": string,"path": string,"position": number,"thumb_path": string
                  }
                  Update: {
                    "entry_id"?: string,"path"?: string,"position"?: number,"thumb_path"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_photos_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"entry_views": {
                  Row: {
                    "entry_id": string,"kst_date": string,"viewer_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "entry_id": string,"kst_date": string,"viewer_key": string
                  }
                  Update: {
                    "entry_id"?: string,"kst_date"?: string,"viewer_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "entry_views_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"ip_salt": {
                  Row: {
                    "id": number,"salt": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: number,"salt"?: string
                  }
                  Update: {
                    "id"?: number,"salt"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"emailed_at": string | null,"id": number,"kind": string,"payload": NonNullable<Json>,"pushed_at": string | null,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"emailed_at"?: string | null,"id"?: never,"kind": string,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"emailed_at"?: string | null,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"pushed_at"?: string | null,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"picks": {
                  Row: {
                    "board": Database["public"]['Enums']["board_kind"],"created_at": string,"entry_id": string,"id": number,"kst_date": string,"voter_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "board": Database["public"]['Enums']["board_kind"],"created_at"?: string,"entry_id": string,"id"?: never,"kst_date": string,"voter_id"?: string | null
                  }
                  Update: {
                    "board"?: Database["public"]['Enums']["board_kind"],"created_at"?: string,"entry_id"?: string,"id"?: never,"kst_date"?: string,"voter_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "picks_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email_opt_in": boolean,"id": string,"is_admin": boolean,"nickname": string,"nickname_changed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_opt_in"?: boolean,"id": string,"is_admin"?: boolean,"nickname": string,"nickname_changed_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"email_opt_in"?: boolean,"id"?: string,"is_admin"?: boolean,"nickname"?: string,"nickname_changed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": number,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: never,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: never,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"rank_snapshots": {
                  Row: {
                    "board": Database["public"]['Enums']["board_kind"],"entry_id": string,"kst_date": string,"rank": number,"round_id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "board": Database["public"]['Enums']["board_kind"],"entry_id": string,"kst_date": string,"rank": number,"round_id": number
                  }
                  Update: {
                    "board"?: Database["public"]['Enums']["board_kind"],"entry_id"?: string,"kst_date"?: string,"rank"?: number,"round_id"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "rank_snapshots_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rank_snapshots_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": number,"reason": string | null,"reporter_id": string,"resolved_at": string | null,"target": Database["public"]['Enums']["report_target"],"target_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"reason"?: string | null,"reporter_id": string,"resolved_at"?: string | null,"target": Database["public"]['Enums']["report_target"],"target_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"reason"?: string | null,"reporter_id"?: string,"resolved_at"?: string | null,"target"?: Database["public"]['Enums']["report_target"],"target_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"round_results": {
                  Row: {
                    "board": Database["public"]['Enums']["board_kind"],"entry_id": string | null,"rank": number,"role": Database["public"]['Enums']["result_role"] | null,"round_id": number,"votes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "board": Database["public"]['Enums']["board_kind"],"entry_id"?: string | null,"rank": number,"role"?: Database["public"]['Enums']["result_role"] | null,"round_id": number,"votes": number
                  }
                  Update: {
                    "board"?: Database["public"]['Enums']["board_kind"],"entry_id"?: string | null,"rank"?: number,"role"?: Database["public"]['Enums']["result_role"] | null,"round_id"?: number,"votes"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "round_results_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "round_results_round_id_fkey"
      columns: ["round_id"]
isOneToOne: false
      referencedRelation: "rounds"
      referencedColumns: ["id"]
    }
                  ]
                },"rounds": {
                  Row: {
                    "ends_at": string,"finalized_at": string | null,"id": number,"kind": Database["public"]['Enums']["round_kind"],"month": string,"seq": number,"starts_at": string,"is_blind": boolean | null,"result_exposure_over": boolean | null
                  }
                  ComputedFields: "is_blind" | "result_exposure_over"
                  Insert: {
                    "ends_at": string,"finalized_at"?: string | null,"id"?: never,"kind": Database["public"]['Enums']["round_kind"],"month": string,"seq": number,"starts_at": string
                  }
                  Update: {
                    "ends_at"?: string,"finalized_at"?: string | null,"id"?: never,"kind"?: Database["public"]['Enums']["round_kind"],"month"?: string,"seq"?: number,"starts_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sns_daily": {
                  Row: {
                    "kst_date": string,"n": number
                  }
                  ComputedFields: never
                  Insert: {
                    "kst_date": string,"n"?: number
                  }
                  Update: {
                    "kst_date"?: string,"n"?: number
                  }
                  Relationships: [
                    
                  ]
                },"sns_events": {
                  Row: {
                    "created_at": string,"entry_id": string,"kind": string,"kst_date": string,"place": string,"viewer_key": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"entry_id": string,"kind": string,"kst_date": string,"place": string,"viewer_key": string
                  }
                  Update: {
                    "created_at"?: string,"entry_id"?: string,"kind"?: string,"kst_date"?: string,"place"?: string,"viewer_key"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "sns_events_entry_id_fkey"
      columns: ["entry_id"]
isOneToOne: false
      referencedRelation: "entries"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "add_comment":
{ Args: { "p_body": string,"p_entry_id": string }; Returns: string
                           },
"admin_dismiss":
{ Args: { "p_target": Database["public"]['Enums']["report_target"],"p_target_id": string }; Returns: undefined
                           },
"admin_recalculate":
{ Args: { "p_round_id": number }; Returns: Json
                           },
"admin_recent_hidden":
{ Args: { "p_days"?: number }; Returns: {
              "author_name": string,"board": Database["public"]['Enums']["board_kind"],"body": string,"entry_id": string,"hidden_at": string,"pet_name": string,"target": Database["public"]['Enums']["report_target"],"target_id": string,"thumb_path": string
            }[]
                           },
"admin_reports":
{ Args: { "p_limit"?: number }; Returns: {
              "author_id": string,"author_name": string,"board": Database["public"]['Enums']["board_kind"],"body": string,"deleted": boolean,"entry_id": string,"hidden": boolean,"last_at": string,"pet_name": string,"reasons": (string)[],"reports": number,"target": Database["public"]['Enums']["report_target"],"target_id": string,"thumb_path": string
            }[]
                           },
"admin_rounds":
{ Args: { "p_limit"?: number }; Returns: {
              "ends_at": string,"exposure_over": boolean,"finalized_at": string,"id": number,"kind": Database["public"]['Enums']["round_kind"],"month": string,"results": number,"seq": number,"tops": Json
            }[]
                           },
"admin_set_hidden":
{ Args: { "p_hidden": boolean,"p_target": Database["public"]['Enums']["report_target"],"p_target_id": string }; Returns: undefined
                           },
"board_entries":
{ Args: { "p_board": Database["public"]['Enums']["board_kind"],"p_limit"?: number,"p_offset"?: number,"p_q"?: string,"p_seed"?: string,"p_sort"?: string }; Returns: {
              "bio": string,"created_at": string,"id": string,"is_mine": boolean,"pet_name": string,"photo_count": number,"pick_count": number,"picked_today": boolean,"prev_rank": number,"rank": number,"thumb_path": string,"view_count": number
            }[]
                           },
"caller_is_anonymous":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"caller_is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_add_push_subscription":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"can_upload_photo":
{ Args: { "p_name": string }; Returns: boolean
                           },
"cast_pick":
{ Args: { "p_entry_id": string }; Returns: Json
                           },
"check_entry_fields":
{ Args: { "p_bio": string,"p_instagram": string,"p_pet_name": string,"p_threads": string,"p_youtube": string }; Returns: undefined
                           },
"check_photo_set":
{ Args: { "p_max": number,"p_min": number,"p_owner": string,"p_photos": Json }; Returns: undefined
                           },
"check_photos":
{ Args: { "p_owner": string,"p_photos": Json }; Returns: undefined
                           },
"client_ip_hash":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"count_view":
{ Args: { "p_entry_id": string,"p_token": string,"p_viewer": string }; Returns: boolean
                           },
"create_entry":
{ Args: { "p_bio": string,"p_board": Database["public"]['Enums']["board_kind"],"p_instagram": string,"p_pet_name": string,"p_photos": Json,"p_threads": string,"p_youtube": string }; Returns: string
                           },
"current_round":
{ Args: Record<PropertyKey, never>; Returns: {
              "ends_at": string,
"finalized_at": string | null,
"id": number,
"kind": Database["public"]['Enums']["round_kind"],
"month": string,
"seq": number,
"starts_at": string
            }
                          SetofOptions: {
        from: "*"
        to: "rounds"
        isOneToOne: true
        isSetofReturn: false
      } },
"delete_comment":
{ Args: { "p_comment_id": string }; Returns: undefined
                           },
"delete_entry":
{ Args: { "p_entry_id": string }; Returns: undefined
                           },
"delete_today_picks":
{ Args: { "p_uid": string }; Returns: number
                           },
"dispatch_queue":
{ Args: { "p_limit"?: number }; Returns: {
              "email": string,"id": number,"kind": string,"need_email": boolean,"need_push": boolean,"payload": Json,"user_id": string
            }[]
                           },
"dispatch_token_ok":
{ Args: { "p_token": string }; Returns: boolean
                           },
"ensure_month_rounds":
{ Args: { "p_month"?: string }; Returns: undefined
                           },
"entry_comments":
{ Args: { "p_entry_id": string,"p_limit"?: number,"p_offset"?: number }; Returns: {
              "body": string,"created_at": string,"id": string,"is_entry_owner": boolean,"is_mine": boolean,"nickname": string,"total": number
            }[]
                           },
"finalize_due_rounds":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"finalize_round":
{ Args: { "p_round_id": number }; Returns: number
                           },
"get_entry":
{ Args: { "p_entry_id": string }; Returns: Json
                           },
"get_featured":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_featured_at":
{ Args: { "p_at": string }; Returns: Json
                           },
"hall_of_fame":
{ Args: { "p_months"?: number }; Returns: Json
                           },
"has_banned_word":
{ Args: { "p_text": string }; Returns: boolean
                           },
"has_hidden_chars":
{ Args: { "t": string }; Returns: boolean
                           },
"ip_pick_limit":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"is_blind":
{ Args: { "r": Omit<Database["public"]['Tables']["rounds"]['Row'], Database["public"]['Tables']["rounds"]['ComputedFields']> }; Returns: boolean
                           },
"is_debut":
{ Args: { "p_entry_id": string }; Returns: boolean
                           },
"kick_dispatch":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"kst_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mark_dispatched":
{ Args: { "p_channel": string,"p_ids": (number)[] }; Returns: number
                           },
"merge_anon_picks":
{ Args: { "p_anon": string,"p_target": string }; Returns: number
                           },
"midnight_jobs":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_entries":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_entries_left":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_picks_today":
{ Args: Record<PropertyKey, never>; Returns: {
              "board": Database["public"]['Enums']["board_kind"],"picked": (string)[],"remaining": number
            }[]
                           },
"photo_in_use":
{ Args: { "p_name": string }; Returns: boolean
                           },
"prepare_final":
{ Args: { "p_month"?: string }; Returns: number
                           },
"purge_bot_picks":
{ Args: { "p_uid": string }; Returns: number
                           },
"record_auth":
{ Args: { "p_detail": string,"p_kind": string }; Returns: undefined
                           },
"record_sns":
{ Args: { "p_entry_ids": (string)[],"p_kind": string,"p_place": string,"p_viewer_key": string }; Returns: number
                           },
"record_view":
{ Args: { "p_entry_id": string,"p_viewer_key": string }; Returns: boolean
                           },
"report":
{ Args: { "p_reason"?: string,"p_target": Database["public"]['Enums']["report_target"],"p_target_id": string }; Returns: undefined
                           },
"require_admin":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"require_member":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"result_exposure_over":
{ Args: { "r": Omit<Database["public"]['Tables']["rounds"]['Row'], Database["public"]['Tables']["rounds"]['ComputedFields']> }; Returns: boolean
                           },
"set_debut_photos":
{ Args: { "p_entry_id": string,"p_photos": Json }; Returns: Json
                           },
"set_nickname":
{ Args: { "p_nickname": string }; Returns: Json
                           },
"snapshot_ranks":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"sns_open":
{ Args: { "p_entry_id": string }; Returns: boolean
                           },
"update_entry":
{ Args: { "p_bio": string,"p_entry_id": string,"p_instagram": string,"p_pet_name": string,"p_photos"?: Json,"p_threads": string,"p_youtube": string }; Returns: Json
                           },
"valid_sns":
{ Args: { "kind": string,"url": string }; Returns: boolean
                           }
          }
          Enums: {
            "board_kind": "dog"|"cat","report_target": "entry"|"comment","result_role": "center"|"finalist"|"debut","round_kind": "weekly"|"final"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "board_kind": ["dog", "cat"],"report_target": ["entry", "comment"],"result_role": ["center", "finalist", "debut"],"round_kind": ["weekly", "final"]
          }
        }
} as const
