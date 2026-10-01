import { describe, expect, it } from "vitest";

import {
  createMappingReviewApi,
  type MappingReviewApply,
  type MappingReviewPreview,
  type MappingReviewWorkspace,
} from "../src/api/client";

const workspace: MappingReviewWorkspace = {
  items: [],
  merchants: [{ name: "测试商户", default_category: "日常消费" }],
  categories: ["日常消费"],
};

const preview: MappingReviewPreview = {
  token: "preview-token",
  description: "原始描述",
  merchant: "测试商户",
  category: "日常消费",
  is_new_merchant: false,
  previous_default_category: null,
  description_transaction_count: 1,
  description_affected_transaction_count: 1,
  default_category_affected_transaction_count: 0,
  total_affected_transaction_count: 1,
  preserved_merchant_exception_count: 0,
  preserved_category_exception_count: 0,
};

const applied: MappingReviewApply = {
  preview,
  mutation_impact: "enrichments_and_projections",
};

describe("MappingReviewApi", () => {
  it("executes workspace -> preview -> apply with the generated V1 contract", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const payloads = [
      { data: workspace, meta: { request_id: "workspace" } },
      { data: preview, meta: { request_id: "preview" } },
      { data: applied, meta: { request_id: "apply" } },
    ];
    const fakeFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      const payload = payloads.shift();
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const api = createMappingReviewApi("https://backend.example", fakeFetch);

    await expect(api.getWorkspace()).resolves.toEqual(workspace);
    await expect(
      api.previewMapping({
        description: "原始描述",
        merchant: "测试商户",
        category: "日常消费",
      }),
    ).resolves.toEqual(preview);
    await expect(
      api.applyMapping({
        description: preview.description,
        merchant: preview.merchant,
        category: preview.category,
        preview_token: preview.token,
        confirm_new_merchant: false,
      }),
    ).resolves.toEqual(applied);

    expect(calls.map((call) => [call.url, call.init?.method ?? "GET"])).toEqual([
      ["https://backend.example/api/v1/mapping-reviews", "GET"],
      ["https://backend.example/api/v1/mapping-reviews/preview", "POST"],
      ["https://backend.example/api/v1/mapping-reviews/apply", "POST"],
    ]);
    expect(JSON.parse(String(calls[2]?.init?.body))).toEqual({
      description: "原始描述",
      merchant: "测试商户",
      category: "日常消费",
      preview_token: "preview-token",
      confirm_new_merchant: false,
    });
  });
});

