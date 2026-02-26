import { useState } from 'react'
import type { OrderFilters } from '../../types'

function useOrdersFilters() {
  const [filters, setFilters] = useState<OrderFilters>({ page: 1, pageSize: 20 })
  const [countyFilter, setCountyFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const applyFilters = () => {
    setFilters((f) => ({
      ...f,
      page: 1,
      county: countyFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }))
  }

  const clearFilters = () => {
    setCountyFilter('')
    setDateFrom('')
    setDateTo('')
    setFilters({ page: 1, pageSize: 20 })
  }

  const setPage = (page: number) => setFilters((f) => ({ ...f, page }))

  return {
    filters,
    countyFilter,
    dateFrom,
    dateTo,
    setCountyFilter,
    setDateFrom,
    setDateTo,
    applyFilters,
    clearFilters,
    setPage,
  }
}

export { useOrdersFilters }
