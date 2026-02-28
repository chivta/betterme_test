import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GeoJSON } from "react-leaflet";
import type { Layer, PathOptions, LeafletMouseEvent } from "leaflet";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Badge } from "@/components/shadcn/badge";
import { Separator } from "@/components/shadcn/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  ArrowLeft,
  MapPin,
  AlertCircle,
  Receipt,
  LogOut,
  ExternalLink,
  Sun,
  Moon,
  MousePointerClick,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/auth";
import { useLogout } from "@/contexts/auth/hooks/api";
import { getStoredRefreshToken } from "@/shared/api/client";
import { CoordinatePicker } from "@/components/custom/CoordinatePicker";
import {
  useCreateOrder,
  usePreviewTax,
} from "@/contexts/board/elements/orders/dashboard/hooks/api/orders";
import { useTheme } from "@/hooks/useTheme";
import { useJurisdictionsGeoJSON } from "@/hooks/useJurisdictionsGeoJSON";
import { useNYBoundaryGeoJSON } from "@/hooks/useNYBoundaryGeoJSON";

const BOUNDARY_STYLE: PathOptions = {
  color: "#6366f1",
  weight: 2,
  opacity: 0.5,
  fillColor: "#6366f1",
  fillOpacity: 0.06,
};

const COUNTY_STYLE: PathOptions = {
  color: "#6366f1",
  weight: 1.5,
  opacity: 0.55,
  fillColor: "#6366f1",
  fillOpacity: 0.04,
};

const COUNTY_HOVER_STYLE: PathOptions = {
  weight: 2.5,
  opacity: 0.9,
  fillOpacity: 0.13,
};

function CreateOrderPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { logoutAsync } = useLogout();
  const { theme, toggleTheme } = useTheme();

  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const pendingPayload = useRef<{
    latitude: number;
    longitude: number;
    subtotal: number;
  } | null>(null);

  const { createOrder, createdOrder, isCreating, createError } =
    useCreateOrder();
  const {
    previewTaxAsync,
    taxPreview,
    isPreviewing,
    previewError,
    resetPreview,
  } = usePreviewTax();
  const { data: jurisdictions } = useJurisdictionsGeoJSON();
  const { data: nyBoundary } = useNYBoundaryGeoJSON();

  const onEachCounty = useCallback(
    (feature: GeoJSON.Feature, layer: Layer) => {
      const name: string = feature.properties?.county_name ?? "Unknown";

      layer.bindTooltip(name, {
        sticky: true,
        direction: "top",
        offset: [0, -4],
        className: "leaflet-county-tooltip",
      });

      layer.on({
        mouseover(e: LeafletMouseEvent) {
          (e.target as { setStyle: (s: PathOptions) => void }).setStyle(
            COUNTY_HOVER_STYLE,
          );
        },
        mouseout(e: LeafletMouseEvent) {
          (e.target as { setStyle: (s: PathOptions) => void }).setStyle(
            COUNTY_STYLE,
          );
        },
      });
    },
    [],
  );

  useEffect(() => {
    if (createdOrder) {
      toast.success("Order created successfully!", {
        description: `$${createdOrder.total_amount.toFixed(2)} total · ${createdOrder.county_name} County`,
      });
      navigate("/");
    }
  }, [createdOrder, navigate]);

  const handleLogout = async () => {
    const rt = getStoredRefreshToken();
    try {
      if (rt) await logoutAsync(rt);
    } catch {
      toast.error(
        "Sign-out request failed, but you have been logged out locally.",
      );
    }
    logout();
  };

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
      // previewError state handles display
    }
  };

  const handleConfirm = () => {
    if (!pendingPayload.current) return;
    createOrder(pendingPayload.current);
    setDialogOpen(false);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    pendingPayload.current = null;
  };

  const hasCoords = latitude !== "" && longitude !== "";

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ── App header ── */}
      <header className="shrink-0 border-b bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm z-20">
        <div className="w-full px-6 flex h-14 items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">Instant Wellness</h1>
            <Separator orientation="vertical" className="h-6" />
            <span className="text-sm text-muted-foreground">Tax Admin</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" asChild>
              <a
                href="/swagger/index.html"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                API Docs
              </a>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1.5 h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* ── Split pane ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left panel: form ── */}
        <aside className="w-[380px] shrink-0 flex flex-col overflow-y-auto border-r bg-background z-10">
          {/* Panel header */}
          <div className="px-6 pt-5 pb-4 border-b">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="-ml-2 mb-3 text-muted-foreground hover:text-foreground"
            >
              <Link to="/">
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Orders
              </Link>
            </Button>
            <h2 className="text-lg font-semibold">New Order</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Click the map to pin a location, then set the subtotal.
            </p>
          </div>

          {/* Form body */}
          <form
            onSubmit={handleSubmit}
            className="flex flex-col flex-1"
          >
            <div className="px-6 py-5 space-y-5 flex-1">
              {/* Coordinate inputs */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Location
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="latitude" className="text-xs">
                      Latitude
                    </Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      placeholder="40.7128"
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      required
                      className="font-mono text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="longitude" className="text-xs">
                      Longitude
                    </Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      placeholder="-74.0060"
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      required
                      className="font-mono text-sm"
                    />
                  </div>
                </div>

                {/* Coord hint / selected location chip */}
                {hasCoords ? (
                  <div className="flex items-center gap-2 rounded-lg bg-primary/8 border border-primary/20 px-3 py-2 text-sm">
                    <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span className="font-mono text-xs text-foreground">
                      {parseFloat(latitude).toFixed(5)},{" "}
                      {parseFloat(longitude).toFixed(5)}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-dashed px-3 py-2 text-xs text-muted-foreground">
                    <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
                    Click anywhere on the map to set coordinates
                  </div>
                )}
              </div>

              <Separator />

              {/* Subtotal */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Order details
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="subtotal" className="text-xs">
                    Subtotal (USD)
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
                      $
                    </span>
                    <Input
                      id="subtotal"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={subtotal}
                      onChange={(e) => setSubtotal(e.target.value)}
                      required
                      className="pl-7 font-mono"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pre-tax amount. Tax is calculated based on the pinned
                    location.
                  </p>
                </div>
              </div>

              {/* Error */}
              {(previewError || createError) && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{(previewError ?? createError)!.message}</span>
                </div>
              )}
            </div>

            {/* Sticky footer actions */}
            <div className="px-6 py-4 border-t bg-background flex flex-col gap-2">
              <Button
                type="submit"
                disabled={isPreviewing || isCreating}
                className="w-full"
              >
                {isPreviewing
                  ? "Calculating tax…"
                  : isCreating
                    ? "Creating order…"
                    : "Preview Tax & Create Order"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                asChild
                className="w-full text-muted-foreground"
              >
                <Link to="/">Cancel</Link>
              </Button>
            </div>
          </form>
        </aside>

        {/* ── Right panel: full-height map ── */}
        <div className="flex-1 relative overflow-hidden">
          <CoordinatePicker
            lat={latitude}
            lng={longitude}
            onLatChange={setLatitude}
            onLngChange={setLongitude}
            className="absolute inset-0 w-full h-full [&_.leaflet-container_img]:border-none [&_.leaflet-container_img]:outline-none"
          >
            {/* Full state boundary (includes Great Lakes + coastal water) */}
            {nyBoundary && (
              <GeoJSON
                key="ny-boundary"
                data={nyBoundary}
                style={() => BOUNDARY_STYLE}
              />
            )}
            {/* County lines on top */}
            {jurisdictions && (
              <GeoJSON
                key="ny-jurisdictions"
                data={jurisdictions}
                style={() => COUNTY_STYLE}
                onEachFeature={onEachCounty}
              />
            )}
          </CoordinatePicker>
        </div>
      </div>

      {/* ── Tax confirmation dialog ── */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCancel();
        }}
      >
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

                <div className="border-t pt-3 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">
                    Rate Breakdown
                  </p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    <span>State</span>
                    <span className="text-right font-mono">
                      {(taxPreview.state_rate * 100).toFixed(3)}%
                    </span>
                    <span>County</span>
                    <span className="text-right font-mono">
                      {(taxPreview.county_rate * 100).toFixed(3)}%
                    </span>
                    <span>City</span>
                    <span className="text-right font-mono">
                      {(taxPreview.city_rate * 100).toFixed(3)}%
                    </span>
                    <span>Special (MCTD)</span>
                    <span className="text-right font-mono">
                      {(taxPreview.special_rate * 100).toFixed(3)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={isCreating}>
              {isCreating ? "Creating…" : "Confirm & Create Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { CreateOrderPage };
