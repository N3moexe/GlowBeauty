import { type ReactNode, useState } from "react";
import {
  type ColumnDef,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import DataTableToolbar from "@/components/admin/DataTableToolbar";
import EmptyState from "@/components/admin/EmptyState";
import SkeletonTable from "@/components/admin/SkeletonTable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableBulkContext<TData> = {
  rows: TData[];
  clearSelection: () => void;
};

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  isLoading?: boolean;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  savedViews?: ReactNode;
  renderBulkActions?: (context: DataTableBulkContext<TData>) => ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyCtaLabel?: string;
  onEmptyCtaClick?: () => void;
  onRowClick?: (row: TData) => void;
  getRowId?: (originalRow: TData, index: number, parent?: Row<TData>) => string;
  getColumnLabel?: (columnId: string) => string;
  initialSorting?: SortingState;
  initialPageSize?: number;
  className?: string;
  tableClassName?: string;
};

export default function DataTable<TData>({
  columns,
  data,
  isLoading = false,
  searchValue,
  onSearchValueChange,
  searchPlaceholder,
  filters,
  savedViews,
  renderBulkActions,
  emptyTitle = "No data found",
  emptyDescription,
  emptyCtaLabel,
  onEmptyCtaClick,
  onRowClick,
  getRowId,
  getColumnLabel,
  initialSorting = [],
  initialPageSize = 10,
  className,
  tableClassName,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId,
    enableRowSelection: true,
  });

  const selectedRows = table.getFilteredSelectedRowModel().rows.map(row => row.original);
  const clearSelection = () => setRowSelection({});

  if (isLoading) {
    return <SkeletonTable rows={6} />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        ctaLabel={emptyCtaLabel}
        onCtaClick={onEmptyCtaClick}
      />
    );
  }

  return (
    <div className={cn("rounded-xl border bg-card", className)}>
      <div className="border-b px-3 py-3 md:px-4">
        <DataTableToolbar
          table={table}
          searchValue={searchValue}
          onSearchValueChange={onSearchValueChange}
          searchPlaceholder={searchPlaceholder}
          filters={filters}
          savedViews={savedViews}
          bulkActions={renderBulkActions?.({ rows: selectedRows, clearSelection })}
          getColumnLabel={getColumnLabel}
        />
      </div>

      <Table className={cn("min-w-[940px]", tableClassName)}>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => {
                if (header.isPlaceholder) {
                  return <TableHead key={header.id} />;
                }

                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                const sortingIcon = sorted === "asc"
                  ? <ArrowUp className="h-3.5 w-3.5" />
                  : sorted === "desc"
                    ? <ArrowDown className="h-3.5 w-3.5" />
                    : <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />;

                return (
                  <TableHead key={header.id}>
                    {canSort ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="-ml-2 h-8 px-2 font-medium"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <span className="truncate">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                        {sortingIcon}
                      </Button>
                    ) : (
                      <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                No matching results.
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map(row => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={cn(onRowClick && "cursor-pointer")}
                onClick={() => onRowClick?.(row.original)}
              >
                {row.getVisibleCells().map(cell => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <div className="flex flex-col gap-2 border-t px-3 py-3 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between md:px-4">
        <div>
          {selectedRows.length > 0
            ? `${selectedRows.length} selected / ${table.getFilteredRowModel().rows.length} total`
            : `${table.getFilteredRowModel().rows.length} total rows`}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(table.getState().pagination.pageSize)}
            onValueChange={value => table.setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[84px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[10, 20, 50, 100].map(size => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="min-w-[96px] text-center">
            Page {table.getState().pagination.pageIndex + 1} / {Math.max(table.getPageCount(), 1)}
          </span>

          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Prev
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
