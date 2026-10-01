import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  ApiError,
  mappingReviewApi,
  transactionApi,
  type MappingReviewApi,
  type RuntimeStatus,
  type TransactionApi,
  type TransactionListMeta,
  type TransactionView,
} from "../../api/client";
import { WorkspaceSidebar } from "../../components/WorkspaceSidebar";
import { formatMoney } from "../../presentation/format";
import {
  PAGE_SIZE,
  categorySourceLabel,
  defaultTransactionFilters,
  pageSummary,
  reviewSignalLabel,
  transactionQuery,
  transactionTypeLabel,
  type TransactionFilters,
} from "./model";

interface TransactionPageData {
  data: TransactionView[];
  meta: TransactionListMeta;
}

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` · request ${error.requestId}` : "";
    return `${error.message}${request}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function TransactionsPage({
  initialDescription = "",
  api = transactionApi,
  statusApi = mappingReviewApi,
}: {
  initialDescription?: string;
  api?: TransactionApi;
  statusApi?: Pick<MappingReviewApi, "getRuntimeStatus">;
}) {
  const initialFilters = {
    ...defaultTransactionFilters,
    description: initialDescription,
  };
  const [draftFilters, setDraftFilters] = useState<TransactionFilters>(initialFilters);
  const [filters, setFilters] = useState<TransactionFilters>(initialFilters);
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<TransactionPageData | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = { ...defaultTransactionFilters, description: initialDescription };
    setDraftFilters(next);
    setFilters(next);
    setOffset(0);
  }, [initialDescription]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [nextPage, nextRuntime] = await Promise.all([
        api.listTransactions(transactionQuery(filters, offset), signal),
        statusApi.getRuntimeStatus(signal),
      ]);
      setPage(nextPage);
      setRuntime(nextRuntime);
      setSelectedId((current) =>
        current && nextPage.data.some((item) => item.transaction.id === current)
          ? current
          : (nextPage.data[0]?.transaction.id ?? null),
      );
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(messageFrom(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, filters, offset, statusApi]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetail(null);
    setDetailLoading(true);
    api.getTransaction(selectedId, controller.signal)
      .then(setDetail)
      .catch((caught: unknown) => {
        if (!(caught instanceof DOMException && caught.name === "AbortError")) {
          setError(messageFrom(caught));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [api, selectedId]);

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFilters(draftFilters);
    setOffset(0);
  }

  function resetFilters(): void {
    setDraftFilters(defaultTransactionFilters);
    setFilters(defaultTransactionFilters);
    setOffset(0);
  }

  const meta = page?.meta;
  const hasPrevious = Boolean(meta && meta.offset > 0);
  const hasNext = Boolean(meta && meta.offset + meta.limit < meta.total);

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        activePage="transactions"
        runtime={runtime}
        transactionCount={runtime?.counts.transactions}
      />

      <main className="page-shell" id="transactions">
        <header className="page-header">
          <div>
            <p className="eyebrow">Transaction Ledger</p>
            <h1>每一笔交易，都能追到来源</h1>
            <p className="page-header__description">
              查询后端 Read Model 中的交易事实与当前 Enrichment。列表筛选由后端执行，详情独立读取。
            </p>
          </div>
          <button className="button button--secondary" type="button" disabled={loading} onClick={() => void load()}>
            {loading ? "刷新中…" : "刷新数据"}
          </button>
        </header>

        <section className="page-content transaction-page-content">
          {filters.description ? (
            <div className="notice notice--success notice--with-action">
              <span>正在核对 Mapping「{filters.description}」对应的交易。</span>
              <button type="button" onClick={resetFilters}>查看全部交易</button>
            </div>
          ) : null}
          {error ? (
            <div className="notice notice--error">
              <span>{error}</span>
              <button type="button" onClick={() => void load()}>重试</button>
            </div>
          ) : null}

          <form className="transaction-filters" onSubmit={applyFilters}>
            <label>
              <span>类型</span>
              <select
                value={draftFilters.transactionType}
                onChange={(event) => setDraftFilters({
                  ...draftFilters,
                  transactionType: event.target.value as TransactionFilters["transactionType"],
                })}
              >
                <option value="all">全部</option>
                <option value="expense">支出</option>
                <option value="income">收入</option>
              </select>
            </label>
            <label>
              <span>分类状态</span>
              <select
                value={draftFilters.classification}
                onChange={(event) => setDraftFilters({
                  ...draftFilters,
                  classification: event.target.value as TransactionFilters["classification"],
                })}
              >
                <option value="all">全部</option>
                <option value="classified">已分类</option>
                <option value="unclassified">待分类</option>
              </select>
            </label>
            <label>
              <span>Category（精确）</span>
              <input
                value={draftFilters.category}
                placeholder="例如：餐饮"
                onChange={(event) => setDraftFilters({ ...draftFilters, category: event.target.value })}
              />
            </label>
            <label>
              <span>原始 Description（精确）</span>
              <input
                value={draftFilters.description}
                placeholder="留空显示全部"
                onChange={(event) => setDraftFilters({ ...draftFilters, description: event.target.value })}
              />
            </label>
            <label>
              <span>排序</span>
              <select
                value={draftFilters.sort}
                onChange={(event) => setDraftFilters({
                  ...draftFilters,
                  sort: event.target.value as TransactionFilters["sort"],
                })}
              >
                <option value="date_desc">日期：新到旧</option>
                <option value="date_asc">日期：旧到新</option>
                <option value="amount_desc">金额：高到低</option>
                <option value="amount_asc">金额：低到高</option>
              </select>
            </label>
            <div className="transaction-filters__actions">
              <button className="button button--secondary" type="button" onClick={resetFilters}>重置</button>
              <button className="button button--primary" type="submit">应用筛选</button>
            </div>
          </form>

          <div className="transactions-workspace">
            <section className="transaction-list-pane" aria-label="交易列表">
              <div className="transaction-list-toolbar">
                <div>
                  <span className="metric-label">查询结果</span>
                  <strong>{meta ? pageSummary(meta) : "—"}</strong>
                </div>
                <div className="transaction-pager">
                  <button
                    type="button"
                    disabled={!hasPrevious || loading}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  >
                    上一页
                  </button>
                  <button
                    type="button"
                    disabled={!hasNext || loading}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                  >
                    下一页
                  </button>
                </div>
              </div>

              <div className="transaction-list" aria-live="polite">
                {loading && !page ? <TransactionSkeleton /> : null}
                {!loading && page?.data.length === 0 ? (
                  <div className="empty-state">
                    <strong>当前筛选没有交易</strong>
                    <p>调整筛选条件，或返回 Mapping 审核继续处理待分类项目。</p>
                  </div>
                ) : null}
                {page?.data.map((item) => (
                  <TransactionRow
                    item={item}
                    key={item.transaction.id}
                    selected={item.transaction.id === selectedId}
                    onSelect={() => setSelectedId(item.transaction.id)}
                  />
                ))}
              </div>
            </section>

            <section className="transaction-detail-pane" aria-label="交易详情">
              {detailLoading && !detail ? <div className="detail-loading">正在读取交易详情…</div> : null}
              {detail ? <TransactionDetail item={detail} /> : null}
              {!detailLoading && !detail ? (
                <div className="detail-empty">
                  <div className="detail-empty__mark">→</div>
                  <strong>选择一笔交易</strong>
                  <p>这里会显示权威来源、原始描述和后端派生的 Enrichment。</p>
                </div>
              ) : null}
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}

function TransactionRow({
  item,
  selected,
  onSelect,
}: {
  item: TransactionView;
  selected: boolean;
  onSelect: () => void;
}) {
  const { transaction, enrichment } = item;
  return (
    <button
      type="button"
      className={`transaction-row${selected ? " transaction-row--selected" : ""}`}
      onClick={onSelect}
    >
      <span className="transaction-row__primary">
        <span className="transaction-row__topline">
          <span>{transactionTypeLabel(transaction.transaction_type)}</span>
          <time dateTime={transaction.transaction_date}>{transaction.transaction_date}</time>
        </span>
        <strong>{enrichment.display_name}</strong>
        <small>{item.description ?? "无原始描述"}</small>
      </span>
      <span className="transaction-row__secondary">
        <strong className={`amount amount--${transaction.transaction_type}`}>
          {formatMoney(transaction.amount, transaction.currency)}
        </strong>
        <span className={enrichment.is_unclassified ? "category category--attention" : "category"}>
          {enrichment.category}
        </span>
      </span>
    </button>
  );
}

function TransactionDetail({ item }: { item: TransactionView }) {
  const { transaction, enrichment } = item;
  return (
    <article className="transaction-detail">
      <header className="transaction-detail__header">
        <div>
          <p className="eyebrow">{transactionTypeLabel(transaction.transaction_type)}</p>
          <h2>{enrichment.display_name}</h2>
          <p>{transaction.transaction_date} · {formatMoney(transaction.amount, transaction.currency)}</p>
        </div>
        <span className={enrichment.is_unclassified ? "source-pill source-pill--attention" : "source-pill"}>
          {enrichment.category}
        </span>
      </header>

      <section className="transaction-detail__section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Authoritative facts</p>
            <h3>交易与来源</h3>
          </div>
        </div>
        <dl className="transaction-facts">
          <div><dt>Transaction ID</dt><dd>{transaction.id}</dd></div>
          <div><dt>Source Record ID</dt><dd>{item.authoritative_source_record_id}</dd></div>
          <div><dt>原始 Description</dt><dd>{item.description ?? "—"}</dd></div>
          <div><dt>币种</dt><dd>{transaction.currency}</dd></div>
        </dl>
      </section>

      <section className="transaction-detail__section enrichment-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Derived presentation</p>
            <h3>当前 Enrichment</h3>
          </div>
          <span>{categorySourceLabel(enrichment.category_source)}</span>
        </div>
        <dl className="transaction-facts">
          <div><dt>Merchant</dt><dd>{enrichment.merchant_name ?? "未识别"}</dd></div>
          <div><dt>显示名称</dt><dd>{enrichment.display_name}</dd></div>
          <div><dt>Merchant 默认分类</dt><dd>{enrichment.default_category ?? "—"}</dd></div>
          <div><dt>最终分类</dt><dd>{enrichment.category}</dd></div>
        </dl>
        {enrichment.note ? <p className="transaction-note"><strong>Note</strong>{enrichment.note}</p> : null}
        {enrichment.review_signals.length > 0 ? (
          <div className="review-signals">
            <strong>复核信号</strong>
            <ul>
              {enrichment.review_signals.map((signal) => (
                <li key={signal}>{reviewSignalLabel(signal)}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="transaction-note transaction-note--quiet">当前没有额外复核信号。</p>
        )}
      </section>
    </article>
  );
}

function TransactionSkeleton() {
  return (
    <div className="list-skeleton" aria-label="正在加载交易">
      {[0, 1, 2, 3, 4].map((item) => <span key={item} />)}
    </div>
  );
}
