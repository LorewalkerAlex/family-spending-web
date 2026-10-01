import type { components, operations, paths } from "./schema";

export type MappingReviewWorkspace = components["schemas"]["MappingReviewWorkspaceData"];
export type MappingReviewItem = components["schemas"]["MappingReviewItemData"];
export type MappingRecommendation = components["schemas"]["MappingRecommendationData"];
export type MappingReviewPreview = components["schemas"]["MappingReviewPreviewData"];
export type MappingReviewRequest = components["schemas"]["MappingReviewRequest"];
export type MappingReviewApplyRequest = components["schemas"]["MappingReviewApplyRequest"];
export type MappingReviewApply = components["schemas"]["MappingReviewApplyData"];
export type RuntimeStatus = components["schemas"]["RuntimeStatusData"];
export type SpendingAnalytics = components["schemas"]["SpendingAnalyticsData"];
export type FinancialAnalytics = components["schemas"]["FinancialAnalyticsData"];
export type TransactionView = components["schemas"]["TransactionViewData"];
export type TransactionListMeta = components["schemas"]["ApiListMeta"];
export type TransactionQuery = NonNullable<
  operations["list_transactions_api_v1_transactions_get"]["parameters"]["query"]
>;

type ApiErrorBody = components["schemas"]["ErrorResponse"];
type WorkspaceResponse = components["schemas"]["ApiResponse_MappingReviewWorkspaceData_"];
type PreviewResponse = components["schemas"]["ApiResponse_MappingReviewPreviewData_"];
type ApplyResponse = components["schemas"]["ApiResponse_MappingReviewApplyData_"];
type RuntimeStatusResponse = components["schemas"]["ApiResponse_RuntimeStatusData_"];
type SpendingAnalyticsResponse = components["schemas"]["ApiResponse_SpendingAnalyticsData_"];
type FinancialAnalyticsResponse = components["schemas"]["ApiResponse_FinancialAnalyticsData_"];
type TransactionListResponse = components["schemas"]["ApiListResponse_TransactionViewData_"];
type TransactionResponse = components["schemas"]["ApiResponse_TransactionViewData_"];

const endpoints = {
  workspace: "/api/v1/mapping-reviews",
  preview: "/api/v1/mapping-reviews/preview",
  apply: "/api/v1/mapping-reviews/apply",
  runtime: "/api/v1/runtime/status",
} as const satisfies Record<string, keyof paths>;

const transactionEndpoints = {
  list: "/api/v1/transactions",
  detail: "/api/v1/transactions/{transaction_id}",
} as const satisfies Record<string, keyof paths>;

const analyticsEndpoints = {
  spending: "/api/v1/analytics/spending",
  financial: "/api/v1/analytics/financial",
} as const satisfies Record<string, keyof paths>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId: string | null;
  readonly details: unknown;

  constructor(status: number, body: ApiErrorBody | null) {
    super(body?.error.message ?? `Backend request failed with HTTP ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = body?.error.code ?? "http.error";
    this.requestId = body?.error.request_id ?? null;
    this.details = body?.error.details ?? null;
  }
}

export interface MappingReviewApi {
  getWorkspace(signal?: AbortSignal): Promise<MappingReviewWorkspace>;
  getRuntimeStatus(signal?: AbortSignal): Promise<RuntimeStatus>;
  previewMapping(input: MappingReviewRequest): Promise<MappingReviewPreview>;
  applyMapping(input: MappingReviewApplyRequest): Promise<MappingReviewApply>;
}

export interface TransactionApi {
  listTransactions(
    query: TransactionQuery,
    signal?: AbortSignal,
  ): Promise<TransactionListResponse>;
  getTransaction(transactionId: string, signal?: AbortSignal): Promise<TransactionView>;
}

export interface AnalyticsApi {
  getSpending(signal?: AbortSignal): Promise<SpendingAnalytics>;
  getFinancial(signal?: AbortSignal): Promise<FinancialAnalytics>;
}

type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (!value || typeof value !== "object" || !("error" in value)) return false;
  const error = value.error;
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      "message" in error &&
      typeof error.message === "string",
  );
}

function createRequester(baseUrl: string, fetchImplementation: FetchImplementation) {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  return async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetchImplementation(`${normalizedBaseUrl}${path}`, {
      credentials: "same-origin",
      ...init,
      headers: {
        Accept: "application/json",
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...init.headers,
      },
    });
    const body = await parseJson(response);

    if (!response.ok) {
      throw new ApiError(response.status, isApiErrorBody(body) ? body : null);
    }
    return body as T;
  };
}

export function createMappingReviewApi(
  baseUrl = "",
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis),
): MappingReviewApi {
  const request = createRequester(baseUrl, fetchImplementation);

  return {
    async getWorkspace(signal) {
      const response = await request<WorkspaceResponse>(endpoints.workspace, { signal });
      return response.data;
    },

    async getRuntimeStatus(signal) {
      const response = await request<RuntimeStatusResponse>(endpoints.runtime, { signal });
      return response.data;
    },

    async previewMapping(input) {
      const response = await request<PreviewResponse>(endpoints.preview, {
        method: "POST",
        body: JSON.stringify(input),
      });
      return response.data;
    },

    async applyMapping(input) {
      const response = await request<ApplyResponse>(endpoints.apply, {
        method: "POST",
        body: JSON.stringify(input),
      });
      return response.data;
    },
  };
}

export const mappingReviewApi = createMappingReviewApi();

function transactionQueryString(query: TransactionQuery): string {
  const parameters = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      parameters.set(name, String(value));
    }
  }
  const serialized = parameters.toString();
  return serialized ? `?${serialized}` : "";
}

export function createTransactionApi(
  baseUrl = "",
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis),
): TransactionApi {
  const request = createRequester(baseUrl, fetchImplementation);

  return {
    async listTransactions(query, signal) {
      return request<TransactionListResponse>(
        `${transactionEndpoints.list}${transactionQueryString(query)}`,
        { signal },
      );
    },

    async getTransaction(transactionId, signal) {
      const path = transactionEndpoints.detail.replace(
        "{transaction_id}",
        encodeURIComponent(transactionId),
      );
      const response = await request<TransactionResponse>(path, { signal });
      return response.data;
    },
  };
}

export const transactionApi = createTransactionApi();

export function createAnalyticsApi(
  baseUrl = "",
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis),
): AnalyticsApi {
  const request = createRequester(baseUrl, fetchImplementation);

  return {
    async getSpending(signal) {
      const response = await request<SpendingAnalyticsResponse>(analyticsEndpoints.spending, {
        signal,
      });
      return response.data;
    },

    async getFinancial(signal) {
      const response = await request<FinancialAnalyticsResponse>(analyticsEndpoints.financial, {
        signal,
      });
      return response.data;
    },
  };
}

export const analyticsApi = createAnalyticsApi();
