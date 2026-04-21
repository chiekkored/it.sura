"use client";

import { useEffect, useMemo, useState } from "react";
import type { PaginationState, SortingState } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { AdminDataTable, resolveUpdater, type AdminDataTableColumn } from "@/components/admin/AdminDataTable";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ADMIN_TABLE_PAGE_SIZE, type AdminTableQuery, type AdminTableResult } from "@/lib/admin-table";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { ActivityLog } from "@/types";
import type { Json } from "@/types/database";

const SORTABLE_COLUMNS = new Set(["created_at", "actor_name", "actor_role", "action", "entity_type"]);

type MetadataRecord = Record<string, Json | undefined>;

type LogChange = {
  field?: Json;
  label?: Json;
  previous?: Json;
  next?: Json;
};

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatAction(value: string) {
  return value
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" / ");
}

function isMetadataRecord(metadata: Json): metadata is MetadataRecord {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata));
}

function getMetadataSummary(metadata: Json) {
  if (!isMetadataRecord(metadata)) return null;

  if (typeof metadata.summary === "string" && metadata.summary.trim()) {
    return metadata.summary;
  }

  const entries = Object.entries(metadata)
    .filter(([key]) => key !== "changes" && key !== "changed_fields")
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3);

  if (!entries.length) return null;

  return entries
    .map(([key, value]) => {
      const label = key.replace(/_/g, " ");
      if (typeof value === "object") return `${label}: ${JSON.stringify(value)}`;
      return `${label}: ${String(value)}`;
    })
    .join(" | ");
}

function getMetadataChanges(metadata: Json): LogChange[] {
  if (!isMetadataRecord(metadata) || !Array.isArray(metadata.changes)) return [];

  return metadata.changes.filter(
    (change): change is LogChange => Boolean(change && typeof change === "object" && !Array.isArray(change)),
  );
}

function formatEntityType(value: string) {
  return value.replace(/_/g, " ");
}

function formatMetadataValue(value: Json | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  if (Array.isArray(value)) {
    if (!value.length) return "none";
    return value
      .map((item) => {
        if (item && typeof item === "object" && !Array.isArray(item) && "size" in item && "quantity" in item) {
          const inventoryItem = item as { size?: Json; quantity?: Json };
          return `${formatMetadataValue(inventoryItem.size)}: ${formatMetadataValue(inventoryItem.quantity)}`;
        }

        return formatMetadataValue(item);
      })
      .join(", ");
  }
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  if (typeof value === "boolean") return value ? "active" : "inactive";
  return String(value);
}

function getMetadataEntries(metadata: Json) {
  if (!isMetadataRecord(metadata)) return [];
  return Object.entries(metadata)
    .filter(([key]) => key !== "summary" && key !== "changes" && key !== "changed_fields")
    .filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="break-words text-sm text-foreground">{children}</div>
    </div>
  );
}

async function getLogsPageData({
  search,
  page,
  pageSize,
  sortBy,
  sortDirection,
}: AdminTableQuery): Promise<AdminTableResult<ActivityLog>> {
  const supabase = createClient();
  const normalizedSearch = search.trim();
  const sortColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";

  let logsQuery = supabase
    .from("activity_logs")
    .select("*", { count: "exact" })
    .order(sortColumn, { ascending: sortDirection === "asc" });

  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replaceAll(",", "\\,");
    logsQuery = logsQuery.or(
      `actor_name.ilike.%${escapedSearch}%,action.ilike.%${escapedSearch}%,entity_type.ilike.%${escapedSearch}%,entity_label.ilike.%${escapedSearch}%`,
    );
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count, error } = await logsQuery.range(from, to);

  if (error) throw new Error(error.message);

  return {
    rows: data ?? [],
    total: count ?? 0,
  };
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [hasLogs, setHasLogs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const pageSize = ADMIN_TABLE_PAGE_SIZE;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };
  const pageCount = Math.ceil(total / pageSize);
  const activeSort = sorting[0];
  const hasSearch = Boolean(debouncedSearch.trim());

  useEffect(() => {
    let isCurrent = true;

    const loadLogs = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { rows, total } = await getLogsPageData({
          search: debouncedSearch,
          page,
          pageSize,
          sortBy: activeSort?.id,
          sortDirection: activeSort?.desc ? "desc" : "asc",
        });

        if (!isCurrent) return;

        setLogs(rows);
        setTotal(total);
        if (!debouncedSearch.trim()) {
          setHasLogs(total > 0);
        }
      } catch (err) {
        if (!isCurrent) return;
        setError(err instanceof Error ? err.message : "Failed to load activity logs.");
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    loadLogs();

    return () => {
      isCurrent = false;
    };
  }, [activeSort?.desc, activeSort?.id, debouncedSearch, page, pageSize]);

  const openLogDetails = (log: ActivityLog) => {
    setSelectedLog(log);
    setIsDetailsSheetOpen(true);
  };

  const columns = useMemo<AdminDataTableColumn<ActivityLog>[]>(
    () => [
      {
        accessorKey: "created_at",
        header: "Time",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-4 w-36" /> },
        cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateTime(row.original.created_at)}</span>,
      },
      {
        accessorKey: "actor_name",
        header: "Actor",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-5 w-36" /> },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="font-medium">{row.original.actor_name ?? "Unknown user"}</p>
            {row.original.actor_role ? (
              <Badge variant="secondary" className="h-4 text-[10px]">
                {row.original.actor_role}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "action",
        header: "Action",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-5 w-32" /> },
        cell: ({ row }) => <span className="font-medium capitalize">{formatAction(row.original.action)}</span>,
      },
      {
        accessorKey: "entity_type",
        header: "Entity",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-5 w-40" /> },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="text-sm">
              <span className="capitalize">{formatEntityType(row.original.entity_type)}</span>
              {row.original.entity_label ? `: ${row.original.entity_label}` : ""}
            </p>
          </div>
        ),
      },
      {
        id: "summary",
        header: "Summary",
        meta: { cellClassName: "max-w-[260px]", skeleton: <Skeleton className="h-4 w-48" /> },
        cell: ({ row }) => {
          const summary = getMetadataSummary(row.original.metadata);
          return summary ? <p className="truncate text-xs text-muted-foreground">{summary}</p> : <span className="text-muted-foreground">-</span>;
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Activity Logs</h1>
        <TableSearchInput
          value={search}
          onChange={(event) => {
            setIsLoading(true);
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search logs..."
          aria-label="Search logs"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <AdminDataTable
        columns={columns}
        data={logs}
        getRowId={(log) => log.id}
        isLoading={isLoading}
        emptyMessage={hasSearch && hasLogs ? "No logs match your search." : "No activity logs yet."}
        pagination={pagination}
        pageCount={pageCount}
        total={total}
        sorting={sorting}
        onRowClick={openLogDetails}
        onSortingChange={(updater) => {
          setSorting((current) => resolveUpdater(updater, current).slice(0, 1));
          setPage(1);
        }}
        onPaginationChange={(updater) => {
          const nextPagination = resolveUpdater(updater, pagination);
          setPage(nextPagination.pageIndex + 1);
        }}
      />

      <Sheet
        open={isDetailsSheetOpen}
        onOpenChange={(open) => {
          setIsDetailsSheetOpen(open);
          if (!open) setSelectedLog(null);
        }}
      >
        <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{selectedLog ? formatAction(selectedLog.action) : "Activity Details"}</SheetTitle>
          </SheetHeader>

          {selectedLog && (
            <div className="space-y-6 px-6 pb-6">
              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Overview</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Time">{formatDateTime(selectedLog.created_at)}</DetailItem>
                  <DetailItem label="Action">{formatAction(selectedLog.action)}</DetailItem>
                  <DetailItem label="Log ID">
                    <span className="font-mono text-xs">{selectedLog.id}</span>
                  </DetailItem>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Actor</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Name">{selectedLog.actor_name ?? "Unknown user"}</DetailItem>
                  <DetailItem label="Role">
                    {selectedLog.actor_role ? <Badge variant="secondary">{selectedLog.actor_role}</Badge> : "-"}
                  </DetailItem>
                  <DetailItem label="Actor ID">
                    <span className="font-mono text-xs">{selectedLog.actor_id ?? "-"}</span>
                  </DetailItem>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Entity</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailItem label="Type">
                    <span className="capitalize">{formatEntityType(selectedLog.entity_type)}</span>
                  </DetailItem>
                  <DetailItem label="Label">{selectedLog.entity_label ?? "-"}</DetailItem>
                  <DetailItem label="Entity ID">
                    <span className="font-mono text-xs">{selectedLog.entity_id ?? "-"}</span>
                  </DetailItem>
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="text-sm font-semibold">Details</h2>
                {getMetadataSummary(selectedLog.metadata) && (
                  <DetailItem label="Summary">{getMetadataSummary(selectedLog.metadata)}</DetailItem>
                )}

                {getMetadataChanges(selectedLog.metadata).length ? (
                  <div className="space-y-3">
                    {getMetadataChanges(selectedLog.metadata).map((change, index) => (
                      <div key={`${String(change.field ?? index)}-${index}`} className="rounded-md border p-3">
                        <p className="text-sm font-medium">{formatMetadataValue(change.label) || "Changed field"}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          <span className="text-foreground">{formatMetadataValue(change.previous)}</span>
                          <span className="px-2">-&gt;</span>
                          <span className="text-foreground">{formatMetadataValue(change.next)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : getMetadataEntries(selectedLog.metadata).length ? (
                  <div className="grid gap-4">
                    {getMetadataEntries(selectedLog.metadata).map(([key, value]) => (
                      <DetailItem key={key} label={key.replace(/_/g, " ")}>
                        {typeof value === "object" && value !== null && !Array.isArray(value) ? (
                          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{formatMetadataValue(value)}</pre>
                        ) : (
                          formatMetadataValue(value)
                        )}
                      </DetailItem>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No metadata recorded.</p>
                )}
              </section>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
