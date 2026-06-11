/**
 * Tipos de la base de datos para tipar el cliente de Supabase (sin `any`).
 *
 * Escritos a mano. Cuando el esquema crezca más, conviene generarlos con:
 *   npx supabase gen types typescript --project-id <ID> > src/lib/supabase/types.ts
 *
 * Roles de usuario (01_ARQUITECTURA_V2.md §3).
 */
export type UserRole = "owner" | "admin" | "tecnico" | "cliente_portal";
export type ClientType = "residencial" | "empresa" | "institucional";
export type ContractStatus = "vigente" | "terminado" | "suspendido";
export type ServiceAgendaStatus =
  | "propuesto"
  | "programado"
  | "enviado"
  | "confirmado"
  | "reprogramado"
  | "cancelado";
export type ServiceFieldStatus =
  | "planificada"
  | "asignada"
  | "en_proceso"
  | "por_validar"
  | "terminada";
export type RouteStatus = "planificada" | "en_curso" | "completada" | "cancelada";
export type BillingMode = "por_servicio" | "mensual_consolidada";
export type MovementType = "venta" | "cotizacion" | "nota_credito";
export type MovementStatus =
  | "cotizado"
  | "aprobado"
  | "facturado"
  | "pagado"
  | "rechazado";
export type TaskPriority = "alta" | "normal";
export type TaskStatus = "pendiente" | "hecha";
export type PredefinedTextKind = "trabajo" | "observacion" | "recomendacion";
/** jsonb genérico (datos heredados de la v1 sin esquema fijo). */
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type Timestamps = { created_at: string; updated_at: string };

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
        };
        Update: {
          name?: string;
          rut?: string | null;
          plan?: string;
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
        };
        Update: {
          tenant_id?: string | null;
          full_name?: string | null;
          role?: UserRole | null;
          phone?: string | null;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          rut: string | null;
          type: ClientType | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          rut?: string | null;
          type?: ClientType | null;
          notes?: string | null;
        };
        Update: {
          name?: string;
          rut?: string | null;
          type?: ClientType | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          name: string;
          address: string | null;
          lat: number | null;
          lng: number | null;
          geocoded_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          name: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          geocoded_at?: string | null;
        };
        Update: {
          name?: string;
          address?: string | null;
          lat?: number | null;
          lng?: number | null;
          geocoded_at?: string | null;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          branch_id: string | null;
          name: string;
          role: string | null;
          phone: string | null;
          email: string | null;
          es_destinatario: boolean;
          es_cc: boolean;
          recibe_whatsapp: boolean;
          orden: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          branch_id?: string | null;
          name: string;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          es_destinatario?: boolean;
          es_cc?: boolean;
          recibe_whatsapp?: boolean;
          orden?: number;
        };
        Update: {
          branch_id?: string | null;
          name?: string;
          role?: string | null;
          phone?: string | null;
          email?: string | null;
          es_destinatario?: boolean;
          es_cc?: boolean;
          recibe_whatsapp?: boolean;
          orden?: number;
        };
        Relationships: [];
      };
      service_types: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          active?: boolean;
        };
        Update: { name?: string; active?: boolean };
        Relationships: [];
      };
      contracts: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          service_type_id: string;
          frequency: string | null;
          current_price: number | null;
          start_date: string | null;
          end_date: string | null;
          status: ContractStatus;
          oc_number: string | null;
          oc_file_path: string | null;
          billing_mode: BillingMode;
          visit_mode: string | null;
          visit_params: Record<string, number>;
          allowed_days: number[] | null;
          preferred_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          service_type_id: string;
          frequency?: string | null;
          current_price?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: ContractStatus;
          oc_number?: string | null;
          oc_file_path?: string | null;
          billing_mode?: BillingMode;
          visit_mode?: string | null;
          visit_params?: Record<string, number>;
          allowed_days?: number[] | null;
          preferred_time?: string | null;
        };
        Update: {
          service_type_id?: string;
          frequency?: string | null;
          current_price?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: ContractStatus;
          oc_number?: string | null;
          oc_file_path?: string | null;
          billing_mode?: BillingMode;
          visit_mode?: string | null;
          visit_params?: Record<string, number>;
          allowed_days?: number[] | null;
          preferred_time?: string | null;
        };
        Relationships: [];
      };
      technicians: {
        Row: {
          id: string;
          tenant_id: string;
          profile_id: string | null;
          full_name: string;
          license_info: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          profile_id?: string | null;
          full_name: string;
          license_info?: string | null;
          active?: boolean;
        };
        Update: {
          profile_id?: string | null;
          full_name?: string;
          license_info?: string | null;
          active?: boolean;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string;
          branch_id: string | null;
          contract_id: string | null;
          service_type_id: string;
          scheduled_at: string | null;
          agenda_status: ServiceAgendaStatus;
          field_status: ServiceFieldStatus;
          notes: string | null;
          completed_at: string | null;
          legacy_id: string | null;
          legacy_data: Json | null;
          field_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id: string;
          branch_id?: string | null;
          contract_id?: string | null;
          service_type_id: string;
          scheduled_at?: string | null;
          agenda_status?: ServiceAgendaStatus;
          field_status?: ServiceFieldStatus;
          notes?: string | null;
          completed_at?: string | null;
        };
        Update: {
          client_id?: string;
          branch_id?: string | null;
          contract_id?: string | null;
          service_type_id?: string;
          scheduled_at?: string | null;
          agenda_status?: ServiceAgendaStatus;
          field_status?: ServiceFieldStatus;
          notes?: string | null;
          completed_at?: string | null;
          field_data?: Json;
        };
        Relationships: [];
      };
      service_technicians: {
        Row: { tenant_id: string; service_id: string; technician_id: string };
        Insert: { tenant_id: string; service_id: string; technician_id: string };
        Update: { technician_id?: string };
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          tenant_id: string;
          technician_id: string | null;
          date: string;
          status: RouteStatus;
          polyline: string | null;
          distance_km: number | null;
          duration_min: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          technician_id?: string | null;
          date: string;
          status?: RouteStatus;
          polyline?: string | null;
          distance_km?: number | null;
          duration_min?: number | null;
        };
        Update: {
          technician_id?: string | null;
          date?: string;
          status?: RouteStatus;
          polyline?: string | null;
          distance_km?: number | null;
          duration_min?: number | null;
        };
        Relationships: [];
      };
      route_stops: {
        Row: {
          id: string;
          tenant_id: string;
          route_id: string;
          service_id: string;
          position: number;
          eta: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          route_id: string;
          service_id: string;
          position?: number;
          eta?: string | null;
        };
        Update: { position?: number; eta?: string | null };
        Relationships: [];
      };
      geocode_cache: {
        Row: {
          address_hash: string;
          address: string;
          lat: number | null;
          lng: number | null;
          created_at: string;
        };
        Insert: {
          address_hash: string;
          address: string;
          lat?: number | null;
          lng?: number | null;
        };
        Update: { lat?: number | null; lng?: number | null };
        Relationships: [];
      };
      movements: {
        Row: {
          id: string;
          tenant_id: string;
          client_id: string | null;
          contract_id: string | null;
          date: string;
          type: MovementType;
          amount: number;
          status: MovementStatus;
          description: string | null;
          client_name_raw: string | null;
          dte_folio: string | null;
          oc_number: string | null;
          oc_file_path: string | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          client_id?: string | null;
          contract_id?: string | null;
          date: string;
          type: MovementType;
          amount: number;
          status?: MovementStatus;
          description?: string | null;
          client_name_raw?: string | null;
          dte_folio?: string | null;
          oc_number?: string | null;
          oc_file_path?: string | null;
          legacy_id?: string | null;
        };
        Update: {
          client_id?: string | null;
          contract_id?: string | null;
          date?: string;
          type?: MovementType;
          amount?: number;
          status?: MovementStatus;
          description?: string | null;
          dte_folio?: string | null;
          oc_number?: string | null;
          oc_file_path?: string | null;
        };
        Relationships: [];
      };
      movement_services: {
        Row: { tenant_id: string; movement_id: string; service_id: string };
        Insert: { tenant_id: string; movement_id: string; service_id: string };
        Update: { service_id?: string };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          due_date: string | null;
          priority: TaskPriority;
          client_id: string | null;
          notes: string | null;
          status: TaskStatus;
          done_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          due_date?: string | null;
          priority?: TaskPriority;
          client_id?: string | null;
          notes?: string | null;
          status?: TaskStatus;
          done_at?: string | null;
        };
        Update: {
          title?: string;
          due_date?: string | null;
          priority?: TaskPriority;
          client_id?: string | null;
          notes?: string | null;
          status?: TaskStatus;
          done_at?: string | null;
        };
        Relationships: [];
      };
      dte_documents: {
        Row: {
          id: string;
          tenant_id: string;
          movement_id: string;
          sii_type: number | null;
          folio: string | null;
          xml_path: string | null;
          pdf_path: string | null;
          status: string | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          movement_id: string;
          sii_type?: number | null;
          folio?: string | null;
          xml_path?: string | null;
          pdf_path?: string | null;
          status?: string | null;
          legacy_id?: string | null;
        };
        Update: {
          sii_type?: number | null;
          folio?: string | null;
          xml_path?: string | null;
          pdf_path?: string | null;
          status?: string | null;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          active: boolean;
          favorito: boolean;
          dosis: string | null;
          formulacion: string | null;
          concentracion: string | null;
          ingrediente_activo: string | null;
          isp: string | null;
          laboratorio: string | null;
          unidad: string | null;
          service_names: string[] | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          active?: boolean;
          favorito?: boolean;
          dosis?: string | null;
          formulacion?: string | null;
          concentracion?: string | null;
          ingrediente_activo?: string | null;
          isp?: string | null;
          laboratorio?: string | null;
          unidad?: string | null;
          service_names?: string[] | null;
          legacy_id?: string | null;
        };
        Update: {
          name?: string;
          active?: boolean;
          favorito?: boolean;
          dosis?: string | null;
          formulacion?: string | null;
          concentracion?: string | null;
          ingrediente_activo?: string | null;
          isp?: string | null;
          laboratorio?: string | null;
          unidad?: string | null;
          service_names?: string[] | null;
        };
        Relationships: [];
      };
      pests: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          scientific_name: string | null;
          active: boolean;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          scientific_name?: string | null;
          active?: boolean;
          legacy_id?: string | null;
        };
        Update: { name?: string; scientific_name?: string | null; active?: boolean };
        Relationships: [];
      };
      predefined_texts: {
        Row: {
          id: string;
          tenant_id: string;
          kind: PredefinedTextKind;
          body: string;
          sort_order: number;
          active: boolean;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          kind: PredefinedTextKind;
          body: string;
          sort_order?: number;
          active?: boolean;
          legacy_id?: string | null;
        };
        Update: { kind?: PredefinedTextKind; body?: string; sort_order?: number; active?: boolean };
        Relationships: [];
      };
      certificates: {
        Row: {
          id: string;
          tenant_id: string;
          folio: number;
          service_id: string | null;
          client_id: string | null;
          branch_id: string | null;
          issued_at: string | null;
          service_date: string | null;
          data: Json;
          pdf_path: string | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          folio: number;
          service_id?: string | null;
          client_id?: string | null;
          branch_id?: string | null;
          issued_at?: string | null;
          service_date?: string | null;
          data?: Json;
          pdf_path?: string | null;
          legacy_id?: string | null;
        };
        Update: {
          folio?: number;
          service_id?: string | null;
          client_id?: string | null;
          branch_id?: string | null;
          issued_at?: string | null;
          service_date?: string | null;
          data?: Json;
          pdf_path?: string | null;
        };
        Relationships: [];
      };
      layouts: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          client_id: string | null;
          branch_id: string | null;
          bg_color: string | null;
          bg_image: string | null;
          header: Json | null;
          elements: Json;
          thumbnail: string | null;
          snapshot_url: string | null;
          snapshot_w: number | null;
          snapshot_h: number | null;
          legacy_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          client_id?: string | null;
          branch_id?: string | null;
          bg_color?: string | null;
          bg_image?: string | null;
          header?: Json | null;
          elements?: Json;
          thumbnail?: string | null;
          snapshot_url?: string | null;
          snapshot_w?: number | null;
          snapshot_h?: number | null;
          legacy_id?: string | null;
        };
        Update: {
          name?: string;
          client_id?: string | null;
          branch_id?: string | null;
          bg_color?: string | null;
          bg_image?: string | null;
          header?: Json | null;
          elements?: Json;
          thumbnail?: string | null;
          snapshot_url?: string | null;
        };
        Relationships: [];
      };
      tenant_settings: {
        Row: {
          tenant_id: string;
          cert_next_folio: number;
          quote_next_folio: number;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          cert_next_folio?: number;
          quote_next_folio?: number;
          data?: Json;
        };
        Update: {
          cert_next_folio?: number;
          quote_next_folio?: number;
          data?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: {
      current_tenant_id: { Args: Record<never, never>; Returns: string };
      current_user_role: { Args: Record<never, never>; Returns: UserRole };
      next_cert_folio: { Args: Record<never, never>; Returns: number };
      movements_summary: {
        Args: {
          p_from?: string | null;
          p_to?: string | null;
          p_type?: string | null;
          p_q?: string | null;
        };
        Returns: { total: number; n: number }[];
      };
    };
    Enums: {
      user_role: UserRole;
      client_type: ClientType;
      contract_status: ContractStatus;
      service_agenda_status: ServiceAgendaStatus;
      service_field_status: ServiceFieldStatus;
      route_status: RouteStatus;
      billing_mode: BillingMode;
      movement_type: MovementType;
      movement_status: MovementStatus;
      task_priority: TaskPriority;
      task_status: TaskStatus;
    };
    CompositeTypes: Record<never, never>;
  };
}

// Atajos de tipos para usar en la app.
type Tables = Database["public"]["Tables"];
export type Client = Tables["clients"]["Row"];
export type Branch = Tables["branches"]["Row"];
export type Contact = Tables["contacts"]["Row"];
export type ServiceType = Tables["service_types"]["Row"];
export type Contract = Tables["contracts"]["Row"];
export type Technician = Tables["technicians"]["Row"];
export type Service = Tables["services"]["Row"];
export type Route = Tables["routes"]["Row"];
export type Movement = Tables["movements"]["Row"];
// Evitamos `Timestamps` sin usar (lo dejamos disponible para futuros tipos).
export type WithTimestamps<T> = T & Timestamps;
