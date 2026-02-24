import { useState } from "react";
import { useCreateOrder, type Order } from "@/api/orders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlusCircle, MapPin } from "lucide-react";

export default function CreateOrder() {
  const createMutation = useCreateOrder();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [subtotal, setSubtotal] = useState("");
  const [created, setCreated] = useState<Order | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreated(null);
    try {
      const order = await createMutation.mutateAsync({
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        subtotal: parseFloat(subtotal),
      });
      setCreated(order);
      setLatitude("");
      setLongitude("");
      setSubtotal("");
    } catch {
      // error shown via createMutation.error
    }
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

          {createMutation.error && (
            <p className="text-sm text-destructive">{createMutation.error.message}</p>
          )}

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Calculating..." : "Create & Calculate Tax"}
          </Button>
        </form>

        {created && (
          <div className="mt-4 p-4 rounded-md bg-muted space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4" />
              {created.county_name} County
              {created.special_rate > 0 && (
                <Badge variant="secondary" className="ml-1">MCTD</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Subtotal</p>
                <p className="font-medium">${created.subtotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-semibold text-lg">${created.total_amount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tax Rate</p>
                <p className="font-medium">{(created.composite_tax_rate * 100).toFixed(3)}%</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tax Amount</p>
                <p className="font-medium">${created.tax_amount.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
              <span className="font-medium">Breakdown:</span>{" "}
              State {(created.state_rate * 100).toFixed(1)}% +
              County {(created.county_rate * 100).toFixed(2)}% +
              City {(created.city_rate * 100).toFixed(1)}% +
              Special {(created.special_rate * 100).toFixed(3)}%
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
