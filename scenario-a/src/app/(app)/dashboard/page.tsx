import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { RAG_META, RagBadge } from "@/components/rag-badge";
import { db } from "@/db";
import { monthlyUpdates, portfolios, RAG_STATUSES, users, type RagStatus } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatDateTime, formatMonth, formatNgn, formatNgnCompact } from "@/lib/format";
import { Filters } from "./filters";

export const metadata: Metadata = { title: "Dashboard" };

const SEVERITY: Record<RagStatus, number> = { red: 0, amber: 1, green: 2 };

/** Blockers PMs mark as "None" are de-emphasised so real ones stand out. */
const isNoBlocker = (text: string) => /^(none|n\/a|nil)\b/i.test(text.trim());

type SearchParams = Promise<{ month?: string; rag?: string }>;

export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSession("chief_of_staff");
  const { month, rag } = await searchParams;

  const [allPortfolios, submissions] = await Promise.all([
    db
      .select({ id: portfolios.id, name: portfolios.name, manager: users.name })
      .from(portfolios)
      .innerJoin(users, eq(users.id, portfolios.managerId))
      .orderBy(portfolios.name),
    db
      .select({
        id: monthlyUpdates.id,
        portfolioId: monthlyUpdates.portfolioId,
        portfolioName: portfolios.name,
        manager: users.name,
        reportingMonth: monthlyUpdates.reportingMonth,
        cashPositionKobo: monthlyUpdates.cashPositionKobo,
        ragStatus: monthlyUpdates.ragStatus,
        executionBlocker: monthlyUpdates.executionBlocker,
        updatedAt: monthlyUpdates.updatedAt,
      })
      .from(monthlyUpdates)
      .innerJoin(portfolios, eq(portfolios.id, monthlyUpdates.portfolioId))
      .innerJoin(users, eq(users.id, portfolios.managerId))
      .orderBy(desc(monthlyUpdates.reportingMonth), portfolios.name),
  ]);

  const months = [...new Set(submissions.map((s) => s.reportingMonth))];
  // Headline figures describe one month: the filtered one, else the latest on file.
  const focusMonth = month && months.includes(month) ? month : months[0];
  const focus = submissions.filter((s) => s.reportingMonth === focusMonth);
  const reported = new Set(focus.map((s) => s.portfolioId));
  const outstanding = allPortfolios.filter((p) => !reported.has(p.id));
  const totalCash = focus.reduce((sum, s) => sum + s.cashPositionKobo, 0);
  const ragCount = (rows: typeof submissions, status: RagStatus) =>
    rows.filter((r) => r.ragStatus === status).length;

  const inMonth = month ? submissions.filter((s) => s.reportingMonth === month) : submissions;
  const ragFilter = RAG_STATUSES.find((s) => s === rag);
  const rows = (ragFilter ? inMonth.filter((s) => s.ragStatus === ragFilter) : inMonth).sort(
    (a, b) =>
      b.reportingMonth.localeCompare(a.reportingMonth) ||
      SEVERITY[a.ragStatus] - SEVERITY[b.ragStatus] ||
      a.portfolioName.localeCompare(b.portfolioName),
  );

  const groups = [...new Set(rows.map((r) => r.reportingMonth))].map((m) => {
    const items = rows.filter((r) => r.reportingMonth === m);
    return { month: m, items, cash: items.reduce((sum, r) => sum + r.cashPositionKobo, 0) };
  });

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Portfolio overview</p>
          <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight">
            {focusMonth ? formatMonth(focusMonth) : "No updates yet"}
          </h1>
        </div>
        <p className="text-muted text-sm">
          {allPortfolios.length} portfolios · {submissions.length} updates on file
        </p>
      </header>

      {focusMonth && (
        <section className="grid gap-4 md:grid-cols-3" aria-label={`Summary for ${formatMonth(focusMonth)}`}>
          <article className="card p-6">
            <p className="eyebrow">Cash position</p>
            <p className="num mt-3 font-serif text-4xl tracking-tight">{formatNgnCompact(totalCash)}</p>
            <p className="num text-muted mt-1 text-xs">{formatNgn(totalCash)}</p>
            <p className="text-faint mt-4 text-xs">
              Aggregate across {focus.length} reporting {focus.length === 1 ? "portfolio" : "portfolios"}
            </p>
          </article>

          <article className="card p-6">
            <p className="eyebrow">Reporting</p>
            <p className="num mt-3 font-serif text-4xl tracking-tight">
              {reported.size}
              <span className="text-faint text-2xl"> / {allPortfolios.length}</span>
            </p>
            <div className="bg-ink/[0.06] mt-3 h-1.5 overflow-hidden rounded-full">
              <div
                className="bg-navy h-full rounded-full"
                style={{ width: `${(reported.size / Math.max(allPortfolios.length, 1)) * 100}%` }}
              />
            </div>
            {outstanding.length ? (
              <ul className="mt-4 space-y-1.5">
                {outstanding.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 text-xs">
                    <span className="text-ink-soft truncate font-medium">{p.name}</span>
                    <span className="text-rag-amber shrink-0">Awaiting · {p.manager.split(" ")[0]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-rag-green mt-4 text-xs">All portfolios have reported.</p>
            )}
          </article>

          <article className="card p-6">
            <p className="eyebrow">RAG distribution</p>
            <div className="bg-ink/[0.06] mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {RAG_STATUSES.map((s) => {
                const n = ragCount(focus, s);
                return n ? (
                  <div
                    key={s}
                    className={RAG_META[s].bar}
                    style={{ flexGrow: n }}
                    title={`${RAG_META[s].label}: ${n}`}
                  />
                ) : null;
              })}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2">
              {RAG_STATUSES.map((s) => (
                <div key={s}>
                  <dt className="text-muted flex items-center gap-1.5 text-xs">
                    <span className={`size-1.5 rounded-full ${RAG_META[s].dot}`} />
                    {RAG_META[s].label}
                  </dt>
                  <dd className="num mt-0.5 font-serif text-2xl">{ragCount(focus, s)}</dd>
                </div>
              ))}
            </dl>
            {ragCount(focus, "red") > 0 && (
              <p className="bg-rag-red-bg text-rag-red mt-4 rounded-md px-2.5 py-1.5 text-xs">
                Needs attention:{" "}
                {focus
                  .filter((s) => s.ragStatus === "red")
                  .map((s) => s.portfolioName)
                  .join(", ")}
              </p>
            )}
          </article>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl font-normal tracking-tight">Submissions</h2>
          <p className="num text-muted text-sm">{rows.length} shown</p>
        </div>

        <Filters
          months={months.map((value) => ({ value, label: formatMonth(value) }))}
          counts={{
            all: inMonth.length,
            green: ragCount(inMonth, "green"),
            amber: ragCount(inMonth, "amber"),
            red: ragCount(inMonth, "red"),
          }}
        />

        <div className="card overflow-hidden">
          {rows.length === 0 ? (
            <p className="text-muted px-6 py-16 text-center text-sm">No submissions match these filters.</p>
          ) : (
            <>
              {/* Desktop */}
              <table className="hidden w-full text-left text-sm md:table">
                <thead className="border-hairline bg-paper/60 border-b">
                  <tr className="text-muted text-[11px] font-semibold tracking-[0.12em] whitespace-nowrap uppercase">
                    <th className="px-6 py-3 font-semibold">Portfolio</th>
                    <th className="px-4 py-3 text-right font-semibold">Cash position (NGN)</th>
                    <th className="px-4 py-3 font-semibold">RAG</th>
                    <th className="px-4 py-3 font-semibold">Execution blocker</th>
                    <th className="px-6 py-3 text-right font-semibold">Updated</th>
                  </tr>
                </thead>
                {groups.map((g) => (
                  <tbody
                    key={g.month}
                    className="divide-hairline border-hairline divide-y border-b last:border-b-0"
                  >
                    <tr className="bg-paper/40">
                      <th
                        scope="colgroup"
                        className="text-ink px-6 py-2.5 text-left font-serif text-[15px] font-medium"
                      >
                        {formatMonth(g.month)}
                        <span className="text-muted ml-2 font-sans text-xs font-normal">
                          {g.items.length} {g.items.length === 1 ? "update" : "updates"}
                        </span>
                      </th>
                      <td className="num text-ink-soft px-4 py-2.5 text-right text-xs font-semibold">
                        {formatNgn(g.cash)}
                      </td>
                      <td colSpan={3} />
                    </tr>
                    {g.items.map((s) => (
                      <tr key={s.id} className="hover:bg-paper/50 align-top transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <p className="text-ink font-medium">{s.portfolioName}</p>
                          <p className="text-muted mt-0.5 text-xs">{s.manager}</p>
                        </td>
                        <td className="num text-ink px-4 py-4 text-right font-medium whitespace-nowrap">
                          {formatNgn(s.cashPositionKobo)}
                        </td>
                        <td className="px-4 py-4">
                          <RagBadge status={s.ragStatus} />
                        </td>
                        <td
                          className={`px-4 py-4 leading-relaxed ${isNoBlocker(s.executionBlocker) ? "text-faint" : "text-ink-soft"}`}
                        >
                          {s.executionBlocker}
                        </td>
                        <td className="num text-muted px-6 py-4 text-right text-xs whitespace-nowrap">
                          {formatDateTime(s.updatedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>

              {/* Mobile */}
              <ul className="divide-hairline divide-y md:hidden">
                {rows.map((s) => (
                  <li key={s.id} className="space-y-3 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-ink font-medium">{s.portfolioName}</p>
                        <p className="text-muted text-xs">
                          {s.manager} · {formatMonth(s.reportingMonth, "short")}
                        </p>
                      </div>
                      <RagBadge status={s.ragStatus} />
                    </div>
                    <p className="num text-ink text-lg font-medium">{formatNgn(s.cashPositionKobo)}</p>
                    <p
                      className={`text-sm leading-relaxed ${isNoBlocker(s.executionBlocker) ? "text-faint" : "text-ink-soft"}`}
                    >
                      {s.executionBlocker}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
