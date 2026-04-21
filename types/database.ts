export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          role: "superadmin" | "admin" | "staff" | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          role?: "superadmin" | "admin" | "staff" | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          role?: "superadmin" | "admin" | "staff" | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      listings: {
        Row: {
          id: string;
          title: string;
          slug: string;
          price: number;
          size: string | null;
          description: string | null;
          category_id: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          price: number;
          size?: string | null;
          description?: string | null;
          category_id?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          price?: number;
          size?: string | null;
          description?: string | null;
          category_id?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      listing_photos: {
        Row: {
          id: string;
          listing_id: string;
          image_url: string;
          sort_order: number;
          alt_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          image_url: string;
          sort_order?: number;
          alt_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          image_url?: string;
          sort_order?: number;
          alt_text?: string | null;
        };
        Relationships: [];
      };
      listing_inventory: {
        Row: {
          id: string;
          listing_id: string;
          size: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          listing_id: string;
          size: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          listing_id?: string;
          size?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_requests: {
        Row: {
          id: string;
          request_code: string;
          listing_id: string | null;
          buyer_name: string;
          buyer_email: string | null;
          buyer_phone: string | null;
          buyer_messenger: string | null;
          buyer_instagram: string | null;
          size: string | null;
          quantity: number;
          message: string | null;
          status: "new" | "contacted" | "pending_payment" | "closed" | "cancelled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          request_code: string;
          listing_id?: string | null;
          buyer_name: string;
          buyer_email?: string | null;
          buyer_phone?: string | null;
          buyer_messenger?: string | null;
          buyer_instagram?: string | null;
          size?: string | null;
          quantity?: number;
          message?: string | null;
          status?: "new" | "contacted" | "pending_payment" | "closed" | "cancelled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          request_code?: string;
          listing_id?: string | null;
          buyer_name?: string;
          buyer_email?: string | null;
          buyer_phone?: string | null;
          buyer_messenger?: string | null;
          buyer_instagram?: string | null;
          size?: string | null;
          quantity?: number;
          message?: string | null;
          status?: "new" | "contacted" | "pending_payment" | "closed" | "cancelled";
          updated_at?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          actor_name: string | null;
          actor_role: "superadmin" | "admin" | "staff" | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          entity_label: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          actor_role?: "superadmin" | "admin" | "staff" | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          entity_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          actor_role?: "superadmin" | "admin" | "staff" | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          entity_label?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

// Convenience type aliases derived from Database
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingPhoto = Database["public"]["Tables"]["listing_photos"]["Row"];
export type ListingInventory = Database["public"]["Tables"]["listing_inventory"]["Row"];
export type OrderRequest = Database["public"]["Tables"]["order_requests"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_logs"]["Row"];

export type OrderStatus = OrderRequest["status"];

// Joined types used in queries
export type ListingWithPhotos = Listing & {
  listing_photos: ListingPhoto[];
  listing_inventory: ListingInventory[];
  categories: Category | null;
};

export type OrderRequestWithListing = OrderRequest & {
  listings: Pick<Listing, "id" | "title" | "slug"> | null;
};
