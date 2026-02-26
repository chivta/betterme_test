import { Fragment, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Badge } from "@/components/shadcn/badge";
import { Separator } from "@/components/shadcn/separator";
import { DateRangePicker } from "@/components/custom/DateRangePicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/shadcn/table";
import { cn } from "@/components/utils/utils";
import { HTMLKeyEventValues } from "@/types";
import {
  ChevronLeft,
  ChevronRight,
  ListFilter,
  ChevronDown,
  ChevronsUpDown,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Order } from "../../../types";

type SortKey = keyof Pick<
  Order,
  "id" | "subtotal" | "composite_tax_rate" | "tax_amount" | "total_amount" | "county_name"
>;
type SortDir = "asc" | "desc";

type OrdersTableCardProps = {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  error: Error | null;
  cityFilter: string;
  dateFrom: string;
  dateTo: string;
  onCityFilterChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
};

function OrdersTableCard({
  orders,
  total,
  page,
  totalPages,
  isLoading,
  error,
  cityFilter,
  dateFrom,
  dateTo,
  onCityFilterChange,
  onDateFromChange,
  onDateToChange,
  onApplyFilters,
  onClearFilters,
  onPageChange,
  onRefetch,
}: OrdersTableCardProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return (
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 ml-1 transition-transform duration-150",
          sortDir === "asc" && "rotate-180"
        )}
      />
    );
  }

  const sortedOrders = sortKey
    ? [...orders].sort((a, b) => {
        const aVal = a[sortKey] ?? "";
        const bVal = b[sortKey] ?? "";
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      })
    : orders;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="h-5 w-5" />
          Orders
        </CardTitle>
        <CardDescription>
          {isLoading ? "Loading..." : `${total.toLocaleString()} orders total`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Filter by city..."
            value={cityFilter}
            onChange={(e) => onCityFilterChange(e.target.value)}
            onKeyDown={(e) =>
              e.key === HTMLKeyEventValues.Enter && onApplyFilters()
            }
            className="w-48"
          />
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={onDateFromChange}
            onDateToChange={onDateToChange}
          />
          <Button variant="secondary" size="sm" onClick={onApplyFilters}>
            Apply
          </Button>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>
            Clear
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error.message}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefetch}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
          </div>
        )}

        <div className="rounded-md border-2 [&_th]:border-x-2 [&_td]:border-x-2 [&_th:first-child]:border-l-0 [&_th:last-child]:border-r-0 [&_td:first-child]:border-l-0 [&_td:last-child]:border-r-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("id")}
                >
                  <span className="inline-flex items-center">ID<SortIcon col="id" /></span>
                </TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("county_name")}
                >
                  <span className="inline-flex items-center">City<SortIcon col="county_name" /></span>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("subtotal")}
                >
                  <span className="inline-flex items-center justify-end w-full">Subtotal<SortIcon col="subtotal" /></span>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("composite_tax_rate")}
                >
                  <span className="inline-flex items-center justify-end w-full">Tax Rate<SortIcon col="composite_tax_rate" /></span>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("tax_amount")}
                >
                  <span className="inline-flex items-center justify-end w-full">Tax<SortIcon col="tax_amount" /></span>
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("total_amount")}
                >
                  <span className="inline-flex items-center justify-end w-full">Total<SortIcon col="total_amount" /></span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    Loading orders...
                  </TableCell>
                </TableRow>
              ) : !orders.length ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-muted-foreground"
                  >
                    No orders found. Import a CSV or create one manually.
                  </TableCell>
                </TableRow>
              ) : (
                sortedOrders.map((order) => {
                  const isExpanded = expandedRow === order.id;
                  return (
                  <Fragment key={order.id}>
                    <TableRow
                      className={cn(
                        "cursor-pointer transition-colors",
                        isExpanded && "bg-muted/30"
                      )}
                      onClick={() =>
                        setExpandedRow(isExpanded ? null : order.id)
                      }
                    >
                      <TableCell>
                        <button
                          aria-expanded={isExpanded}
                          aria-label={`${isExpanded ? "Collapse" : "Expand"} order ${order.external_id || order.id}`}
                          className="flex items-center justify-center p-1 rounded hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRow(isExpanded ? null : order.id);
                          }}
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.external_id || order.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.latitude.toFixed(4)},{" "}
                        {order.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {order.county_name || "—"}
                        {order.special_rate > 0 && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-[10px]"
                          >
                            MCTD
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${order.subtotal.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {order.composite_tax_rate
                          ? `${(order.composite_tax_rate * 100).toFixed(3)}%`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        ${order.tax_amount.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        ${order.total_amount.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${order.id}-detail`} className="hover:bg-transparent">
                        <TableCell colSpan={8} className="p-0 border-t-0">
                          <div className="animate-in slide-in-from-top-1 duration-200 bg-muted/30 border-t border-dashed pl-14 pr-6 py-4 space-y-4">

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Tax Breakdown
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">State Rate</p>
                                  <p className={cn(
                                    "font-medium font-mono",
                                    order.state_rate === 0 && "text-muted-foreground"
                                  )}>
                                    {(order.state_rate * 100).toFixed(2)}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">County Rate</p>
                                  <p className={cn(
                                    "font-medium font-mono",
                                    order.county_rate === 0 && "text-muted-foreground"
                                  )}>
                                    {(order.county_rate * 100).toFixed(2)}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">City Rate</p>
                                  <p className={cn(
                                    "font-medium font-mono",
                                    order.city_rate === 0 && "text-muted-foreground"
                                  )}>
                                    {(order.city_rate * 100).toFixed(2)}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">Special Rate (MCTD)</p>
                                  <p className={cn(
                                    "font-medium font-mono",
                                    order.special_rate === 0 && "text-muted-foreground"
                                  )}>
                                    {(order.special_rate * 100).toFixed(3)}%
                                  </p>
                                </div>
                              </div>
                            </div>

                            <Separator />

                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                Order Details
                              </p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">Jurisdiction</p>
                                  <p className="font-medium">{order.county_name} County, NY</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">County FIPS</p>
                                  <p className="font-mono">{order.county_fips || "—"}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">Order Timestamp</p>
                                  <p className="font-mono text-xs">{new Date(order.timestamp).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground text-xs mb-0.5">Created At</p>
                                  <p className="font-mono text-xs">{new Date(order.created_at).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )})
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { OrdersTableCard };
