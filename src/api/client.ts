import type { components, paths } from "./schema";

export type MappingReviewWorkspace = components["schemas"]["MappingReviewWorkspaceData"];
export type MappingReviewItem = components["schemas"]["MappingReviewItemData"];
export type MappingRecommendation = components["schemas"]["MappingRecommendationData"];
export type MappingReviewPreview = components["schemas"]["MappingReviewPreviewData"];
export type MappingReviewRequest = components["schemas"]["MappingReviewRequest"];
export type MappingReviewApplyRequest = components["schemas"]["MappingReviewApplyRequest"];
export type MappingReviewApply = components["schemas"]["MappingReviewApplyData"];
export type RuntimeStatus = components["schemas"]["RuntimeStatusData"];

type ApiErrorBody = components["schemas"]["ErrorResponse"];
type WorkspaceResponse = components["schemas"]["ApiResponse_MappingReviewWorkspaceData_"];
type PreviewResponse = components["schemas"]["ApiResponse_MappingReviewPreviewData_"];
type ApplyResponse = components["schemas"]["ApiResponse_MappingReviewApplyData_"];
type RuntimeStatusResponse = components["schemas"]["ApiResponse_RuntimeStatusData_"];

const endpoints = {
  workspace: "/api/v1/mapping-reviews",
  preview: "/api/v1/mapping-reviews/preview",
  apply: "/api/v1/mapping-reviews/apply",
  runtime: "/api/v1/runtime/status",
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

export function createMappingReviewApi(
  baseUrl = "",
  fetchImplementation: FetchImplementation = globalThis.fetch.bind(globalThis),
): MappingReviewApi {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  async function request<T>(
    path: (typeof endpoints)[keyof typeof endpoints],
    init: RequestInit = {},
  ): Promise<T> {
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
  }

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

