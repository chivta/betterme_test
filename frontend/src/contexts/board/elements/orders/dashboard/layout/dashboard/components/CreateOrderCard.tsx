import { useState } from "react";
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
import { Badge } from "@/components/shadcn/badge";
import { PlusCircle, MapPin, AlertCircle } from "lucide-react";
import type { Order } from "../../../types";

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateOrder({
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      subtotal: parseFloat(subtotal),
    });
    setLatitude("");
    setLongitude("");
    setSubtotal("");
  };

  return (
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

          {createError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{createError.message}</span>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isCreating}>
            {isCreating ? "Calculating..." : "Create & Calculate Tax"}
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
  );
}

export { CreateOrderCard };
