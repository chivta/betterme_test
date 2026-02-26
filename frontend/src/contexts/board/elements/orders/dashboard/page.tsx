import { OrdersDashboardProvider } from './provider'
import { DashboardTab } from './layout/dashboard/tab'

function OrdersDashboardPage() {
  return (
    <OrdersDashboardProvider>
      <DashboardTab />
    </OrdersDashboardProvider>
  )
}

export { OrdersDashboardPage }
