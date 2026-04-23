"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaginationState, SortingState } from "@tanstack/react-table";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { UpdateOrderStatusModal } from "@/components/admin/UpdateOrderStatusModal";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AdminDataTable, resolveUpdater, type AdminDataTableColumn } from "@/components/admin/AdminDataTable";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { ADMIN_TABLE_PAGE_SIZE, type AdminTableQuery, type AdminTableResult } from "@/lib/admin-table";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { OrderStatus, OrderRequest, Listing } from "@/types";

type OrderRow = OrderRequest & {
  listings: Pick<Listing, "id" | "title" | "slug" | "price" | "size"> | null;
};

const SORTABLE_COLUMNS = new Set(["request_code", "buyer_name", "quantity", "status", "created_at"]);

const getStatusVariant = (status: OrderStatus): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "new":
      return "secondary";
    case "contacted":
      return "default";
    case "pending_payment":
      return "outline";
    case "completed":
      return "default";
    case "cancelled":
      return "destructive";
    default:
      return "default";
  }
};

const statusLabels: Record<OrderStatus, string> = {
  new: "New",
  contacted: "Contacted",
  pending_payment: "Pending Payment",
  completed: "Completed",
  cancelled: "Cancelled",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
    </div>
  );
}

function DetailLink({ href, children, external = true }: { href: string; children: React.ReactNode; external?: boolean }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </a>
  );
}

function normalizePhoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function normalizeMessengerHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(m\.me|messenger\.com|facebook\.com)\//i.test(trimmed)) return `https://${trimmed}`;
  if (!trimmed.includes(" ")) return `https://m.me/${trimmed.replace(/^@/, "")}`;
  return `https://www.facebook.com/search/top?q=${encodeURIComponent(trimmed)}`;
}

function normalizeInstagramHref(value: string) {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://www.instagram.com/${trimmed.replace(/^@/, "")}`;
}

async function getOrdersPageData({
  search,
  page,
  pageSize,
  sortBy,
  sortDirection,
}: AdminTableQuery): Promise<AdminTableResult<OrderRow>> {
  const supabase = createClient();
  const normalizedSearch = search.trim();
  let matchingListingIds: string[] = [];
  const sortColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";

  if (normalizedSearch) {
    const { data: matchingListings } = await supabase
      .from("listings")
      .select("id")
      .ilike("title", `%${normalizedSearch}%`);
    matchingListingIds = matchingListings?.map((listing) => listing.id) ?? [];
  }

  let ordersQuery = supabase
    .from("order_requests")
    .select("*, listings(id, title, slug, price, size)", { count: "exact" })
    .order(sortColumn, { ascending: sortDirection === "asc" });

  if (normalizedSearch) {
    if (matchingListingIds.length) {
      ordersQuery = ordersQuery.or(
        `request_code.ilike.%${normalizedSearch}%,listing_id.in.(${matchingListingIds.join(",")})`,
      );
    } else {
      ordersQuery = ordersQuery.ilike("request_code", `%${normalizedSearch}%`);
    }
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data: ordersRaw, count } = await ordersQuery.range(from, to);

  return {
    rows: (ordersRaw ?? []) as unknown as OrderRow[],
    total: count ?? 0,
  };
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [hasOrders, setHasOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRow | null>(null);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search);
  const pageSize = ADMIN_TABLE_PAGE_SIZE;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };
  const pageCount = Math.ceil(total / pageSize);
  const activeSort = sorting[0];

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    const { rows, total } = await getOrdersPageData({
      search: debouncedSearch,
      page,
      pageSize,
      sortBy: activeSort?.id,
      sortDirection: activeSort?.desc ? "desc" : "asc",
    });
    setOrders(rows);
    setTotal(total);
    if (!debouncedSearch.trim()) {
      setHasOrders(total > 0);
    }
    setIsLoading(false);
  }, [activeSort?.desc, activeSort?.id, debouncedSearch, page, pageSize]);

  useEffect(() => {
    let isCurrent = true;

    const loadOrders = async () => {
      const { rows, total } = await getOrdersPageData({
        search: debouncedSearch,
        page,
        pageSize,
        sortBy: activeSort?.id,
        sortDirection: activeSort?.desc ? "desc" : "asc",
      });

      if (!isCurrent) return;

      setOrders(rows);
      setTotal(total);
      if (!debouncedSearch.trim()) {
        setHasOrders(total > 0);
      }
      setIsLoading(false);
    };

    loadOrders();

    return () => {
      isCurrent = false;
    };
  }, [activeSort?.desc, activeSort?.id, debouncedSearch, page, pageSize]);

  const hasSearch = Boolean(debouncedSearch.trim());

  const openOrderDetails = (order: OrderRow) => {
    setSelectedOrder(order);
    setIsDetailsSheetOpen(true);
  };

  const columns = useMemo<AdminDataTableColumn<OrderRow>[]>(
    () => [
      {
        accessorKey: "request_code",
        header: "Code",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-4 w-12" /> },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.request_code}</span>,
      },
      {
        id: "item",
        header: "Item",
        meta: { cellClassName: "max-w-[180px]", skeleton: <Skeleton className="h-4 w-40" /> },
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <p className="truncate font-medium">
              {row.original.listings?.title ?? <span className="text-muted-foreground">—</span>}
            </p>
            {row.original.size && (
              <Badge variant="secondary" className="h-4 text-[10px]">
                Size: {row.original.size}
              </Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "buyer_name",
        header: "Buyer",
        enableSorting: true,
        meta: {
          skeleton: (
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          ),
        },
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div className="text-sm">
              <p className="font-medium">{order.buyer_name}</p>
              <p className="text-xs text-muted-foreground">{order.buyer_phone}</p>
              <div className="mt-1 flex flex-col gap-0.5">
                {order.buyer_email && (
                  <p className="w-fit rounded bg-muted px-1 text-[10px] text-muted-foreground">E: {order.buyer_email}</p>
                )}
                {order.buyer_messenger && (
                  <p className="w-fit rounded bg-blue-50 px-1 text-[10px] text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                    M: {order.buyer_messenger}
                  </p>
                )}
                {order.buyer_instagram && (
                  <p className="w-fit rounded bg-pink-50 px-1 text-[10px] text-pink-600 dark:bg-pink-900/30 dark:text-pink-400">
                    IG: {order.buyer_instagram}
                  </p>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "quantity",
        header: "Qty",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-4 w-8" /> },
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-6 w-24 rounded-full" /> },
        cell: ({ row }) => (
          <Badge variant={getStatusVariant(row.original.status as OrderStatus)}>
            {statusLabels[row.original.status as OrderStatus]}
          </Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date",
        enableSorting: true,
        meta: { cellClassName: "text-xs text-muted-foreground", skeleton: <Skeleton className="h-4 w-20" /> },
        cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
      },
      {
        id: "actions",
        header: "Actions",
        meta: {
          headerClassName: "w-24 text-right",
          cellClassName: "text-right",
          skeleton: <Skeleton className="ml-auto h-8 w-8 rounded-md" />,
        },
        cell: ({ row }) => {
          const order = row.original;
          return (
            <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <UpdateOrderStatusModal
                orderId={order.id}
                requestCode={order.request_code}
                itemName={order.listings?.title ?? "Unknown Item"}
                currentStatus={order.status as OrderStatus}
                onSuccess={fetchOrders}
              />
            </div>
          );
        },
      },
    ],
    [fetchOrders],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Orders</h1>
        <TableSearchInput
          value={search}
          onChange={(event) => {
            setIsLoading(true);
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search code or item..."
          aria-label="Search orders"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={orders}
        getRowId={(order) => order.id}
        isLoading={isLoading}
        emptyMessage={hasSearch && hasOrders ? "No orders match your search." : "No orders yet."}
        pagination={pagination}
        pageCount={pageCount}
        total={total}
        sorting={sorting}
        onSortingChange={(updater) => {
          setSorting((current) => resolveUpdater(updater, current).slice(0, 1));
          setPage(1);
        }}
        onPaginationChange={(updater) => {
          const nextPagination = resolveUpdater(updater, pagination);
          setPage(nextPagination.pageIndex + 1);
        }}
        onRowClick={openOrderDetails}
      />

      <Sheet
        open={isDetailsSheetOpen}
        onOpenChange={(open) => {
          setIsDetailsSheetOpen(open);
          if (!open) setSelectedOrder(null);
        }}
      >
        <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{selectedOrder ? `Order ${selectedOrder.request_code}` : "Order Details"}</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="space-y-6 px-6 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <UpdateOrderStatusModal
                  orderId={selectedOrder.id}
                  requestCode={selectedOrder.request_code}
                  itemName={selectedOrder.listings?.title ?? "Unknown Item"}
                  currentStatus={selectedOrder.status as OrderStatus}
                  onSuccess={() => {
                    setIsDetailsSheetOpen(false);
                    fetchOrders();
                  }}
                />
                <Badge variant={getStatusVariant(selectedOrder.status as OrderStatus)}>
                  {statusLabels[selectedOrder.status as OrderStatus]}
                </Badge>
                {selectedOrder.size && <Badge variant="secondary">Size {selectedOrder.size}</Badge>}
                <Badge variant="outline">Qty {selectedOrder.quantity}</Badge>
              </div>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Item</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DetailItem label="Name">
                    {selectedOrder.listings?.title ?? <span className="text-muted-foreground">—</span>}
                  </DetailItem>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Price">
                      {selectedOrder.listings?.price != null
                        ? `₱${selectedOrder.listings.price.toLocaleString()}`
                        : "—"}
                    </DetailItem>
                    <DetailItem label="Slug">{selectedOrder.listings?.slug ?? "—"}</DetailItem>
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Buyer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DetailItem label="Name">{selectedOrder.buyer_name}</DetailItem>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Phone">
                      {selectedOrder.buyer_phone ? (
                        <DetailLink href={normalizePhoneHref(selectedOrder.buyer_phone)} external={false}>
                          {selectedOrder.buyer_phone}
                        </DetailLink>
                      ) : (
                        "—"
                      )}
                    </DetailItem>
                    <DetailItem label="Email">
                      {selectedOrder.buyer_email ? (
                        <DetailLink href={`mailto:${selectedOrder.buyer_email}`} external={false}>
                          {selectedOrder.buyer_email}
                        </DetailLink>
                      ) : (
                        "—"
                      )}
                    </DetailItem>
                    <DetailItem label="Messenger">
                      {selectedOrder.buyer_messenger ? (
                        <DetailLink href={normalizeMessengerHref(selectedOrder.buyer_messenger)}>
                          {selectedOrder.buyer_messenger}
                        </DetailLink>
                      ) : (
                        "—"
                      )}
                    </DetailItem>
                    <DetailItem label="Instagram">
                      {selectedOrder.buyer_instagram ? (
                        <DetailLink href={normalizeInstagramHref(selectedOrder.buyer_instagram)}>
                          {selectedOrder.buyer_instagram}
                        </DetailLink>
                      ) : (
                        "—"
                      )}
                    </DetailItem>
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Request</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Size">{selectedOrder.size ?? "—"}</DetailItem>
                    <DetailItem label="Quantity">{selectedOrder.quantity}</DetailItem>
                  </div>
                  <DetailItem label="Message">
                    {selectedOrder.message ? (
                      <p className="whitespace-pre-line leading-relaxed">{selectedOrder.message}</p>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </DetailItem>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <DetailItem label="Created">{formatDate(selectedOrder.created_at)}</DetailItem>
                    <DetailItem label="Updated">{formatDate(selectedOrder.updated_at)}</DetailItem>
                  </div>
                  <DetailItem label="Order ID">
                    <span className="font-mono text-xs">{selectedOrder.id}</span>
                  </DetailItem>
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
