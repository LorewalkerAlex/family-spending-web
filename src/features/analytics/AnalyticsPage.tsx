import { useCallback, useEffect, useMemo, useState } from "react";

import {
  ApiError,
  analyticsApi,
  mappingReviewApi,
  type AnalyticsApi,
  type FinancialAnalytics,
  type MappingReviewApi,
  type RuntimeStatus,
  type SpendingAnalytics,
} from "../../api/client";
import { WorkspaceSidebar } from "../../components/WorkspaceSidebar";
import { formatMinorMoney } from "../../presentation/format";
import type { TransactionRouteFilters } from "../../routing";
import {
  buildTrendPoints,
  categoryShares,
  formatMonthLabel,
  latestMonth,
  trendArea,
  trendLine,
  visibleFinancialMonths,
  visibleSpendingMonths,
} from "./model";

export type AnalyticsView = "spending" | "financial";

function messageFrom(error: unknown): string {
  if (error instanceof ApiError) {
    const request = error.requestId ? ` · request ${error.requestId}` : "";
    return `${error.message}${request}`;
  }
  return error instanceof Error ? error.message : String(error);
}

export function AnalyticsPage({
  view,
  onViewTransactions,
  api = analyticsApi,
  statusApi = mappingReviewApi,
}: {
  view: AnalyticsView;
  onViewTransactions: (filters: Partial<TransactionRouteFilters>) => void;
  api?: AnalyticsApi;
  statusApi?: Pick<MappingReviewApi, "getRuntimeStatus">;
}) {
  const [spending, setSpending] = useState<SpendingAnalytics | null>(null);
  const [financial, setFinancial] = useState<FinancialAnalytics | null>(null);
  const [runtime, setRuntime] = useState<RuntimeStatus | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      if (view === "spending") {
        const [nextSpending, nextRuntime] = await Promise.all([
          api.getSpending(signal),
          statusApi.getRuntimeStatus(signal),
        ]);
        setSpending(nextSpending);
        setRuntime(nextRuntime);
        const visible = visibleSpendingMonths(nextSpending);
        setSelectedMonth((current) => (
          current && visible.some((month) => month.month === current)
            ? current
            : latestMonth(visible)?.month ?? null
        ));
      } else {
        const [nextFinancial, nextRuntime] = await Promise.all([
          api.getFinancial(signal),
          statusApi.getRuntimeStatus(signal),
        ]);
        setFinancial(nextFinancial);
        setRuntime(nextRuntime);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError(messageFrom(caught));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [api, statusApi, view]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const copy = view === "spending"
    ? {
        eyebrow: "Spending Analytics",
        title: "消费去了哪里，一眼看清",
        description: "净消费、退款核对、月度走势和分类结构全部来自 Backend projection。",
      }
    : {
        eyebrow: "Financial Analytics",
        title: "收入、支出与现金流",
        description: "按完整账单月查看家庭现金流，并下钻到组成指标的交易记录。",
      };

  return (
    <div className="app-shell">
      <WorkspaceSidebar
        activePage={view}
        runtime={runtime}
        transactionCount={runtime?.counts.transactions}
      />

      <main className="page-shell" id={view}>
        <header className="page-header">
          <div>
            <p className="eyebrow">{copy.eyebrow}</p>
            <h1>{copy.title}</h1>
            <p className="page-header__description">{copy.description}</p>
          </div>
          <button className="button button--secondary" type="button" disabled={loading} onClick={() => void load()}>
            {loading ? "刷新中…" : "刷新数据"}
          </button>
        </header>

        <section className="page-content analytics-page-content">
          <nav className="analytics-tabs" aria-label="分析视图">
            <a className={view === "spending" ? "is-active" : ""} href="#spending">消费分析</a>
            <a className={view === "financial" ? "is-active" : ""} href="#financial">财务分析</a>
          </nav>

          {error ? (
            <div className="notice notice--error">
              <span>{error}</span>
              <button type="button" onClick={() => void load()}>重试</button>
            </div>
          ) : null}
          {loading && ((view === "spending" && !spending) || (view === "financial" && !financial)) ? (
            <AnalyticsSkeleton />
          ) : null}
          {view === "spending" && spending ? (
            <SpendingDashboard
              data={spending}
              selectedMonth={selectedMonth}
              onSelectMonth={setSelectedMonth}
              onViewTransactions={onViewTransactions}
            />
          ) : null}
          {view === "financial" && financial ? (
            <FinancialDashboard data={financial} onViewTransactions={onViewTransactions} />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function SpendingDashboard({
  data,
  selectedMonth,
  onSelectMonth,
  onViewTransactions,
}: {
  data: SpendingAnalytics;
  selectedMonth: string | null;
  onSelectMonth: (month: string) => void;
  onViewTransactions: (filters: Partial<TransactionRouteFilters>) => void;
}) {
  const visibleMonths = useMemo(() => visibleSpendingMonths(data), [data]);
  const activeMonth = visibleMonths.find((month) => month.month === selectedMonth)
    ?? latestMonth(visibleMonths);
  const trendMonths = visibleMonths.slice(-12);
  const points = useMemo(() => buildTrendPoints(trendMonths), [trendMonths]);
  const categories = activeMonth ? categoryShares(activeMonth) : [];
  const reconciliation = data.reconciliation;
  const shown = data.summary.shown_data;

  if (!activeMonth) {
    return (
      <div className="analytics-empty">
        <strong>还没有完整账单月</strong>
        <p>Backend 已返回有效的空分析结果；有完整账单周期后，这里会自动显示趋势和结构。</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <section className="analytics-hero">
        <div className="analytics-hero__primary">
          <span>完整账单期净消费</span>
          <strong>{formatMinorMoney(shown.total_spending_minor, data.currency)}</strong>
          <p>{shown.month_count} 个完整月份 · {shown.transaction_count} 笔净消费交易</p>
        </div>
        <div className="analytics-kpis">
          <article><span>退款交易</span><strong>{reconciliation.refund_transactions}</strong><small>{reconciliation.fully_refunded_transactions} 笔全额退款</small></article>
          <article><span>退款匹配金额</span><strong>{formatMinorMoney(reconciliation.same_merchant_matched_amount_minor, data.currency)}</strong><small>{reconciliation.same_merchant_refund_matches} 组同商家匹配</small></article>
          <article><span>待分类净交易</span><strong>{reconciliation.unclassified_net_transactions}</strong><button type="button" onClick={() => onViewTransactions({ transactionType: "expense", classification: "unclassified" })}>查看交易 →</button></article>
        </div>
      </section>

      <section className="analytics-card analytics-trend-card">
        <header className="analytics-section-heading">
          <div><p className="eyebrow">Monthly trend</p><h2>最近 {trendMonths.length} 个完整月份</h2></div>
          <label>
            <span className="sr-only">选择消费月份</span>
            <select value={activeMonth.month} onChange={(event) => onSelectMonth(event.target.value)}>
              {visibleMonths.slice().reverse().map((month) => (
                <option key={month.month} value={month.month}>{formatMonthLabel(month.month)}</option>
              ))}
            </select>
          </label>
        </header>
        <div className="analytics-trend-plot">
          <svg viewBox="0 0 760 220" preserveAspectRatio="none" role="img" aria-label="月度净消费趋势">
            <line x1="0" y1="196" x2="760" y2="196" className="analytics-trend-plot__baseline" />
            <path d={trendArea(points)} className="analytics-trend-plot__area" />
            <path d={trendLine(points)} className="analytics-trend-plot__line" />
            {points.map((point) => (
              <circle
                key={point.month}
                cx={point.x}
                cy={point.y}
                r={point.month === activeMonth.month ? 6 : 3.5}
                className={point.month === activeMonth.month ? "is-active" : ""}
              />
            ))}
          </svg>
          <div className="analytics-trend-labels">
            {trendMonths.map((month) => (
              <button
                type="button"
                className={month.month === activeMonth.month ? "is-active" : ""}
                key={month.month}
                onClick={() => onSelectMonth(month.month)}
              >
                {month.month.slice(5)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="analytics-breakdown">
        <article className="analytics-card">
          <header className="analytics-section-heading">
            <div><p className="eyebrow">Category mix</p><h2>{formatMonthLabel(activeMonth.month)} 消费结构</h2></div>
            <strong>{formatMinorMoney(activeMonth.total_spending_minor, data.currency)}</strong>
          </header>
          <div className="category-spectrum" aria-label="分类消费占比">
            {categories.map((item, index) => (
              <span key={item.category} style={{ width: `${item.sharePercent}%` }} className={`spectrum-${Math.min(index, 6)}`} />
            ))}
          </div>
          <div className="analytics-category-list">
            {categories.slice(0, 8).map((item, index) => (
              <button
                type="button"
                key={item.category}
                onClick={() => onViewTransactions({
                  month: activeMonth.month,
                  category: item.category,
                  transactionType: "expense",
                })}
              >
                <i className={`spectrum-${Math.min(index, 6)}`} />
                <span><strong>{item.category}</strong><small>{item.transactionCount} 笔 · {item.sharePercent.toFixed(1)}%</small></span>
                <b>{formatMinorMoney(item.spendingMinor, data.currency)}</b>
              </button>
            ))}
          </div>
        </article>

        <article className="analytics-card">
          <header className="analytics-section-heading">
            <div><p className="eyebrow">Top merchants</p><h2>主要消费商家</h2></div>
            <button className="text-button" type="button" onClick={() => onViewTransactions({ month: activeMonth.month, transactionType: "expense" })}>查看本月交易</button>
          </header>
          <div className="analytics-merchant-list">
            {activeMonth.merchants.slice(0, 8).map((merchant, index) => (
              <div key={`${merchant.display_name}-${index}`}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p><strong>{merchant.display_name}</strong><small>{merchant.transaction_count} 笔{merchant.is_unclassified ? " · 待分类" : ""}</small></p>
                <b>{formatMinorMoney(merchant.spending_minor, data.currency)}</b>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="analytics-reconciliation">
        <article><span>净消费交易</span><strong>{reconciliation.net_consumption_transactions}</strong></article>
        <article><span>部分退款</span><strong>{reconciliation.partially_refunded_transactions}</strong></article>
        <article><span>未匹配退款</span><strong>{reconciliation.unmatched_refund_count}</strong><small>{formatMinorMoney(reconciliation.unmatched_refund_amount_minor, data.currency)}</small></article>
        <article><span>零金额交易</span><strong>{reconciliation.zero_amount_transactions}</strong></article>
      </section>
    </div>
  );
}

function FinancialDashboard({
  data,
  onViewTransactions,
}: {
  data: FinancialAnalytics;
  onViewTransactions: (filters: Partial<TransactionRouteFilters>) => void;
}) {
  const months = visibleFinancialMonths(data);
  const shown = data.summary.shown_data;
  const maxFlow = Math.max(1, ...months.flatMap((month) => [
    month.total_income_minor,
    month.total_spending_minor,
  ]));

  if (months.length === 0) {
    return (
      <div className="analytics-empty">
        <strong>还没有完整账单月</strong>
        <p>财务投影已经成功加载，但当前没有可展示的完整账单周期。</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      <section className="financial-summary-grid">
        <button type="button" onClick={() => onViewTransactions({ transactionType: "income" })}>
          <span>完整账单期收入</span><strong>{formatMinorMoney(shown.total_income_minor, data.currency)}</strong><small>{shown.income_transaction_count} 笔收入 · 查看交易 →</small>
        </button>
        <button type="button" onClick={() => onViewTransactions({ transactionType: "expense" })}>
          <span>完整账单期净消费</span><strong>{formatMinorMoney(shown.total_spending_minor, data.currency)}</strong><small>{shown.spending_transaction_count} 笔消费 · 查看交易 →</small>
        </button>
        <article className={shown.net_cash_flow_minor < 0 ? "is-negative" : "is-positive"}>
          <span>净现金流</span><strong>{formatMinorMoney(shown.net_cash_flow_minor, data.currency)}</strong><small>{shown.month_count} 个完整账单月</small>
        </article>
      </section>

      <section className="analytics-card financial-months-card">
        <header className="analytics-section-heading">
          <div><p className="eyebrow">Statement cycles</p><h2>月度现金流</h2></div>
          <span>仅汇总 Backend 标记为完整的月份</span>
        </header>
        <div className="financial-months">
          {months.slice().reverse().slice(0, 18).map((month) => (
            <article key={month.month} className="financial-month-row">
              <div className="financial-month-row__heading">
                <div><strong>{formatMonthLabel(month.month)}</strong><span>{month.spending_data_complete ? "完整账单周期" : "数据进行中"}</span></div>
                <b className={month.net_cash_flow_minor < 0 ? "is-negative" : "is-positive"}>{formatMinorMoney(month.net_cash_flow_minor, data.currency)}</b>
              </div>
              <div className="financial-flow-bars">
                <button type="button" onClick={() => onViewTransactions({ month: month.month, transactionType: "income" })}>
                  <span>收入 · {month.income_transaction_count} 笔</span>
                  <i><b style={{ width: `${(month.total_income_minor / maxFlow) * 100}%` }} /></i>
                  <strong>{formatMinorMoney(month.total_income_minor, data.currency)}</strong>
                </button>
                <button type="button" onClick={() => onViewTransactions({ month: month.month, transactionType: "expense" })}>
                  <span>净消费 · {month.spending_transaction_count} 笔</span>
                  <i><b style={{ width: `${(month.total_spending_minor / maxFlow) * 100}%` }} /></i>
                  <strong>{formatMinorMoney(month.total_spending_minor, data.currency)}</strong>
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="analytics-reconciliation financial-all-data">
        <article><span>全部数据收入</span><strong>{formatMinorMoney(data.summary.all_data.total_income_minor, data.currency)}</strong></article>
        <article><span>全部数据净消费</span><strong>{formatMinorMoney(data.summary.all_data.total_spending_minor, data.currency)}</strong></article>
        <article><span>全部数据净现金流</span><strong>{formatMinorMoney(data.summary.all_data.net_cash_flow_minor, data.currency)}</strong></article>
      </section>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="analytics-skeleton" aria-label="正在加载分析数据">
      <span />
      <span />
      <span />
    </div>
  );
}
