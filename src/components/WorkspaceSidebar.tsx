import type { RuntimeStatus } from "../api/client";

export type WorkspacePage = "mapping-review" | "transactions" | "spending" | "financial";

export function WorkspaceSidebar({
  activePage,
  runtime,
  mappingCount,
  transactionCount,
}: {
  activePage: WorkspacePage;
  runtime: RuntimeStatus | null;
  mappingCount?: number;
  transactionCount?: number;
}) {
  const links: Array<{
    page: WorkspacePage;
    label: string;
    status?: number;
  }> = [
    { page: "mapping-review", label: "Mapping 审核", status: mappingCount },
    { page: "transactions", label: "交易流水", status: transactionCount },
    { page: "spending", label: "消费分析" },
    { page: "financial", label: "财务分析" },
  ];

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand__mark" aria-hidden="true">FS</span>
        <div>
          <strong>家庭消费</strong>
          <span>Family Spending</span>
        </div>
      </div>

      <nav className="workspace-nav" aria-label="主导航">
        {links.map((link) => (
          <a
            className={`workspace-nav__item${activePage === link.page ? " workspace-nav__item--active" : ""}`}
            href={`#${link.page}`}
            key={link.page}
          >
            <span>{link.label}</span>
            {link.status === undefined ? null : <small>{link.status}</small>}
          </a>
        ))}
        {["自动化"].map((label) => (
          <span className="workspace-nav__item workspace-nav__item--disabled" key={label}>
            <span>{label}</span>
            <small>下一阶段</small>
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
  );
}
