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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      categorias_torneo: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          key: string
          nombre: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          key: string
          nombre: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          key?: string
          nombre?: string
        }
        Relationships: []
      }
      ciudades: {
        Row: {
          created_at: string
          id: string
          nombre: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      equipo_miembros: {
        Row: {
          created_at: string
          equipo_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          equipo_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          equipo_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipo_miembros_equipo_id_fkey"
            columns: ["equipo_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id"]
          },
        ]
      }
      equipos: {
        Row: {
          created_at: string
          id: string
          metadata: Json
          nombre: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json
          nombre: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json
          nombre?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      juegos: {
        Row: {
          created_at: string
          descripcion: string | null
          id: string
          key: string
          nombre: string
        }
        Insert: {
          created_at?: string
          descripcion?: string | null
          id?: string
          key: string
          nombre: string
        }
        Update: {
          created_at?: string
          descripcion?: string | null
          id?: string
          key?: string
          nombre?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          updated_at: string
          user_id: string
          user_role: Database["public"]["Enums"]["user_role"]
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id: string
          user_role?: Database["public"]["Enums"]["user_role"]
        }
        Update: {
          created_at?: string
          display_name?: string | null
          updated_at?: string
          user_id?: string
          user_role?: Database["public"]["Enums"]["user_role"]
        }
        Relationships: []
      }
      tiendas: {
        Row: {
          ciudad_id: string | null
          created_at: string
          id: string
          nombre: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          ciudad_id?: string | null
          created_at?: string
          id?: string
          nombre: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          ciudad_id?: string | null
          created_at?: string
          id?: string
          nombre?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tiendas_ciudad"
            columns: ["ciudad_id"]
            isOneToOne: false
            referencedRelation: "ciudades"
            referencedColumns: ["id"]
          },
        ]
      }
      torneos: {
        Row: {
          categoria_id: string | null
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          costo_entrada: number
          created_at: string
          cupo_maximo: number
          descripcion: string
          direccion: string
          fecha_inicio: string
          id: string
          imagen_url: string | null
          juego_id: string | null
          latitud: number | null
          longitud: number | null
          publicado: boolean
          registration_closes_at: string | null
          registration_opens_at: string | null
          status: string
          tienda_id: string
          titulo: string
          updated_at: string
          visibility: string
        }
        Insert: {
          categoria_id?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          costo_entrada?: number
          created_at?: string
          cupo_maximo: number
          descripcion: string
          direccion: string
          fecha_inicio: string
          id?: string
          imagen_url?: string | null
          juego_id?: string | null
          latitud?: number | null
          longitud?: number | null
          publicado?: boolean
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          status?: string
          tienda_id: string
          titulo: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          categoria_id?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          costo_entrada?: number
          created_at?: string
          cupo_maximo?: number
          descripcion?: string
          direccion?: string
          fecha_inicio?: string
          id?: string
          imagen_url?: string | null
          juego_id?: string | null
          latitud?: number | null
          longitud?: number | null
          publicado?: boolean
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          status?: string
          tienda_id?: string
          titulo?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_torneos_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_torneo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_torneos_juego"
            columns: ["juego_id"]
            isOneToOne: false
            referencedRelation: "juegos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "torneos_tienda_id_fkey"
            columns: ["tienda_id"]
            isOneToOne: false
            referencedRelation: "tiendas"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_entries: {
        Row: {
          checked_in_at: string | null
          created_at: string
          entry_type: Database["public"]["Enums"]["tournament_entry_type"]
          id: string
          metadata: Json
          registration_order: number
          status: Database["public"]["Enums"]["tournament_entry_status"]
          team_id: string | null
          torneo_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          checked_in_at?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["tournament_entry_type"]
          id?: string
          metadata?: Json
          registration_order?: number
          status?: Database["public"]["Enums"]["tournament_entry_status"]
          team_id?: string | null
          torneo_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          checked_in_at?: string | null
          created_at?: string
          entry_type?: Database["public"]["Enums"]["tournament_entry_type"]
          id?: string
          metadata?: Json
          registration_order?: number
          status?: Database["public"]["Enums"]["tournament_entry_status"]
          team_id?: string | null
          torneo_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tournament_entries_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "equipos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_entries_torneo_id_fkey"
            columns: ["torneo_id"]
            isOneToOne: false
            referencedRelation: "torneos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_or_create_categoria: {
        Args: { p_key: string; p_nombre: string }
        Returns: string
      }
      get_or_create_ciudad: { Args: { p_nombre: string }; Returns: string }
      get_or_create_juego: {
        Args: { p_key: string; p_nombre: string }
        Returns: string
      }
    }
    Enums: {
      categoria_torneo: "local" | "regional" | "premier" | "casual"
      estado_inscripcion: "confirmada" | "cancelada"
      tcg_juego:
        | "pokemon"
        | "yugioh"
        | "magic"
        | "one_piece"
        | "digimon"
        | "lorcana"
        | "otro"
      tournament_entry_status:
        | "registered"
        | "waitlisted"
        | "checked_in"
        | "seeded"
        | "dropped"
        | "eliminated"
      tournament_entry_type: "solo" | "team"
      user_role: "jugador" | "tienda" | "admin"
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
    Enums: {
      categoria_torneo: ["local", "regional", "premier", "casual"],
      estado_inscripcion: ["confirmada", "cancelada"],
      tcg_juego: [
        "pokemon",
        "yugioh",
        "magic",
        "one_piece",
        "digimon",
        "lorcana",
        "otro",
      ],
      tournament_entry_status: [
        "registered",
        "waitlisted",
        "checked_in",
        "seeded",
        "dropped",
        "eliminated",
      ],
      tournament_entry_type: ["solo", "team"],
      user_role: ["jugador", "tienda", "admin"],
    },
  },
} as const

export type TcgJuego = Database["public"]["Enums"]["tcg_juego"]
export type CategoriaTorneo = Database["public"]["Enums"]["categoria_torneo"]
