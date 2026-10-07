import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { RagBadge } from "@/components/rag-badge";
import { db } from "@/db";
import { monthlyUpdates, portfolios } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { currentMonth, formatDateTime, formatMonth, formatNgn, recentMonths } from "@/lib/format";
import { SubmissionForm } from "./submission-form";

export const metadata: Metadata = { title: "Monthly update" };

export default async function SubmitPage() {
  const session = await requireSession("portfolio_manager");

  const [myPortfolios, mySubmissions] = await Promise.all([
    db.query.portfolios.findMany({
      columns: { id: true, name: true },
      where: eq(portfolios.managerId, session.userId),
      orderBy: portfolios.name,
    }),
    db
      .select({
        id: monthlyUpdates.id,
        portfolioId: monthlyUpdates.portfolioId,
        portfolioName: portfolios.name,
        reportingMonth: monthlyUpdates.reportingMonth,
        cashPositionKobo: monthlyUpdates.cashPositionKobo,
        ragStatus: monthlyUpdates.ragStatus,
        updatedAt: monthlyUpdates.updatedAt,
      })
      .from(monthlyUpdates)
      .innerJoin(portfolios, eq(portfolios.id, monthlyUpdates.portfolioId))
      .where(eq(portfolios.managerId, session.userId))
      .orderBy(desc(monthlyUpdates.reportingMonth), portfolios.name),
  ]);

  const thisMonth = currentMonth();
  const months = recentMonths(12).map((value) => ({ value, label: formatMonth(value) }));
  const filed = mySubmissions.map((s) => `${s.portfolioId}:${s.reportingMonth}`);
  const firstName = session.name.split(" ")[0];

  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Monthly update · {formatMonth(thisMonth)}</p>
        <h1 className="mt-2 font-serif text-4xl font-normal tracking-tight">Good to see you, {firstName}.</h1>
        <p className="text-muted mt-2 max-w-xl text-[15px]">
          File one update per portfolio each month. It takes under a minute and goes straight to the Chief of
          Staff.
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="card p-6 sm:p-8">
          {myPortfolios.length ? (
            <SubmissionForm portfolios={myPortfolios} months={months} filed={filed} />
          ) : (
            <p className="text-muted text-sm">
              No portfolios are assigned to you yet. Contact the Chief of Staff.
            </p>
          )}
        </section>

        <aside className="space-y-6">
          <section className="card p-6">
            <p className="eyebrow">{formatMonth(thisMonth)} status</p>
            <ul className="divide-hairline mt-4 divide-y">
              {myPortfolios.map((p) => {
                const done = filed.includes(`${p.id}:${thisMonth}`);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-ink text-sm font-medium">{p.name}</span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${done ? "text-rag-green" : "text-rag-amber"}`}
                    >
                      {done ? "Filed" : "Due"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card p-6">
            <p className="eyebrow">Your recent updates</p>
            {mySubmissions.length ? (
              <ul className="mt-4 space-y-4">
                {mySubmissions.slice(0, 6).map((s) => (
                  <li key={s.id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-medium">{s.portfolioName}</p>
                      <p className="num text-muted text-xs">
                        {formatMonth(s.reportingMonth, "short")} · {formatNgn(s.cashPositionKobo)}
                      </p>
                      <p className="text-faint text-[11px]">Updated {formatDateTime(s.updatedAt)}</p>
                    </div>
                    <RagBadge status={s.ragStatus} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted mt-3 text-sm">Nothing filed yet.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
