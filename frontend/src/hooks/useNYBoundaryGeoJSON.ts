import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

const DAY_MS = 24 * 60 * 60 * 1000;

function useNYBoundaryGeoJSON() {
  return useQuery<GeoJSON.FeatureCollection>({
    queryKey: ["geo", "boundary"],
    queryFn: () => apiFetch("/api/geo/boundary"),
    staleTime: DAY_MS,
    gcTime: DAY_MS,
  });
}

export { useNYBoundaryGeoJSON };
