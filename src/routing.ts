export interface AppRoute {
  page: "mapping-review" | "transactions";
  description: string;
}
export function parseRoute(hash: string): AppRoute {
  const raw = hash.replace(/^#/, "");
  const [path, query = ""] = raw.split("?", 2);
  return {
    page: path === "transactions" ? "transactions" : "mapping-review",
    description: new URLSearchParams(query).get("description") ?? "",
  };
}

export function transactionsRoute(description = ""): string {
  const parameters = new URLSearchParams();
  if (description) parameters.set("description", description);
  const query = parameters.toString();
  return `#transactions${query ? `?${query}` : ""}`;
}
