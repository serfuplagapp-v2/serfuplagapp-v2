/**
 * Tipos de la base de datos para tipar el cliente de Supabase (sin `any`).
 *
 * Por ahora se escriben a mano (solo 2 tablas en Fase 0). A partir de la Fase 1,
 * cuando crezca el esquema, conviene generarlos automáticamente con:
 *   npx supabase gen types typescript --project-id <ID> > src/lib/supabase/types.ts
 *
 * Roles de usuario (01_ARQUITECTURA_V2.md §3).
 */
export type UserRole = "owner" | "admin" | "tecnico" | "cliente_portal";

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          rut: string | null;
          plan: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          rut?: string | null;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          rut?: string | null;
          plan?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          full_name: string | null;
          role: UserRole | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          tenant_id?: string | null;
          full_name?: string | null;
          role?: UserRole | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string | null;
          full_name?: string | null;
          role?: UserRole | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey";
            columns: ["tenant_id"];
            referencedRelation: "tenants";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_tenant_id: {
        Args: Record<never, never>;
        Returns: string;
      };
      current_user_role: {
        Args: Record<never, never>;
        Returns: UserRole;
      };
    };
    Enums: {
      user_role: UserRole;
    };
    CompositeTypes: Record<never, never>;
  };
}
