import { useOrdersDashboardContext } from "../../context";
import { CreateOrderCard } from "./components/CreateOrderCard";
import { OrdersTableCard } from "./components/OrdersTableCard";

function DashboardTab() {
  const {
    orders,
    total,
    page,
    totalPages,
    isLoading,
    queryError,
    refetch,
    createOrder,
    createdOrder,
    isCreating,
    createError,
    importCSVAsync,
    isImporting: _isImporting,
    importResult: _importResult,
    importError: _importError,
    deleteAllOrdersAsync,
    isDeleting,
    filters,
    cityFilter,
    dateFrom,
    dateTo,
    setCityFilter,
    setDateFrom,
    setDateTo,
    applyFilters,
    clearFilters,
    setPage,
  } = useOrdersDashboardContext();

  return (
    <main className="w-full px-6 py-6 space-y-6">
      <CreateOrderCard
        onCreateOrder={createOrder}
        createdOrder={createdOrder}
        isCreating={isCreating}
        createError={createError}
      />
      <OrdersTableCard
        orders={orders}
        total={total}
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        error={queryError}
        cityFilter={cityFilter}
        dateFrom={dateFrom}
        dateTo={dateTo}
        appliedFilters={filters}
        onCityFilterChange={setCityFilter}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
        onPageChange={setPage}
        onRefetch={refetch}
        onImport={importCSVAsync}
        onDeleteAll={deleteAllOrdersAsync}
        isDeleting={isDeleting}
      />
    </main>
  );
}

export { DashboardTab };
