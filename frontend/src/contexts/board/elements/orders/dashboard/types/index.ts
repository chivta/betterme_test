type Order = {
  id: number
  external_id?: number
  latitude: number
  longitude: number
  subtotal: number
  timestamp: string
  county_fips: string
  county_name: string
  state_rate: number
  county_rate: number
  city_rate: number
  special_rate: number
  composite_tax_rate: number
  tax_amount: number
  total_amount: number
  created_at: string
}

type OrdersResponse = {
  orders: Order[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

type ImportResult = {
  total_imported: number
  total_failed: number
  total_tax: number
  errors?: string[]
}

type OrderFilters = {
  page: number
  pageSize: number
  county?: string
  dateFrom?: string
  dateTo?: string
  minTotal?: number
  maxTotal?: number
}

type TaxPreview = {
  latitude: number
  longitude: number
  subtotal: number
  county_fips?: string
  county_name?: string
  state_rate: number
  county_rate: number
  city_rate: number
  special_rate: number
  composite_tax_rate: number
  tax_amount: number
  total_amount: number
}

export type { Order, OrdersResponse, ImportResult, OrderFilters, TaxPreview }
