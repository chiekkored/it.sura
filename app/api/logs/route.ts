import { NextResponse } from "next/server";
import { adminLogsEnabled } from "@/flags";
import { ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-table";
import { createClient } from "@/lib/supabase/server";

const SORTABLE_COLUMNS = new Set(["created_at", "actor_name", "actor_role", "action", "entity_type"]);

function getPositiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;

  return parsed;
}

export async function GET(request: Request) {
  if (!(await adminLogsEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["superadmin", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const search = searchParams.get("search")?.trim() ?? "";
  const page = getPositiveInteger(searchParams.get("page"), 1);
  const pageSize = getPositiveInteger(searchParams.get("pageSize"), ADMIN_TABLE_PAGE_SIZE);
  const requestedSortBy = searchParams.get("sortBy");
  const sortBy = requestedSortBy && SORTABLE_COLUMNS.has(requestedSortBy) ? requestedSortBy : "created_at";
  const sortDirection = searchParams.get("sortDirection") === "asc" ? "asc" : "desc";

  let logsQuery = supabase
    .from("activity_logs")
    .select("*", { count: "exact" })
    .order(sortBy, { ascending: sortDirection === "asc" });

  if (search) {
    const escapedSearch = search.replaceAll(",", "\\,");
    logsQuery = logsQuery.or(
      `actor_name.ilike.%${escapedSearch}%,action.ilike.%${escapedSearch}%,entity_type.ilike.%${escapedSearch}%,entity_label.ilike.%${escapedSearch}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await logsQuery.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    rows: data ?? [],
    total: count ?? 0,
  });
}
