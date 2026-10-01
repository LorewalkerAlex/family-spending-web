import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  ApiError,
  mappingReviewApi,
  type MappingReviewApi,
  type MappingReviewItem,
  type MappingReviewPreview,
  type MappingReviewWorkspace,
  type RuntimeStatus,
} from "../../api/client";
import {
  confidenceLabel,
  draftFromRecommendation,
  filterReviewItems,
  formatMoney,
  originLabel,
  previewImpactLines,
} from "./model";

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` · request ${error.requestId}` : "";
    return `${error.message}${request}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function MappingReviewPage({ api = mappingReviewApi }: { api?: MappingReviewApi }) {
  const [workspace, setWorkspace] = useState<MappingReviewWorkspace | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [selectedDescription, setSelectedDescription] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (preferredDescription?: string | null, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const [nextWorkspace, nextRuntime] = await Promise.all([
          api.getWorkspace(signal),
          api.getRuntimeStatus(signal),
        ]);
        setWorkspace(nextWorkspace);
        setRuntime(nextRuntime);
        setSelectedDescription((current) => {
          const preferred = preferredDescription ?? current;
          return preferred && nextWorkspace.items.some((item) => item.description === preferred)
            ? preferred
            : (nextWorkspace.items[0]?.description ?? null);
        });
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(messageFrom(caught));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [api],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(null, controller.signal);
    return () => controller.abort();
  }, [load]);

  const filteredItems = useMemo(
    () => filterReviewItems(workspace?.items ?? [], query),
    [query, workspace?.items],
  );
  const selected =
    workspace?.items.find((item) => item.description === selectedDescription) ?? null;

  async function applied(description: string): Promise<void> {
    setNotice(`已应用「${description}」的 Mapping；队列和运行状态已刷新。`);
    await load(null);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">FS</span>
          <div>
            <strong>家庭消费</strong>
            <span>Family Spending</span>
          </div>
        </div>

        <nav className="workspace-nav" aria-label="主导航">
          <a className="workspace-nav__item workspace-nav__item--active" href="#mapping-review">
            <span>Mapping 审核</span>
            <small>{workspace?.items.length ?? "—"}</small>
          </a>
          {[
            ["交易", "下一阶段"],
            ["消费分析", "下一阶段"],
            ["财务分析", "下一阶段"],
            ["自动化", "下一阶段"],
          ].map(([label, status]) => (
            <span className="workspace-nav__item workspace-nav__item--disabled" key={label}>
              <span>{label}</span>
              <small>{status}</small>
            </span>
          ))}
        </nav>

        <div className="sidebar__status">
          <span className={`status-dot${runtime?.phase === "ready" ? " status-dot--ready" : ""}`} />
          <div>
            <strong>{runtime?.phase === "ready" ? "Backend ready" : "正在连接 Backend"}</strong>
            <span>{runtime ? `generation ${runtime.generation}` : "127.0.0.1:8000"}</span>
          </div>
        </div>
      </aside>

      <main className="page-shell" id="mapping-review">
        <header className="page-header">
          <div>
            <p className="eyebrow">Mapping Review</p>
            <h1>把未知交易变成可靠规则</h1>
            <p className="page-header__description">
              推荐只负责预填。每一条 Mapping 都需要你预览影响范围后明确确认。
            </p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            disabled={loading}
            onClick={() => void load(selectedDescription)}
          >
            {loading ? "刷新中…" : "刷新数据"}
          </button>
        </header>

        <section className="page-content">
          {notice ? <div className="notice notice--success">{notice}</div> : null}
          {error ? (
            <div className="notice notice--error">
              <span>{error}</span>
              <button type="button" onClick={() => void load(selectedDescription)}>重试</button>
            </div>
          ) : null}

          <div className="review-workspace">
            <section className="review-list-pane" aria-label="待审核描述">
              <div className="review-list__header">
                <div>
                  <span className="metric-label">待处理</span>
                  <strong>{workspace?.items.length ?? 0}</strong>
                </div>
                <div>
                  <span className="metric-label">交易总数</span>
                  <strong>{runtime?.counts.transactions ?? "—"}</strong>
                </div>
              </div>

              <label className="search-field">
                <span className="sr-only">搜索描述、商家或分类</span>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m21 21-4.35-4.35m2.35-5.15a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
                </svg>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索描述、推荐商家或分类"
                />
              </label>

              <div className="review-list" aria-live="polite">
                {loading && !workspace ? <ListSkeleton /> : null}
                {workspace && workspace.items.length === 0 ? (
                  <div className="empty-state">
                    <span className="empty-state__icon">✓</span>
                    <strong>审核队列已清空</strong>
                    <p>所有 Expense description 都已有明确 Mapping。</p>
                  </div>
                ) : null}
                {workspace && workspace.items.length > 0 && filteredItems.length === 0 ? (
                  <div className="empty-state">
                    <strong>没有匹配结果</strong>
                    <p>换一个描述、商家或分类关键词试试。</p>
                  </div>
                ) : null}
                {filteredItems.map((item) => (
                  <ReviewRow
                    key={item.description}
                    item={item}
                    selected={item.description === selectedDescription}
                    onSelect={() => {
                      setNotice(null);
                      setSelectedDescription(item.description);
                    }}
                  />
                ))}
              </div>
            </section>

            <section className="review-detail-pane" aria-label="审核详情">
              {selected && workspace ? (
                <ReviewEditor
                  key={selected.description}
                  api={api}
                  item={selected}
                  workspace={workspace}
                  onApplied={applied}
                />
              ) : (
                <div className="detail-empty">
                  <div className="detail-empty__mark">↗</div>
                  <strong>{workspace?.items.length === 0 ? "现在没有待审核项" : "选择一条待审核描述"}</strong>
                  <p>左侧选择原始 description，右侧确认推荐并预览它会影响哪些交易。</p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function ReviewRow({
  item,
  selected,
  onSelect,
}: {
  item: MappingReviewItem;
  selected: boolean;
  onSelect: () => void;
}) {
  const recommendation = item.recommendation;
  return (
    <button
      type="button"
      className={`review-row${selected ? " review-row--selected" : ""}`}
      onClick={onSelect}
    >
      <span className="review-row__topline">
        <span className={`confidence-tag confidence-tag--${recommendation.confidence}`}>
          {confidenceLabel(recommendation.confidence)}
        </span>
        <time dateTime={item.latest_date}>{item.latest_date}</time>
      </span>
      <strong className="review-row__description">{item.description}</strong>
      <span className="review-row__recommendation">
        <span>{recommendation.merchant}</span>
        <span aria-hidden="true">·</span>
        <span>{recommendation.category ?? "待选分类"}</span>
      </span>
      <span className="review-row__footer">
        <span>{item.transaction_count} 笔交易</span>
        <strong>{formatMoney(item.total_amount, item.currency)}</strong>
      </span>
    </button>
  );
}

function ReviewEditor({
  api,
  item,
  workspace,
  onApplied,
}: {
  api: MappingReviewApi;
  item: MappingReviewItem;
  workspace: MappingReviewWorkspace;
  onApplied: (description: string) => Promise<void>;
}) {
  const initialDraft = draftFromRecommendation(item.recommendation);
  const [merchant, setMerchant] = useState(initialDraft.merchant);
  const [category, setCategory] = useState(initialDraft.category);
  const [preview, setPreview] = useState<MappingReviewPreview | null>(null);
  const [confirmNewMerchant, setConfirmNewMerchant] = useState(false);
  const [busy, setBusy] = useState<"preview" | "apply" | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const exactMerchant = workspace.merchants.find(
    (option) => option.name === merchant.trim(),
  );

  function invalidatePreview(): void {
    setPreview(null);
    setConfirmNewMerchant(false);
    setStatus(null);
  }

  function chooseMerchant(name: string, defaultCategory?: string | null): void {
    setMerchant(name);
    if (defaultCategory) setCategory(defaultCategory);
    invalidatePreview();
  }

  async function submitPreview(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalizedMerchant = merchant.trim();
    if (!normalizedMerchant || !category) {
      setStatus("需要 Merchant 和默认 Category 才能生成影响预览。");
      return;
    }

    setBusy("preview");
    setStatus(null);
    try {
      const result = await api.previewMapping({
        description: item.description,
        merchant: normalizedMerchant,
        category,
      });
      setPreview(result);
      setConfirmNewMerchant(false);
    } catch (caught) {
      setPreview(null);
      setStatus(`预览失败：${messageFrom(caught)}`);
    } finally {
      setBusy(null);
    }
  }

  async function applyMapping(): Promise<void> {
    if (!preview) return;
    if (preview.is_new_merchant && !confirmNewMerchant) {
      setStatus("这是一个新 Merchant，请先确认创建。");
      return;
    }

    setBusy("apply");
    setStatus(null);
    try {
      await api.applyMapping({
        description: preview.description,
        merchant: preview.merchant,
        category: preview.category,
        preview_token: preview.token,
        confirm_new_merchant: confirmNewMerchant,
      });
      await onApplied(preview.description);
      setBusy(null);
    } catch (caught) {
      setStatus(`应用失败：${messageFrom(caught)}`);
      setBusy(null);
    }
  }

  const recommendation = item.recommendation;
  const impact = preview ? previewImpactLines(preview) : [];

  return (
    <article className="review-detail">
      <header className="detail-header">
        <div>
          <p className="eyebrow">原始 Description</p>
          <h2>{item.description}</h2>
          <p>
            {item.transaction_count} 笔 · {formatMoney(item.total_amount, item.currency)} · 最近发生于 {item.latest_date}
          </p>
        </div>
        <span className="source-pill">{item.source_types.join(" + ")}</span>
      </header>

      <section className="recommendation-card">
        <div className="recommendation-card__heading">
          <div>
            <p className="eyebrow">Backend recommendation</p>
            <h3>{confidenceLabel(recommendation.confidence)}</h3>
          </div>
          <span className={`confidence-orb confidence-orb--${recommendation.confidence}`}>
            {recommendation.confidence === "strong" ? "✓" : recommendation.confidence === "weak" ? "~" : "+"}
          </span>
        </div>
        <div className="recommendation-card__choice">
          <strong>{recommendation.merchant}</strong>
          <span>{recommendation.category ?? "没有可靠分类建议"}</span>
        </div>
        <div className="recommendation-card__meta">
          <span>{originLabel(recommendation.origin)}</span>
          <span>排序分 {recommendation.rank_score.toFixed(3)}</span>
          <span>分差 {recommendation.score_margin.toFixed(3)}</span>
          <span>{recommendation.model_version}</span>
        </div>
        {recommendation.evidence.length > 0 ? (
          <p className="recommendation-card__evidence">{recommendation.evidence.join(" · ")}</p>
        ) : null}
        <button
          type="button"
          className="text-button"
          onClick={() => chooseMerchant(recommendation.merchant, recommendation.category)}
        >
          恢复推荐预填
        </button>
      </section>

      <form className="mapping-form" onSubmit={(event) => void submitPreview(event)}>
        <div className="field-grid">
          <label className="field">
            <span>Merchant</span>
            <input
              value={merchant}
              list="merchant-options"
              autoComplete="off"
              onChange={(event) => {
                const value = event.target.value;
                setMerchant(value);
                const option = workspace.merchants.find((candidate) => candidate.name === value.trim());
                if (option) setCategory(option.default_category);
                invalidatePreview();
              }}
            />
            <datalist id="merchant-options">
              {workspace.merchants.map((option) => (
                <option key={option.name} value={option.name}>{option.default_category}</option>
              ))}
            </datalist>
            <small>
              {exactMerchant
                ? `已有 Merchant，当前默认分类为 ${exactMerchant.default_category}`
                : "未命中已有 Merchant；Preview 会把它标记为新建候选"}
            </small>
          </label>

          <label className="field">
            <span>默认 Category</span>
            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value);
                invalidatePreview();
              }}
            >
              <option value="">请选择分类</option>
              {workspace.categories.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
            <small>应用后，它会成为这个 Merchant 的默认分类。</small>
          </label>
        </div>

        {recommendation.alternatives.length > 0 ? (
          <div className="alternatives">
            <span>其他候选</span>
            <div>
              {recommendation.alternatives.map((alternative) => (
                <button
                  type="button"
                  key={`${alternative.merchant}-${alternative.matched_description}`}
                  onClick={() => chooseMerchant(alternative.merchant, alternative.category)}
                >
                  {alternative.merchant}
                  {alternative.category ? ` · ${alternative.category}` : ""}
                  <small>{alternative.rank_score.toFixed(3)}</small>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {item.transaction_only_exception_count > 0 ? (
          <p className="exception-note">
            {item.transaction_only_exception_count} 笔交易已有单笔 Merchant 例外，Apply 不会覆盖它们。
          </p>
        ) : null}

        {status ? <p className="form-status" role="alert">{status}</p> : null}

        <div className="form-actions">
          <span>修改任一字段都会使已有 Preview 失效。</span>
          <button className="button button--primary" type="submit" disabled={busy !== null}>
            {busy === "preview" ? "计算中…" : preview ? "重新 Preview" : "Preview 影响范围"}
          </button>
        </div>
      </form>

      {preview ? (
        <section className="preview-card">
          <div className="preview-card__heading">
            <div>
              <p className="eyebrow">Ready to apply</p>
              <h3>影响范围已经锁定</h3>
            </div>
            <span>{preview.is_new_merchant ? "将创建新 Merchant" : "使用已有 Merchant"}</span>
          </div>

          <dl className="impact-grid">
            {impact.map((line) => (
              <div key={line.label} className={line.emphasis ? "impact-grid__emphasis" : ""}>
                <dt>{line.label}</dt>
                <dd>{line.value}</dd>
              </div>
            ))}
          </dl>

          <div className="preview-route">
            <span>{preview.description}</span>
            <b>→</b>
            <strong>{preview.merchant}</strong>
            <b>→</b>
            <strong>{preview.category}</strong>
          </div>

          {preview.is_new_merchant ? (
            <label className="confirm-new-merchant">
              <input
                type="checkbox"
                checked={confirmNewMerchant}
                onChange={(event) => setConfirmNewMerchant(event.target.checked)}
              />
              <span>我确认创建新 Merchant「{preview.merchant}」并应用上述 Mapping。</span>
            </label>
          ) : null}

          <div className="preview-card__actions">
            <span>Apply 会写入 Mapping、传播 Enrichment，并刷新统计。</span>
            <button
              className="button button--commit"
              type="button"
              disabled={busy !== null || (preview.is_new_merchant && !confirmNewMerchant)}
              onClick={() => void applyMapping()}
            >
              {busy === "apply" ? "正在应用…" : "确认 Apply"}
            </button>
          </div>
        </section>
      ) : null}
    </article>
  );
}

function ListSkeleton() {
  return (
    <div className="list-skeleton" aria-label="正在加载审核队列">
      {[0, 1, 2, 3].map((item) => <span key={item} />)}
    </div>
  );
}
