import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";

type AdminRole = "superadmin" | "admin" | "staff";

type LogActivityInput = {
  actorId: string;
  actorName?: string | null;
  actorRole?: AdminRole | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Json;
};

export async function logActivity({
  actorId,
  actorName,
  actorRole,
  action,
  entityType,
  entityId,
  entityLabel,
  metadata = {},
}: LogActivityInput) {
  try {
    const adminClient = createAdminClient();
    let resolvedActorName = actorName;
    let resolvedActorRole = actorRole;

    if (resolvedActorName === undefined || resolvedActorRole === undefined) {
      const { data: profile } = await adminClient
        .from("profiles")
        .select("full_name, role")
        .eq("id", actorId)
        .maybeSingle();

      resolvedActorName = resolvedActorName ?? profile?.full_name ?? null;
      resolvedActorRole = resolvedActorRole ?? profile?.role ?? null;
    }

    const { error } = await adminClient.from("activity_logs").insert({
      actor_id: actorId,
      actor_name: resolvedActorName,
      actor_role: resolvedActorRole,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
      metadata,
    });

    if (error) {
      console.error("Activity log insert failed:", error.message);
    }
  } catch (error) {
    console.error("Activity log insert failed:", error);
  }
}
