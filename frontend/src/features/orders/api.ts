import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

export interface Order {
  id: number;
  external_id?: number;
  latitude: number;
  longitude: number;
  subtotal: number;
  timestamp: string;
  county_fips: string;
  county_name: string;
  state_rate: number;
  county_rate: number;
  city_rate: number;
  special_rate: number;
  composite_tax_rate: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ImportResult {
  total_imported: number;
  total_failed: number;
  total_tax: number;
  errors?: string[];
}

export interface OrderFilters {
  page: number;
  pageSize: number;
  county?: string;
  dateFrom?: string;
  dateTo?: string;
  minTotal?: number;
  maxTotal?: number;
}

export function useOrders(filters: OrderFilters) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("page_size", String(filters.pageSize));
  if (filters.county) params.set("county", filters.county);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (filters.minTotal !== undefined) params.set("min_total", String(filters.minTotal));
  if (filters.maxTotal !== undefined) params.set("max_total", String(filters.maxTotal));

  return useQuery<OrdersResponse>({
    queryKey: ["orders", filters],
    queryFn: () => apiFetch(`/api/orders?${params.toString()}`),
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();

  return useMutation<Order, Error, { latitude: number; longitude: number; subtotal: number; timestamp?: string }>({
    mutationFn: (data) =>
      apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useImportCSV() {
  const queryClient = useQueryClient();

  return useMutation<ImportResult, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiFetch("/api/orders/import", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
