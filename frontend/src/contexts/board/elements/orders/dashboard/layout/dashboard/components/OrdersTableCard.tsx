import { Fragment, useState } from 'react'
import { Button } from '@/components/shadcn/button'
import { Input } from '@/components/shadcn/input'
import { Badge } from '@/components/shadcn/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { HTMLKeyEventValues } from '@/types'
import { ChevronLeft, ChevronRight, ListFilter, ChevronDown, ChevronUp, AlertCircle, RefreshCw } from 'lucide-react'
import type { Order } from '../../../types'

type OrdersTableCardProps = {
  orders: Order[]
  total: number
  page: number
  totalPages: number
  isLoading: boolean
  error: Error | null
  countyFilter: string
  dateFrom: string
  dateTo: string
  onCountyFilterChange: (v: string) => void
  onDateFromChange: (v: string) => void
  onDateToChange: (v: string) => void
  onApplyFilters: () => void
  onClearFilters: () => void
  onPageChange: (page: number) => void
  onRefetch: () => void
}

function OrdersTableCard({
  orders,
  total,
  page,
  totalPages,
  isLoading,
  error,
  countyFilter,
  dateFrom,
  dateTo,
  onCountyFilterChange,
  onDateFromChange,
  onDateToChange,
  onApplyFilters,
  onClearFilters,
  onPageChange,
  onRefetch,
}: OrdersTableCardProps) {
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListFilter className="h-5 w-5" />
          Orders
        </CardTitle>
        <CardDescription>
          {isLoading ? 'Loading...' : `${total.toLocaleString()} orders total`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Filter by county..."
            value={countyFilter}
            onChange={(e) => onCountyFilterChange(e.target.value)}
            onKeyDown={(e) => e.key === HTMLKeyEventValues.Enter && onApplyFilters()}
            className="w-48"
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-40"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-40"
          />
          <Button variant="secondary" size="sm" onClick={onApplyFilters}>Apply</Button>
          <Button variant="ghost" size="sm" onClick={onClearFilters}>Clear</Button>
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
              ) : !orders.length ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No orders found. Import a CSV or create one manually.
                  </TableCell>
                </TableRow>
              ) : (
                orders.map((order) => (
                  <Fragment key={order.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === order.id ? null : order.id)}
                    >
                      <TableCell>
                        {expandedRow === order.id
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{order.external_id || order.id}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {order.latitude.toFixed(4)}, {order.longitude.toFixed(4)}
                      </TableCell>
                      <TableCell>
                        {order.county_name || '—'}
                        {order.special_rate > 0 && (
                          <Badge variant="outline" className="ml-1.5 text-[10px]">MCTD</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">${order.subtotal.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {order.composite_tax_rate ? `${(order.composite_tax_rate * 100).toFixed(3)}%` : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">${order.tax_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">${order.total_amount.toFixed(2)}</TableCell>
                    </TableRow>

                    {expandedRow === order.id && (
                      <TableRow key={`${order.id}-detail`}>
                        <TableCell colSpan={8} className="bg-muted/50">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">State Rate</p>
                              <p className="font-medium">{(order.state_rate * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">County Rate</p>
                              <p className="font-medium">{(order.county_rate * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">City Rate</p>
                              <p className="font-medium">{(order.city_rate * 100).toFixed(2)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Special Rate (MCTD)</p>
                              <p className="font-medium">{(order.special_rate * 100).toFixed(3)}%</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">County FIPS</p>
                              <p className="font-mono">{order.county_fips || '—'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Timestamp</p>
                              <p className="font-mono text-xs">{new Date(order.timestamp).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Created</p>
                              <p className="font-mono text-xs">{new Date(order.created_at).toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Jurisdiction</p>
                              <p>{order.county_name} County, NY</p>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
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
  )
}

export { OrdersTableCard }
