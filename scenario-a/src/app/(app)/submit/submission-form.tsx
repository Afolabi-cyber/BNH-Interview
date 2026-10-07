"use client";

import { useActionState, useState } from "react";
import { RAG_META } from "@/components/rag-badge";
import { RAG_STATUSES } from "@/db/schema";
import { submitUpdate, type SubmitState } from "./actions";

type Props = {
  portfolios: { id: string; name: string }[];
  months: { value: string; label: string }[];
  /** "portfolioId:YYYY-MM" pairs that already have an update on file. */
  filed: string[];
};

const BLOCKER_LIMIT = 600;

export function SubmissionForm(props: Props) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitUpdate, { status: "idle" });

  return (
    <div>
      {state.status === "success" && (
        <div
          role="status"
          className="border-rag-green/20 bg-rag-green-bg text-rag-green mb-6 flex items-start gap-3 rounded-xl border px-4 py-3.5 text-sm"
        >
          <CheckIcon />
          <div>
            <p className="font-semibold">Update received</p>
            <p className="text-rag-green/90 mt-0.5">
              {state.message} The Chief of Staff’s dashboard is up to date.
            </p>
          </div>
        </div>
      )}
      {/* Remount on each success so the form returns to a clean slate. */}
      <Fields
        key={state.status === "success" ? state.submissionId : "form"}
        {...props}
        state={state}
        action={action}
        pending={pending}
      />
    </div>
  );
}

function Fields({
  portfolios,
  months,
  filed,
  state,
  action,
  pending,
}: Props & { state: SubmitState; action: (fd: FormData) => void; pending: boolean }) {
  const errors = state.status === "error" ? state.errors : {};
  const values = state.status === "error" ? state.values : {};

  // Default to the current month and the first portfolio still due for it.
  const [month, setMonth] = useState(values.reportingMonth ?? months[0]?.value ?? "");
  const [portfolioId, setPortfolioId] = useState(
    values.portfolioId ??
      (portfolios.find((p) => !filed.includes(`${p.id}:${month}`)) ?? portfolios[0])?.id ??
      "",
  );
  const [blockerLength, setBlockerLength] = useState(values.executionBlocker?.length ?? 0);
  const isAmendment = filed.includes(`${portfolioId}:${month}`);

  return (
    <form action={action} noValidate className="space-y-7">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Portfolio" htmlFor="portfolioId" error={errors.portfolioId}>
          <select
            id="portfolioId"
            name="portfolioId"
            value={portfolioId}
            onChange={(e) => setPortfolioId(e.target.value)}
            aria-invalid={!!errors.portfolioId}
            className="field appearance-none bg-[url(/chevron.svg)] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10"
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Reporting month" htmlFor="reportingMonth" error={errors.reportingMonth}>
          <select
            id="reportingMonth"
            name="reportingMonth"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-invalid={!!errors.reportingMonth}
            className="field appearance-none bg-[url(/chevron.svg)] bg-[length:16px] bg-[right_0.85rem_center] bg-no-repeat pr-10"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {isAmendment && (
        <p className="bg-brass-soft text-ink-soft -mt-2 flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm">
          <span className="bg-brass size-1.5 shrink-0 rounded-full" aria-hidden />
          An update for this month is already on file. Submitting will amend it.
        </p>
      )}

      <Field
        label="Cash position"
        hint="Closing balance at month end, in Nigerian Naira."
        htmlFor="cashPosition"
        error={errors.cashPosition}
      >
        <div className="relative">
          <span className="text-muted pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[15px]">
            ₦
          </span>
          <input
            id="cashPosition"
            name="cashPosition"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            defaultValue={values.cashPosition}
            aria-invalid={!!errors.cashPosition}
            onChange={(e) => (e.target.value = groupThousands(e.target.value))}
            className="field num pl-8 text-right font-medium sm:max-w-xs"
          />
        </div>
      </Field>

      <fieldset>
        <legend className="text-ink-soft text-sm font-medium">RAG status</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {RAG_STATUSES.map((status) => {
            const meta = RAG_META[status];
            return (
              <label
                key={status}
                className="group border-hairline-strong bg-surface hover:border-ink-soft/40 has-checked:border-navy has-checked:ring-navy/10 has-focus-visible:ring-navy/20 relative flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition has-checked:ring-4 has-focus-visible:ring-4"
              >
                <input
                  type="radio"
                  name="ragStatus"
                  value={status}
                  defaultChecked={values.ragStatus === status}
                  className="sr-only"
                />
                <span
                  className={`size-3 shrink-0 rounded-full ${meta.dot} ring-4 ring-transparent`}
                  aria-hidden
                />
                <span className="leading-tight">
                  <span className="text-ink block text-sm font-semibold">{meta.label}</span>
                  <span className="text-muted block text-xs">{meta.meaning}</span>
                </span>
                <span
                  aria-hidden
                  className="border-hairline-strong group-has-checked:border-navy group-has-checked:bg-navy ml-auto grid size-4 place-items-center rounded-full border"
                >
                  <span className="size-1.5 rounded-full bg-white opacity-0 group-has-checked:opacity-100" />
                </span>
              </label>
            );
          })}
        </div>
        {errors.ragStatus && <ErrorText>{errors.ragStatus}</ErrorText>}
      </fieldset>

      <Field
        label="Execution blocker"
        hint="The single biggest obstacle to execution this month. Write “None” if there isn’t one."
        htmlFor="executionBlocker"
        error={errors.executionBlocker}
      >
        <textarea
          id="executionBlocker"
          name="executionBlocker"
          rows={4}
          maxLength={BLOCKER_LIMIT}
          defaultValue={values.executionBlocker}
          aria-invalid={!!errors.executionBlocker}
          onChange={(e) => setBlockerLength(e.target.value.length)}
          className="field resize-none leading-relaxed"
          placeholder="e.g. FX allocation for imported equipment still pending; commissioning blocked."
        />
        <p className="num text-faint mt-1.5 text-right text-xs">
          {blockerLength} / {BLOCKER_LIMIT}
        </p>
      </Field>

      <div className="border-hairline flex flex-col-reverse items-stretch justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center">
        <p className="text-muted text-xs">Visible to the Chief of Staff immediately on submission.</p>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Submitting…" : isAmendment ? "Amend update" : "Submit update"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  htmlFor,
  error,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-ink-soft text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-muted mt-0.5 text-xs">{hint}</p>}
      <div className="mt-2">{children}</div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-rag-red mt-1.5 text-sm">
      {children}
    </p>
  );
}

/** "12500000.5" -> "12,500,000.5", preserving a trailing decimal point while typing. */
function groupThousands(raw: string) {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  const grouped = whole.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return rest.length ? `${grouped}.${rest.join("").slice(0, 2)}` : grouped;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="mt-0.5 size-4 shrink-0" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-8 8a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L8 12.6l7.3-7.3a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
