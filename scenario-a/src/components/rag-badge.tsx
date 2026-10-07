import type { RagStatus } from "@/db/schema";

export const RAG_META: Record<
  RagStatus,
  { label: string; meaning: string; badge: string; dot: string; bar: string }
> = {
  green: {
    label: "Green",
    meaning: "On track",
    badge: "bg-rag-green-bg text-rag-green ring-rag-green/20",
    dot: "bg-rag-green",
    bar: "bg-rag-green",
  },
  amber: {
    label: "Amber",
    meaning: "At risk",
    badge: "bg-rag-amber-bg text-rag-amber ring-rag-amber/25",
    dot: "bg-rag-amber",
    bar: "bg-[#d39a3a]",
  },
  red: {
    label: "Red",
    meaning: "Off track",
    badge: "bg-rag-red-bg text-rag-red ring-rag-red/20",
    dot: "bg-rag-red",
    bar: "bg-rag-red",
  },
};

export function RagBadge({ status }: { status: RagStatus }) {
  const meta = RAG_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${meta.badge}`}
      title={meta.meaning}
    >
      <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}
