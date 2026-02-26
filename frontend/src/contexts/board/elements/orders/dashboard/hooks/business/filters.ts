import { useState } from "react";
import type { OrderFilters } from "../../types";

function useOrdersFilters() {
  const [filters, setFilters] = useState<OrderFilters>({
    page: 1,
    pageSize: 20,
  });
  const [cityFilter, setCityFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const applyFilters = () => {
    setFilters((f) => ({
      ...f,
      page: 1,
      county: cityFilter || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }));
  };

  const clearFilters = () => {
    setCityFilter("");
    setDateFrom("");
    setDateTo("");
    setFilters({ page: 1, pageSize: 20 });
  };

  const setPage = (page: number) => setFilters((f) => ({ ...f, page }));

  return {
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
  };
}

export { useOrdersFilters };
