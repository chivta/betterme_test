import { useState, useRef } from "react";
import { useImportCSV, type ImportResult } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, CheckCircle, AlertCircle } from "lucide-react";

export default function ImportCSV() {
  const importMutation = useImportCSV();
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".csv")) {
      return;
    }
    setResult(null);
    try {
      const res = await importMutation.mutateAsync(file);
      setResult(res);
    } catch {
      // error is in importMutation.error
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Import CSV
        </CardTitle>
        <CardDescription>
          Upload a CSV file with columns: id, longitude, latitude, timestamp, subtotal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            dragOver
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleInputChange}
          />
          <FileText className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
          {importMutation.isPending ? (
            <div>
              <p className="text-sm font-medium">Processing...</p>
              <p className="text-xs text-muted-foreground mt-1">
                This may take a moment for large files
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drag & drop your CSV here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .csv files up to 50MB
              </p>
            </div>
          )}
        </div>

        {importMutation.error && (
          <div className="mt-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{importMutation.error.message}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 p-4 rounded-md bg-muted space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Import Complete
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Imported</p>
                <p className="font-semibold text-lg">{result.total_imported.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Failed</p>
                <p className="font-semibold text-lg">{result.total_failed}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Tax</p>
                <p className="font-semibold text-lg">${result.total_tax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
            {result.errors && result.errors.length > 0 && (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show errors ({result.errors.length})</summary>
                <ul className="mt-1 space-y-0.5 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
