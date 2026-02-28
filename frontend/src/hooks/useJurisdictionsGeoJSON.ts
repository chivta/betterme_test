import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

// County boundary data never changes at runtime, so we cache it aggressively.
const DAY_MS = 24 * 60 * 60 * 1000;

function useJurisdictionsGeoJSON() {
  return useQuery<GeoJSON.FeatureCollection>({
    queryKey: ["geo", "jurisdictions"],
    queryFn: () => apiFetch("/api/geo/jurisdictions"),
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });
}

export { useJurisdictionsGeoJSON };
