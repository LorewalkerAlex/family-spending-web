import { describe, expect, it } from "vitest";

import type { MappingReviewItem, MappingReviewPreview } from "../src/api/client";
import {
  draftFromRecommendation,
  filterReviewItems,
  previewImpactLines,
} from "../src/features/mapping-review/model";

const item: MappingReviewItem = {
  description: "财付通-测试商户",
  transaction_count: 2,
  total_amount: "108.50",
  currency: "CNY",
  latest_date: "2026-09-30",
  source_types: ["cmb-email"],
  transaction_only_exception_count: 1,
  recommendation: {
    description: "财付通-测试商户",
    merchant: "测试商户",
    category: "日常消费",
    rank_score: 0.88,
    score_margin: 0.31,
    confidence: "strong",
    origin: "history",
    is_new_merchant: false,
    category_basis: "reviewed_merchant_default",
    matched_description: "财付通-测试商户一店",
    evidence: ["历史记录高度相似"],
    signals: { sequence: 0.9 },
    alternatives: [
      {
        merchant: "测试商户二店",
        category: "日常消费",
        rank_score: 0.7,
        matched_description: "财付通-测试商户二店",
      },
    ],
    model_version: "mapping-ensemble-v2",
  },
};

describe("mapping review presentation model", () => {
  it("uses a recommendation only as the initial editable draft", () => {
    expect(draftFromRecommendation(item.recommendation)).toEqual({
      merchant: "测试商户",
      category: "日常消费",
    });
  });

  it("searches description, recommendation, category and alternatives", () => {
    expect(filterReviewItems([item], "二店")).toEqual([item]);
    expect(filterReviewItems([item], "不存在")).toEqual([]);
  });

  it("describes preview impact without inventing financial behavior", () => {
    const preview: MappingReviewPreview = {
      token: "preview-token",
      description: item.description,
      merchant: "测试商户",
      category: "日常消费",
      is_new_merchant: false,
      previous_default_category: "其他",
      description_transaction_count: 2,
      description_affected_transaction_count: 2,
      default_category_affected_transaction_count: 3,
      total_affected_transaction_count: 5,
      preserved_merchant_exception_count: 1,
      preserved_category_exception_count: 0,
    };

    expect(previewImpactLines(preview)).toEqual([
      { label: "本描述交易", value: "2 / 2 笔会更新", emphasis: true },
      { label: "总影响范围", value: "5 笔交易", emphasis: true },
      { label: "商家默认分类传播", value: "3 笔其他交易会更新" },
      { label: "保留 Merchant 例外", value: "1 笔" },
    ]);
  });
});

