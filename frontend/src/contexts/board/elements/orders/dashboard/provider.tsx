import { type ReactNode } from 'react'
import { useOrdersDashboardApi } from './hooks/api'
import { useOrdersFilters } from './hooks/business'
import { OrdersDashboardContext } from './context'

function OrdersDashboardProvider({ children }: { children: ReactNode }) {
  const filterState = useOrdersFilters()
  const apiState = useOrdersDashboardApi(filterState.filters)

  const value = { ...apiState, ...filterState }

  return (
    <OrdersDashboardContext.Provider value={value}>
      {children}
    </OrdersDashboardContext.Provider>
  )
}

export { OrdersDashboardProvider }
