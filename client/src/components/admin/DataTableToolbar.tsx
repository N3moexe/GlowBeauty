import type { ReactNode } from "react";
import type { Column, Table } from "@tanstack/react-table";
import { Search, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: ReactNode;
  savedViews?: ReactNode;
  bulkActions?: ReactNode;
  getColumnLabel?: (columnId: string) => string;
  className?: string;
};

function defaultColumnLabel<TData>(column: Column<TData, unknown>) {
  const header = column.columnDef.header;
  if (typeof header === "string") return header;
  return column.id.replace(/_/g, " ");
}

export default function DataTableToolbar<TData>({
  table,
  searchValue,
  onSearchValueChange,
  searchPlaceholder = "Search...",
  filters,
  savedViews,
  bulkActions,
  getColumnLabel,
  className,
}: DataTableToolbarProps<TData>) {
  const columns = table.getAllLeafColumns().filter(column => column.getCanHide());

  return (
    <div className={cn("space-y-3", className)}>
      {savedViews}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center">
          {onSearchValueChange && (
            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue ?? ""}
                onChange={event => onSearchValueChange(event.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 pl-9"
              />
            </div>
          )}
          {filters}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {bulkActions}
          {columns.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {columns.map(column => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={value => column.toggleVisibility(Boolean(value))}
                  >
                    {getColumnLabel?.(column.id) || defaultColumnLabel(column)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
