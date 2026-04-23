"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { PaginationState, SortingState } from "@tanstack/react-table";
import { toast } from "sonner";
import { Ban, Eye } from "lucide-react";
import { AdminDataTable, resolveUpdater, type AdminDataTableColumn } from "@/components/admin/AdminDataTable";
import { TableSearchInput } from "@/components/admin/TableSearchInput";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ADMIN_TABLE_PAGE_SIZE, type AdminTableQuery, type AdminTableResult } from "@/lib/admin-table";
import { createClient } from "@/lib/supabase/client";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { Sale, SaleItem, SalePaymentMethod, SaleStatus } from "@/types";

type SaleRow = Sale & {
  sale_items: SaleItem[];
  cashier: { full_name: string | null } | null;
};

const SORTABLE_COLUMNS = new Set(["sale_number", "total", "payment_method", "status", "created_at"]);

const paymentLabels: Record<SalePaymentMethod, string> = {
  cash: "Cash",
  gcash: "GCash",
  bank_transfer: "Bank Transfer",
  card: "Card",
  other: "Other",
};

function formatMoney(value: number) {
  return `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function getStatusVariant(status: SaleStatus): "default" | "secondary" | "destructive" | "outline" {
  return status === "voided" ? "destructive" : "default";
}

async function getSalesPageData({
  search,
  page,
  pageSize,
  sortBy,
  sortDirection,
}: AdminTableQuery): Promise<AdminTableResult<SaleRow>> {
  const supabase = createClient();
  const normalizedSearch = search.trim();
  const sortColumn = sortBy && SORTABLE_COLUMNS.has(sortBy) ? sortBy : "created_at";

  let salesQuery = supabase
    .from("sales")
    .select("*, sale_items(*), cashier:profiles!sales_cashier_id_fkey(full_name)", { count: "exact" })
    .order(sortColumn, { ascending: sortDirection === "asc" });

  if (normalizedSearch) {
    salesQuery = salesQuery.or(`sale_number.ilike.%${normalizedSearch}%,payment_method.ilike.%${normalizedSearch}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, count } = await salesQuery.range(from, to);

  return {
    rows: (data ?? []) as SaleRow[],
    total: count ?? 0,
  };
}

export function SalesClient() {
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([{ id: "created_at", desc: true }]);
  const [hasSales, setHasSales] = useState(false);
  const [selectedSale, setSelectedSale] = useState<SaleRow | null>(null);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [voidingSaleId, setVoidingSaleId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);
  const pageSize = ADMIN_TABLE_PAGE_SIZE;
  const pagination: PaginationState = { pageIndex: page - 1, pageSize };
  const pageCount = Math.ceil(total / pageSize);
  const activeSort = sorting[0];

  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    const { rows, total } = await getSalesPageData({
      search: debouncedSearch,
      page,
      pageSize,
      sortBy: activeSort?.id,
      sortDirection: activeSort?.desc ? "desc" : "asc",
    });
    setSales(rows);
    setTotal(total);
    if (!debouncedSearch.trim()) {
      setHasSales(total > 0);
    }
    setIsLoading(false);
  }, [activeSort?.desc, activeSort?.id, debouncedSearch, page, pageSize]);

  useEffect(() => {
    let isCurrent = true;

    const loadSales = async () => {
      const { rows, total } = await getSalesPageData({
        search: debouncedSearch,
        page,
        pageSize,
        sortBy: activeSort?.id,
        sortDirection: activeSort?.desc ? "desc" : "asc",
      });

      if (!isCurrent) return;

      setSales(rows);
      setTotal(total);
      if (!debouncedSearch.trim()) {
        setHasSales(total > 0);
      }
      setIsLoading(false);
    };

    loadSales();

    return () => {
      isCurrent = false;
    };
  }, [activeSort?.desc, activeSort?.id, debouncedSearch, page, pageSize]);

  const hasSearch = Boolean(debouncedSearch.trim());

  const voidSale = useCallback(async (sale: SaleRow) => {
    if (sale.status === "voided") return;
    if (!window.confirm(`Void sale ${sale.sale_number}? Inventory will be restored.`)) return;

    setVoidingSaleId(sale.id);
    const response = await fetch(`/api/sales/${sale.id}/void`, { method: "PUT" });
    const result = (await response.json()) as { error?: string };
    setVoidingSaleId(null);

    if (!response.ok) {
      toast.error(result.error ?? "Failed to void sale");
      return;
    }

    toast.success("Sale voided");
    setIsDetailsSheetOpen(false);
    setSelectedSale(null);
    fetchSales();
  }, [fetchSales]);

  const columns = useMemo<AdminDataTableColumn<SaleRow>[]>(
    () => [
      {
        accessorKey: "sale_number",
        header: "Sale",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-4 w-28" /> },
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.sale_number}</span>,
      },
      {
        id: "cashier",
        header: "Cashier",
        meta: { skeleton: <Skeleton className="h-4 w-28" /> },
        cell: ({ row }) => row.original.cashier?.full_name ?? <span className="text-muted-foreground">—</span>,
      },
      {
        id: "items",
        header: "Items",
        meta: { skeleton: <Skeleton className="h-4 w-12" /> },
        cell: ({ row }) => row.original.sale_items.reduce((sum, item) => sum + item.quantity, 0),
      },
      {
        accessorKey: "total",
        header: "Total",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-4 w-16" /> },
        cell: ({ row }) => formatMoney(row.original.total),
      },
      {
        accessorKey: "payment_method",
        header: "Payment",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
        cell: ({ row }) => <Badge variant="outline">{paymentLabels[row.original.payment_method]}</Badge>,
      },
      {
        accessorKey: "status",
        header: "Status",
        enableSorting: true,
        meta: { skeleton: <Skeleton className="h-5 w-20 rounded-full" /> },
        cell: ({ row }) => <Badge variant={getStatusVariant(row.original.status)}>{row.original.status}</Badge>,
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
        cell: ({ row }) => (
          <div className="flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setSelectedSale(row.original);
                setIsDetailsSheetOpen(true);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={row.original.status === "voided" || voidingSaleId === row.original.id}
              onClick={() => voidSale(row.original)}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [voidSale, voidingSaleId],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Sales</h1>
        <TableSearchInput
          value={search}
          onChange={(event) => {
            setIsLoading(true);
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search sale number..."
          aria-label="Search sales"
        />
      </div>

      <AdminDataTable
        columns={columns}
        data={sales}
        getRowId={(sale) => sale.id}
        isLoading={isLoading}
        emptyMessage={hasSearch && hasSales ? "No sales match your search." : "No sales yet."}
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
        onRowClick={(sale) => {
          setSelectedSale(sale);
          setIsDetailsSheetOpen(true);
        }}
      />

      <Sheet
        open={isDetailsSheetOpen}
        onOpenChange={(open) => {
          setIsDetailsSheetOpen(open);
          if (!open) setSelectedSale(null);
        }}
      >
        <SheetContent className="w-[400px] overflow-y-auto sm:w-[540px]">
          <SheetHeader className="px-6 pt-6">
            <SheetTitle>{selectedSale ? `Sale ${selectedSale.sale_number}` : "Sale Details"}</SheetTitle>
          </SheetHeader>
          {selectedSale && (
            <div className="space-y-6 px-6 pb-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={getStatusVariant(selectedSale.status)}>{selectedSale.status}</Badge>
                <Badge variant="outline">{paymentLabels[selectedSale.payment_method]}</Badge>
                {selectedSale.status !== "voided" && (
                  <Button size="sm" variant="destructive" onClick={() => voidSale(selectedSale)}>
                    Void Sale
                  </Button>
                )}
              </div>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Payment</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-medium">{formatMoney(selectedSale.total)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paid</span>
                    <span>{formatMoney(selectedSale.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Change</span>
                    <span>{formatMoney(selectedSale.change_due)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cashier</span>
                    <span>{selectedSale.cashier?.full_name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{formatDate(selectedSale.created_at)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card size="sm">
                <CardHeader>
                  <CardTitle>Items</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSale.sale_items.map((item) => (
                    <div key={item.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{item.listing_title}</p>
                          <p className="text-xs text-muted-foreground">
                            Size {item.size} · Qty {item.quantity} · {formatMoney(item.unit_price)}
                          </p>
                        </div>
                        <span className="font-medium">{formatMoney(item.line_total)}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
