import { useState } from "react";
import { useOrders, type OrderFilters } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, ListFilter, ChevronDown, ChevronUp } from "lucide-react";

export default function OrdersTable() {
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    pageSize: 20,
  });
  const [countyFilter, setCountyFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const { data, isLoading, error } = useOrders({
    ...filters,
    county: countyFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const applyFilters = () => {
    setFilters((f) => ({ ...f, page: 1 }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="h-5 w-5" />
          Orders
        </CardTitle>
        <CardDescription>
          {data ? `${data.total.toLocaleString()} orders total` : "Loading..."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Filter by county..."
            value={countyFilter}
            onChange={(e) => setCountyFilter(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            className="w-48"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40"
          />
          <Button variant="secondary" size="sm" onClick={applyFilters}>
            Apply
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCountyFilter("");
              setDateFrom("");
              setDateTo("");
              setFilters({ page: 1, pageSize: 20 });
            }}
          >
            Clear
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error.message}</p>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Coordinates</TableHead>
                <TableHead>County</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Tax Rate</TableHead>
                <TableHead className="text-right">Tax</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Loading orders...
                  </TableCell>
                </TableRow>
              ) : !data?.orders?.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No orders found. Import a CSV or create one manually.
                  </TableCell>
                </TableRow>
              ) : (
                data.orders.map((order) => (
                  <>
                    <TableRow
                      key={order.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setExpandedRow(expandedRow === order.id ? null : order.id)
                      }
                    >
                      <TableCell>
                        {expandedRow === order.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.external_id || order.id}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {order.county_name || "—"}
                        {order.special_rate > 0 && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">
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
                    {expandedRow === order.id && (
                      <TableRow key={`${order.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">State Rate</p>
                              <p className="font-medium">
                                {(order.state_rate * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">County Rate</p>
                              <p className="font-medium">
                                {(order.county_rate * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">City Rate</p>
                              <p className="font-medium">
                                {(order.city_rate * 100).toFixed(2)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">
                                Special Rate (MCTD)
                              </p>
                              <p className="font-medium">
                                {(order.special_rate * 100).toFixed(3)}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">County FIPS</p>
                              <p className="font-mono">{order.county_fips || "—"}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Timestamp</p>
                              <p className="font-mono text-xs">
                                {new Date(order.timestamp).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Created</p>
                              <p className="font-mono text-xs">
                                {new Date(order.created_at).toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Jurisdiction</p>
                              <p>{order.county_name} County, NY</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {data.page} of {data.total_pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={data.page >= data.total_pages}
                onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
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
