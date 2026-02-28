import { Fragment, useState, useRef, useEffect, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/shadcn/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/shadcn/sheet";
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
  Upload,
  FileText,
  CheckCircle,
  Loader2,
  Trash2,
  X,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { Order, ImportResult } from "../../../types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = keyof Pick<
  Order,
  | "id"
  | "subtotal"
  | "composite_tax_rate"
  | "tax_amount"
  | "total_amount"
  | "county_name"
>;
type SortDir = "asc" | "desc";

type AppliedFilters = {
  county?: string;
  dateFrom?: string;
  dateTo?: string;
};

type FileStatus = {
  id: number;
  name: string;
  status: "pending" | "previewing" | "processing" | "done" | "error";
  result?: ImportResult;
  error?: string;
  preview?: string[][];
  file?: File;
};

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
  appliedFilters: AppliedFilters;
  onCityFilterChange: (v: string) => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
  onPageChange: (page: number) => void;
  onRefetch: () => void;
  onImport: (file: File) => Promise<ImportResult>;
  onDeleteAll: () => Promise<void>;
  isDeleting: boolean;
};

// ---------------------------------------------------------------------------
// CSV Preview parser (client-side, no deps)
// ---------------------------------------------------------------------------

function parseCSVPreview(text: string, maxRows = 5): string[][] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines.slice(0, maxRows + 1).map((line) => {
    const cols: string[] = [];
    let inQuote = false;
    let cur = "";
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (ch === "," && !inQuote) {
        cols.push(cur.trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  });
}

function readFilePreview(file: File, maxRows = 5): Promise<string[][]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      resolve(parseCSVPreview(text, maxRows));
    };
    reader.readAsText(file.slice(0, 32 * 1024));
  });
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = "importCSV_fileStatuses_v2";
let idCounter = 0;

function loadStoredStatuses(): FileStatus[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as FileStatus[];
    if (parsed.length > 0) idCounter = Math.max(...parsed.map((s) => s.id));
    return parsed.map((s) => ({ ...s, file: undefined, preview: s.preview }));
  } catch {
    return [];
  }
}

function saveStatuses(statuses: FileStatus[]) {
  try {
    const serializable = statuses.map(({ file: _f, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    // quota exceeded — fail silently
  }
}

// ---------------------------------------------------------------------------
// Import Sheet
// ---------------------------------------------------------------------------

type ImportSheetProps = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (file: File) => Promise<ImportResult>;
  onRefetch: () => void;
};

function ImportSheet({
  open,
  onOpenChange,
  onImport,
  onRefetch,
}: ImportSheetProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileStatuses, setFileStatuses] =
    useState<FileStatus[]>(loadStoredStatuses);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveStatuses(fileStatuses);
  }, [fileStatuses]);

  const updateStatus = useCallback(
    (id: number, patch: Partial<FileStatus>) =>
      setFileStatuses((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      ),
    [],
  );

  const processFiles = async (files: File[]) => {
    const csvFiles = files.filter((f) => f.name.toLowerCase().endsWith(".csv"));
    if (csvFiles.length === 0) return;

    const newEntries: FileStatus[] = csvFiles.map((f) => ({
      id: ++idCounter,
      name: f.name,
      status: "previewing",
      file: f,
    }));

    setFileStatuses((prev) => [...prev, ...newEntries]);
    setIsProcessing(true);

    for (let i = 0; i < csvFiles.length; i++) {
      const entry = newEntries[i];
      const preview = await readFilePreview(csvFiles[i]);
      updateStatus(entry.id, { preview, status: "pending" });

      updateStatus(entry.id, { status: "processing" });
      try {
        const result = await onImport(csvFiles[i]);
        updateStatus(entry.id, { status: "done", result, file: undefined });
        toast.success(
          `Imported ${result.total_imported.toLocaleString()} orders`,
          {
            description: `$${result.total_tax.toLocaleString(undefined, { minimumFractionDigits: 2 })} total tax · ${result.total_failed} failed`,
          },
        );
        onRefetch();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        updateStatus(entry.id, {
          status: "error",
          error: message,
          file: undefined,
        });
        toast.error(`Failed to import ${entry.name}`, { description: message });
      }
    }

    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (isProcessing) return;
    processFiles(Array.from(e.dataTransfer.files));
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) processFiles(Array.from(files));
  };

  const dismissFile = (id: number) =>
    setFileStatuses((prev) => prev.filter((s) => s.id !== id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Import CSV
          </SheetTitle>
          <SheetDescription>
            Columns: id, longitude, latitude, timestamp, subtotal
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Drop zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
              isProcessing
                ? "opacity-60 pointer-events-none border-muted-foreground/25"
                : dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50",
            )}
            onDragOver={(e) => {
              e.preventDefault();
              if (!isProcessing) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !isProcessing && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              multiple
              className="hidden"
              onChange={handleInputChange}
            />
            <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
            {isProcessing ? (
              <div>
                <p className="text-sm font-medium">Processing files…</p>
                <p className="text-xs text-muted-foreground mt-1">
                  This may take a moment for large files
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium">
                  Drag & drop CSV files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Supports multiple .csv files · up to 50 MB each
                </p>
              </div>
            )}
          </div>

          {/* File history */}
          {fileStatuses.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Upload history
              </p>
              <ul className="space-y-2">
                {fileStatuses.map((s) => (
                  <FileStatusItem key={s.id} s={s} onDismiss={dismissFile} />
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// File Status Item (with preview)
// ---------------------------------------------------------------------------

function FileStatusItem({
  s,
  onDismiss,
}: {
  s: FileStatus;
  onDismiss: (id: number) => void;
}) {
  const [showPreview, setShowPreview] = useState(false);

  const header = s.preview?.[0];
  const rows = s.preview?.slice(1);

  return (
    <li className="rounded-md border border-border p-3 text-sm space-y-2">
      <div className="flex items-center gap-2">
        {s.status === "previewing" && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />
        )}
        {s.status === "pending" && (
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
        {s.status === "processing" && (
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
        )}
        {s.status === "done" && (
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
        )}
        {s.status === "error" && (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
        <span className="font-medium truncate flex-1" title={s.name}>
          {s.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {s.preview && s.preview.length > 0 && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle preview"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          )}
          {(s.status === "done" || s.status === "error") && (
            <button
              onClick={() => onDismiss(s.id)}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* CSV preview table */}
      {showPreview && header && rows && (
        <div className="overflow-x-auto rounded border border-border bg-muted/30">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b border-border">
                {header.map((col, i) => (
                  <th
                    key={i}
                    className="px-2 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      className="px-2 py-1.5 font-mono whitespace-nowrap"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border">
            Showing first {rows.length} data row{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Import result stats */}
      {s.status === "done" && s.result && (
        <div className="grid grid-cols-3 gap-2 text-xs pl-6">
          <div>
            <p className="text-muted-foreground">Imported</p>
            <p className="font-semibold">
              {s.result.total_imported.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Failed</p>
            <p className="font-semibold">{s.result.total_failed}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Total Tax</p>
            <p className="font-semibold">
              $
              {s.result.total_tax.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
          {s.result.errors && s.result.errors.length > 0 && (
            <details className="col-span-3 text-muted-foreground">
              <summary className="cursor-pointer">
                Show errors ({s.result.errors.length})
              </summary>
              <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                {s.result.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {s.status === "error" && (
        <p className="text-xs text-destructive pl-6">{s.error}</p>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

function SortIcon({
  col,
  sortKey,
  sortDir,
}: {
  col: SortKey;
  sortKey: SortKey | null;
  sortDir: SortDir;
}) {
  if (sortKey !== col)
    return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
  return (
    <ChevronDown
      className={cn(
        "h-3.5 w-3.5 ml-1 transition-transform duration-150",
        sortDir === "asc" && "rotate-180",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// OrdersTableCard
// ---------------------------------------------------------------------------

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
  appliedFilters,
  onCityFilterChange,
  onDateFromChange,
  onDateToChange,
  onApplyFilters,
  onClearFilters,
  onPageChange,
  onRefetch,
  onImport,
  onDeleteAll,
  isDeleting,
}: OrdersTableCardProps) {
  const hasPendingChanges =
    cityFilter !== (appliedFilters.county ?? "") ||
    dateFrom !== (appliedFilters.dateFrom ?? "") ||
    dateTo !== (appliedFilters.dateTo ?? "");

  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [importSheetOpen, setImportSheetOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteGeneration, setDeleteGeneration] = useState(0);

  const handleDeleteAll = async () => {
    await onDeleteAll();
    localStorage.removeItem(STORAGE_KEY);
    setDeleteGeneration((g) => g + 1);
    setConfirmDeleteOpen(false);
    onRefetch();
    toast.success("All orders dropped");
  };

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
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
    <>
      <ImportSheet
        key={deleteGeneration}
        open={importSheetOpen}
        onOpenChange={setImportSheetOpen}
        onImport={onImport}
        onRefetch={onRefetch}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ListFilter className="h-5 w-5" />
                Orders
              </CardTitle>
              <CardDescription>
                {isLoading
                  ? "Loading…"
                  : `${total.toLocaleString()} orders total`}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportSheetOpen(true)}
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      disabled={isDeleting || total === 0}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Drop all
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Drop all orders?</DialogTitle>
                      <DialogDescription>
                        This will permanently drop all {total.toLocaleString()} orders from the
                        database. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteAll}
                        disabled={isDeleting}
                      >
                        {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                        Yes, drop all
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Filter by city…"
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
            <Button
              variant="secondary"
              size="sm"
              onClick={onApplyFilters}
              className={cn(hasPendingChanges && "animate-pulse")}
            >
              Apply
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearFilters}>
              Clear
            </Button>
          </div>

          {/* Error banner */}
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

          {/* Table */}
          <div className="rounded-md border-2 [&_th]:border-x-2 [&_td]:border-x-2 [&_th:first-child]:border-l-0 [&_th:last-child]:border-r-0 [&_td:first-child]:border-l-0 [&_td:last-child]:border-r-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("id")}
                  >
                    <span className="inline-flex items-center">
                      ID
                      <SortIcon col="id" sortKey={sortKey} sortDir={sortDir} />
                    </span>
                  </TableHead>
                  <TableHead>Coordinates</TableHead>
                  <TableHead
                    className="cursor-pointer select-none"
                    onClick={() => handleSort("county_name")}
                  >
                    <span className="inline-flex items-center">
                      City
                      <SortIcon
                        col="county_name"
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => handleSort("subtotal")}
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      Subtotal
                      <SortIcon
                        col="subtotal"
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => handleSort("composite_tax_rate")}
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      Tax Rate
                      <SortIcon
                        col="composite_tax_rate"
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => handleSort("tax_amount")}
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      Tax
                      <SortIcon
                        col="tax_amount"
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer select-none"
                    onClick={() => handleSort("total_amount")}
                  >
                    <span className="inline-flex items-center justify-end w-full">
                      Total
                      <SortIcon
                        col="total_amount"
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    </span>
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
                      Loading orders…
                    </TableCell>
                  </TableRow>
                ) : !orders.length ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No orders found.{" "}
                      <button
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                        onClick={() => setImportSheetOpen(true)}
                      >
                        Import a CSV
                      </button>{" "}
                      or create one manually.
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
                            isExpanded && "bg-muted/30",
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
                                  isExpanded && "rotate-180",
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
                          <TableRow
                            key={`${order.id}-detail`}
                            className="hover:bg-transparent"
                          >
                            <TableCell colSpan={8} className="p-0 border-t-0">
                              <div className="animate-in slide-in-from-top-1 duration-200 bg-muted/30 border-t border-dashed pl-14 pr-6 py-4 space-y-4">
                                <div>
                                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                                    Tax Breakdown
                                  </p>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        State Rate
                                      </p>
                                      <p
                                        className={cn(
                                          "font-medium font-mono",
                                          order.state_rate === 0 &&
                                            "text-muted-foreground",
                                        )}
                                      >
                                        {(order.state_rate * 100).toFixed(2)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        County Rate
                                      </p>
                                      <p
                                        className={cn(
                                          "font-medium font-mono",
                                          order.county_rate === 0 &&
                                            "text-muted-foreground",
                                        )}
                                      >
                                        {(order.county_rate * 100).toFixed(2)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        City Rate
                                      </p>
                                      <p
                                        className={cn(
                                          "font-medium font-mono",
                                          order.city_rate === 0 &&
                                            "text-muted-foreground",
                                        )}
                                      >
                                        {(order.city_rate * 100).toFixed(2)}%
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        Special Rate (MCTD)
                                      </p>
                                      <p
                                        className={cn(
                                          "font-medium font-mono",
                                          order.special_rate === 0 &&
                                            "text-muted-foreground",
                                        )}
                                      >
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
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        Jurisdiction
                                      </p>
                                      <p className="font-medium">
                                        {order.county_name} County, NY
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        County FIPS
                                      </p>
                                      <p className="font-mono">
                                        {order.county_fips || "—"}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        Order Timestamp
                                      </p>
                                      <p className="font-mono text-xs">
                                        {new Date(
                                          order.timestamp,
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-muted-foreground text-xs mb-0.5">
                                        Created At
                                      </p>
                                      <p className="font-mono text-xs">
                                        {new Date(
                                          order.created_at,
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
    </>
  );
}

export { OrdersTableCard };
