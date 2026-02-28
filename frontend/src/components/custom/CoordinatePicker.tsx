import "leaflet/dist/leaflet.css";
import L from "leaflet";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";

// Fix Leaflet's broken default icon resolution under Vite/Webpack bundlers.
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

type CoordinatePickerProps = {
  lat: string;
  lng: string;
  onLatChange: (value: string) => void;
  onLngChange: (value: string) => void;
};

const NY_CENTER: L.LatLngExpression = [42.8, -75.5];
const DEFAULT_ZOOM = 7;

function ClickHandler({
  onLatChange,
  onLngChange,
}: Pick<CoordinatePickerProps, "onLatChange" | "onLngChange">) {
  useMapEvents({
    click(e) {
      onLatChange(e.latlng.lat.toFixed(6));
      onLngChange(e.latlng.lng.toFixed(6));
    },
  });
  return null;
}

function CoordinatePicker({
  lat,
  lng,
  onLatChange,
  onLngChange,
}: CoordinatePickerProps) {
  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);
  const hasValidPosition =
    lat !== "" && lng !== "" && isFinite(parsedLat) && isFinite(parsedLng);
  const position: L.LatLngExpression | null = hasValidPosition
    ? [parsedLat, parsedLng]
    : null;

  function handleDragEnd(e: L.DragEndEvent) {
    const latlng = (e.target as L.Marker).getLatLng();
    onLatChange(latlng.lat.toFixed(6));
    onLngChange(latlng.lng.toFixed(6));
  }

  return (
    <div
      className="rounded-md overflow-hidden border border-border [&_.leaflet-container_img]:border-none [&_.leaflet-container_img]:outline-none"
      style={{ height: "400px", zIndex: 0, position: "relative" }}
    >
      <MapContainer
        center={NY_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickHandler onLatChange={onLatChange} onLngChange={onLngChange} />
        {position !== null && (
          <Marker
            position={position}
            draggable={true}
            eventHandlers={{ dragend: handleDragEnd }}
          />
        )}
      </MapContainer>
    </div>
  );
}

export { CoordinatePicker };
export type { CoordinatePickerProps };
