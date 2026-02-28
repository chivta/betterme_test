import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from '@/shared/api/client'
import type { Order, OrdersResponse, ImportResult, OrderFilters, TaxPreview } from '../../types'

const THIRTY_SECONDS = 30 * 1000
const TWO_MINUTES = 2 * 60 * 1000

function useOrdersQuery(filters: OrderFilters) {
  const params = new URLSearchParams()
  params.set('page', String(filters.page))
  params.set('page_size', String(filters.pageSize))
  if (filters.county) params.set('county', filters.county)
  if (filters.dateFrom) params.set('date_from', filters.dateFrom)
  if (filters.dateTo) params.set('date_to', filters.dateTo)
  if (filters.minTotal !== undefined) params.set('min_total', String(filters.minTotal))
  if (filters.maxTotal !== undefined) params.set('max_total', String(filters.maxTotal))

  return useQuery<OrdersResponse>({
    queryKey: ['orders', filters],
    queryFn: () => apiFetch(`/api/orders?${params.toString()}`),
    staleTime: THIRTY_SECONDS,
    gcTime: TWO_MINUTES,
  })
}

function useCreateOrder() {
  const queryClient = useQueryClient()
  const { mutate, data, isPending, error } = useMutation<
    Order,
    Error,
    { latitude: number; longitude: number; subtotal: number; timestamp?: string }
  >({
    mutationFn: (payload) =>
      apiFetch('/api/orders', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  return { createOrder: mutate, createdOrder: data ?? null, isCreating: isPending, createError: error }
}

function usePreviewTax() {
  const { mutateAsync, data, isPending, error, reset } = useMutation<
    TaxPreview,
    Error,
    { latitude: number; longitude: number; subtotal: number }
  >({
    mutationFn: (payload) =>
      apiFetch('/api/orders/preview', { method: 'POST', body: JSON.stringify(payload) }),
  })
  return { previewTaxAsync: mutateAsync, taxPreview: data ?? null, isPreviewing: isPending, previewError: error, resetPreview: reset }
}

function useImportCSV() {
  const queryClient = useQueryClient()
  const { mutateAsync, data, isPending, error } = useMutation<ImportResult, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiFetch('/api/orders/import', { method: 'POST', body: formData })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  return { importCSVAsync: mutateAsync, importResult: data ?? null, isImporting: isPending, importError: error }
}

function useDeleteAllOrders() {
  const queryClient = useQueryClient()
  const { mutateAsync, isPending, error } = useMutation<void, Error>({
    mutationFn: () => apiFetch('/api/orders', { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
  })
  return { deleteAllOrdersAsync: mutateAsync, isDeleting: isPending, deleteError: error }
}

function useOrdersDashboardApi(filters: OrderFilters) {
  const { data, isLoading, error, refetch } = useOrdersQuery(filters)
  const createState = useCreateOrder()
  const importState = useImportCSV()
  const deleteAllState = useDeleteAllOrders()

  return {
    orders: data?.orders ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    totalPages: data?.total_pages ?? 1,
    isLoading,
    queryError: error ?? null,
    refetch,
    ...createState,
    ...importState,
    ...deleteAllState,
  }
}

export { useOrdersQuery, useCreateOrder, usePreviewTax, useImportCSV, useDeleteAllOrders, useOrdersDashboardApi }
