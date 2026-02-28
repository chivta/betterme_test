import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/shadcn/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Badge } from "@/components/shadcn/badge";
import { PlusCircle, MapPin, AlertCircle, Receipt } from "lucide-react";
import type { Order } from "../../../types";
import { CoordinatePicker } from "@/components/custom/CoordinatePicker";
import { usePreviewTax } from "../../../hooks/api/orders";

type CreateOrderCardProps = {
  onCreateOrder: (data: {
    latitude: number;
    longitude: number;
    subtotal: number;
  }) => void;
  createdOrder: Order | null;
  isCreating: boolean;
  createError: Error | null;
};

function CreateOrderCard({
  onCreateOrder,
  createdOrder,
  isCreating,
  createError,
}: CreateOrderCardProps) {
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingPayload = useRef<{ latitude: number; longitude: number; subtotal: number } | null>(null);
  const pendingReset = useRef(false);

  const { previewTaxAsync, taxPreview, isPreviewing, previewError, resetPreview } = usePreviewTax();

  useEffect(() => {
    if (pendingReset.current && createdOrder) {
      setLatitude("");
      setLongitude("");
      setSubtotal("");
      pendingReset.current = false;
    }
  }, [createdOrder]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      subtotal: parseFloat(subtotal),
    };
    pendingPayload.current = payload;
    resetPreview();
    try {
      await previewTaxAsync(payload);
      setDialogOpen(true);
    } catch {
      // previewError will be set by the mutation
    }
  };

  const handleConfirm = () => {
    if (!pendingPayload.current) return;
    pendingReset.current = true;
    onCreateOrder(pendingPayload.current);
    setDialogOpen(false);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    pendingPayload.current = null;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Create Order
          </CardTitle>
          <CardDescription>
            Manually create an order and calculate tax instantly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="latitude">Latitude</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="40.7128"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="longitude">Longitude</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="-74.0060"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  required
                />
              </div>
            </div>

            <CoordinatePicker
              lat={latitude}
              lng={longitude}
              onLatChange={setLatitude}
              onLngChange={setLongitude}
            />

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal ($)</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="50.00"
                value={subtotal}
                onChange={(e) => setSubtotal(e.target.value)}
                required
              />
            </div>

            {(previewError || createError) && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{(previewError ?? createError)!.message}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isPreviewing || isCreating}>
              {isPreviewing ? "Calculating tax..." : isCreating ? "Creating order..." : "Create & Calculate Tax"}
            </Button>
          </form>

          {createdOrder && (
            <div className="mt-4 p-4 rounded-md bg-muted space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                {createdOrder.county_name} County
                {createdOrder.special_rate > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    MCTD
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Subtotal</p>
                  <p className="font-medium">
                    ${createdOrder.subtotal.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-semibold text-lg">
                    ${createdOrder.total_amount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tax Rate</p>
                  <p className="font-medium">
                    {(createdOrder.composite_tax_rate * 100).toFixed(3)}%
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tax Amount</p>
                  <p className="font-medium">
                    ${createdOrder.tax_amount.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
                <span className="font-medium">Breakdown:</span> State{" "}
                {(createdOrder.state_rate * 100).toFixed(1)}% + County{" "}
                {(createdOrder.county_rate * 100).toFixed(2)}% + City{" "}
                {(createdOrder.city_rate * 100).toFixed(1)}% + Special{" "}
                {(createdOrder.special_rate * 100).toFixed(3)}%
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Tax Summary
            </DialogTitle>
            <DialogDescription>
              Review the calculated tax before confirming the order.
            </DialogDescription>
          </DialogHeader>

          {taxPreview && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {taxPreview.county_name
                  ? `${taxPreview.county_name} County`
                  : "Tax jurisdiction resolved"}
                {taxPreview.special_rate > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    MCTD
                  </Badge>
                )}
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Subtotal</p>
                    <p className="font-medium text-base">
                      ${taxPreview.subtotal.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tax Amount</p>
                    <p className="font-medium text-base">
                      ${taxPreview.tax_amount.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Tax Rate</p>
                    <p className="font-medium">
                      {(taxPreview.composite_tax_rate * 100).toFixed(3)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-semibold text-lg text-primary">
                      ${taxPreview.total_amount.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground mb-1">Rate Breakdown</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>State</span>
                    <span className="text-right font-mono">{(taxPreview.state_rate * 100).toFixed(3)}%</span>
                    <span>County</span>
                    <span className="text-right font-mono">{(taxPreview.county_rate * 100).toFixed(3)}%</span>
                    <span>City</span>
                    <span className="text-right font-mono">{(taxPreview.city_rate * 100).toFixed(3)}%</span>
                    <span>Special (MCTD)</span>
                    <span className="text-right font-mono">{(taxPreview.special_rate * 100).toFixed(3)}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCancel} disabled={isCreating}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isCreating}>
              {isCreating ? "Creating..." : "Confirm & Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { CreateOrderCard };
