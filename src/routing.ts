export interface AppRoute {
  page: "mapping-review" | "transactions" | "spending" | "financial";
  transactionFilters: TransactionRouteFilters;
}

export interface TransactionRouteFilters {
  description: string;
  category: string;
  month: string;
  transactionType: "all" | "income" | "expense";
  classification: "all" | "classified" | "unclassified";
}

const emptyTransactionFilters: TransactionRouteFilters = {
  description: "",
  category: "",
  month: "",
  transactionType: "all",
  classification: "all",
};

function transactionType(value: string | null): TransactionRouteFilters["transactionType"] {
  return value === "income" || value === "expense" ? value : "all";
}

function classification(value: string | null): TransactionRouteFilters["classification"] {
  return value === "classified" || value === "unclassified" ? value : "all";
}
export function parseRoute(hash: string): AppRoute {
  const raw = hash.replace(/^#/, "");
  const [path, query = ""] = raw.split("?", 2);
  const parameters = new URLSearchParams(query);
  return {
    page:
      path === "transactions" || path === "spending" || path === "financial"
        ? path
        : "mapping-review",
    transactionFilters: {
      description: parameters.get("description") ?? "",
      category: parameters.get("category") ?? "",
      month: parameters.get("month") ?? "",
      transactionType: transactionType(parameters.get("transaction_type")),
      classification: classification(parameters.get("classification")),
    },
  };
}

export function transactionsRoute(filters: Partial<TransactionRouteFilters> = {}): string {
  const normalized = { ...emptyTransactionFilters, ...filters };
  const parameters = new URLSearchParams();
  if (normalized.description) parameters.set("description", normalized.description);
  if (normalized.category) parameters.set("category", normalized.category);
  if (normalized.month) parameters.set("month", normalized.month);
  if (normalized.transactionType !== "all") {
    parameters.set("transaction_type", normalized.transactionType);
  }
  if (normalized.classification !== "all") {
    parameters.set("classification", normalized.classification);
  }
  const query = parameters.toString();
  return `#transactions${query ? `?${query}` : ""}`;
}
