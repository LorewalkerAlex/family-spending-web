import type {
  MappingRecommendation,
  MappingReviewItem,
  MappingReviewPreview,
} from "../../api/client";

export { formatMoney } from "../../presentation/format";

export interface MappingDraft {
  merchant: string;
  category: string;
}

export interface ImpactLine {
  label: string;
  value: string;
  emphasis?: boolean;
}

export function draftFromRecommendation(recommendation: MappingRecommendation): MappingDraft {
  return {
    merchant: recommendation.merchant,
    category: recommendation.category ?? "",
  };
}

export function confidenceLabel(confidence: MappingRecommendation["confidence"]): string {
  return {
    strong: "高可信推荐",
    weak: "建议复核",
    drafted: "新商家草案",
  }[confidence];
}

export function originLabel(origin: MappingRecommendation["origin"]): string {
  return {
    exact: "历史精确命中",
    normalized_history: "规范化历史命中",
    history: "相似历史记录",
    draft: "保守草拟",
  }[origin];
}

export function previewImpactLines(preview: MappingReviewPreview): ImpactLine[] {
  const lines: ImpactLine[] = [
    {
      label: "本描述交易",
      value: `${preview.description_affected_transaction_count} / ${preview.description_transaction_count} 笔会更新`,
      emphasis: true,
    },
    {
      label: "总影响范围",
      value: `${preview.total_affected_transaction_count} 笔交易`,
      emphasis: true,
    },
  ];

  if (preview.default_category_affected_transaction_count > 0) {
    lines.push({
      label: "商家默认分类传播",
      value: `${preview.default_category_affected_transaction_count} 笔其他交易会更新`,
    });
  }
  if (preview.preserved_merchant_exception_count > 0) {
    lines.push({
      label: "保留 Merchant 例外",
      value: `${preview.preserved_merchant_exception_count} 笔`,
    });
  }
  if (preview.preserved_category_exception_count > 0) {
    lines.push({
      label: "保留 Category 例外",
      value: `${preview.preserved_category_exception_count} 笔`,
    });
  }
  return lines;
}

export function filterReviewItems(
  items: readonly MappingReviewItem[],
  query: string,
): MappingReviewItem[] {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return [...items];

  return items.filter((item) => {
    const recommendation = item.recommendation;
    return [
      item.description,
      recommendation.merchant,
      recommendation.category ?? "",
      ...recommendation.alternatives.map((alternative) => alternative.merchant),
    ].some((value) => value.toLocaleLowerCase("zh-CN").includes(normalized));
  });
}
