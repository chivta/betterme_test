import { useOrdersDashboardContext } from '../../context'
import { ImportCSVCard } from './components/ImportCSVCard'
import { CreateOrderCard } from './components/CreateOrderCard'
import { OrdersTableCard } from './components/OrdersTableCard'

function DashboardTab() {
  const {
    orders, total, page, totalPages, isLoading, queryError, refetch,
    createOrder, createdOrder, isCreating, createError,
    importCSVAsync, importResult, isImporting, importError,
    countyFilter, dateFrom, dateTo,
    setCountyFilter, setDateFrom, setDateTo,
    applyFilters, clearFilters, setPage,
  } = useOrdersDashboardContext()

  return (
    <main className="w-full px-6 py-6 space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <ImportCSVCard
          onImport={importCSVAsync}
          importResult={importResult}
          isImporting={isImporting}
          importError={importError}
        />
        <CreateOrderCard
          onCreateOrder={createOrder}
          createdOrder={createdOrder}
          isCreating={isCreating}
          createError={createError}
        />
      </div>
      <OrdersTableCard
        orders={orders}
        total={total}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        error={queryError}
        countyFilter={countyFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onCountyFilterChange={setCountyFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        onPageChange={setPage}
        onRefetch={refetch}
      />
    </main>
  )
}

export { DashboardTab }
