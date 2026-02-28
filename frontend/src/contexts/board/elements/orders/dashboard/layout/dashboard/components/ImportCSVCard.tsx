import { useState, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
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
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import type { ImportResult } from "../../../types";

type FileStatus = {
  id: number;
  name: string;
  status: "pending" | "processing" | "done" | "error";
  result?: ImportResult;
  error?: string;
};

type ImportCSVCardProps = {
  onImport: (file: File) => Promise<ImportResult>;
  importResult: ImportResult | null;
  isImporting: boolean;
  importError: Error | null;
  onDeleteAll: () => Promise<void>;
  isDeleting: boolean;
};

let idCounter = 0;

function ImportCSVCard({ onImport, onDeleteAll, isDeleting }: ImportCSVCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [fileStatuses, setFileStatuses] = useState<FileStatus[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (files: File[]) => {
    const csvFiles = files.filter((f) => f.name.endsWith(".csv"));
    if (csvFiles.length === 0) return;

    const newEntries: FileStatus[] = csvFiles.map((f) => ({
      id: ++idCounter,
      name: f.name,
      status: "pending",
    }));

    setFileStatuses((prev) => [...prev, ...newEntries]);
    setIsProcessing(true);

    for (let i = 0; i < csvFiles.length; i++) {
      const entryId = newEntries[i].id;

      setFileStatuses((prev) =>
        prev.map((s) =>
          s.id === entryId ? { ...s, status: "processing" } : s,
        ),
      );
      try {
        const result = await onImport(csvFiles[i]);
        setFileStatuses((prev) =>
          prev.map((s) =>
            s.id === entryId ? { ...s, status: "done", result } : s,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setFileStatuses((prev) =>
          prev.map((s) =>
            s.id === entryId ? { ...s, status: "error", error: message } : s,
          ),
        );
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

  const handleDeleteAll = async () => {
    await onDeleteAll();
    setFileStatuses([]);
    setConfirmOpen(false);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import CSV
            </CardTitle>
            <CardDescription className="mt-1.5">
              Upload one or more CSV files with columns: id, longitude, latitude,
              timestamp, subtotal
            </CardDescription>
          </div>
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="shrink-0"
                disabled={isDeleting || isProcessing}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Drop all records
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Drop all records?</DialogTitle>
                <DialogDescription>
                  This will permanently delete every order from the database.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConfirmOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAll}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  Yes, delete all
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isProcessing
              ? "opacity-60 pointer-events-none border-muted-foreground/25"
              : dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
          }`}
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
              <p className="text-sm font-medium">Processing files...</p>
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
                Supports multiple .csv files up to 50MB each
              </p>
            </div>
          )}
        </div>

        {fileStatuses.length > 0 && (
          <ul className="mt-4 space-y-2">
            {fileStatuses.map((s) => (
              <li
                key={s.id}
                className="rounded-md border border-border p-3 text-sm space-y-1.5"
              >
                <div className="flex items-center gap-2">
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
                  <span className="font-medium truncate" title={s.name}>
                    {s.name}
                  </span>
                </div>

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
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ImportCSVCard };
