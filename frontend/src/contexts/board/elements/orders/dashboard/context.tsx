import { createContext, useContext } from "react";
import type { useOrdersDashboardApi } from "./hooks/api";
import type { useOrdersFilters } from "./hooks/business";

type OrdersDashboardContextValue = ReturnType<typeof useOrdersDashboardApi> &
  ReturnType<typeof useOrdersFilters>;

const OrdersDashboardContext =
  createContext<OrdersDashboardContextValue | null>(null);

function useOrdersDashboardContext() {
  const ctx = useContext(OrdersDashboardContext);
  if (!ctx)
    throw new Error(
      "useOrdersDashboardContext must be used within OrdersDashboardProvider",
    );
  return ctx;
}

export { OrdersDashboardContext, useOrdersDashboardContext };
export type { OrdersDashboardContextValue };
