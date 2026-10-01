import { useEffect, useState } from "react";

import { MappingReviewPage } from "./features/mapping-review/MappingReviewPage";
import { TransactionsPage } from "./features/transactions/TransactionsPage";
import { AnalyticsPage } from "./features/analytics/AnalyticsPage";
import { parseRoute, transactionsRoute } from "./routing";

const currentRoute = () => parseRoute(window.location.hash);

export function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const handleHashChange = () => setRoute(currentRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  if (route.page === "transactions") {
    return <TransactionsPage initialFilters={route.transactionFilters} />;
  }

  if (route.page === "spending" || route.page === "financial") {
    return (
      <AnalyticsPage
        view={route.page}
        onViewTransactions={(filters) => {
          window.location.hash = transactionsRoute(filters);
        }}
      />
    );
  }

  return (
    <MappingReviewPage
      onViewTransactions={(description) => {
        window.location.hash = transactionsRoute({ description });
      }}
    />
  );
}
