"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RAG_STATUSES, type RagStatus } from "@/db/schema";
import { RAG_META } from "@/components/rag-badge";

type Props = {
  months: { value: string; label: string }[];
  counts: Record<RagStatus | "all", number>;
};

export function Filters({ months, counts }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const month = params.get("month") ?? "";
  const rag = params.get("rag") ?? "";

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  const tabs = [{ value: "", label: "All", count: counts.all }].concat(
    RAG_STATUSES.map((s) => ({ value: s, label: RAG_META[s].label, count: counts[s] })),
  );

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${pending ? "opacity-70" : ""}`}
    >
      <div
        role="tablist"
        aria-label="Filter by RAG status"
        className="bg-ink/[0.04] inline-flex rounded-lg p-1"
      >
        {tabs.map((tab) => {
          const active = rag === tab.value;
          return (
            <button
              key={tab.label}
              role="tab"
              aria-selected={active}
              onClick={() => update("rag", tab.value)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active ? "bg-surface text-ink shadow-(--shadow-card)" : "text-muted hover:text-ink"
              }`}
            >
              {tab.value && (
                <span className={`size-1.5 rounded-full ${RAG_META[tab.value as RagStatus].dot}`} />
              )}
              {tab.label}
              <span className="num text-faint text-xs">{tab.count}</span>
            </button>
          );
        })}
      </div>

      <label className="text-muted flex items-center gap-2 text-sm">
        <span className="sr-only sm:not-sr-only">Reporting month</span>
        <select
          value={month}
          onChange={(e) => update("month", e.target.value)}
          className="field appearance-none bg-[url(/chevron.svg)] bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat py-1.5 pr-9 text-sm sm:w-48"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
