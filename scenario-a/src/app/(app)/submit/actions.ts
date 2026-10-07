"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monthlyUpdates, portfolios } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatMonth } from "@/lib/format";
import { firstErrors, monthlyUpdateSchema, type FieldErrors } from "@/lib/validation";

type Field = "portfolioId" | "reportingMonth" | "cashPosition" | "ragStatus" | "executionBlocker";

export type SubmitState =
  | { status: "idle" }
  | { status: "error"; errors: FieldErrors<Field>; values: Record<string, string> }
  | { status: "success"; message: string; submissionId: string };

export async function submitUpdate(_prev: SubmitState, formData: FormData): Promise<SubmitState> {
  const session = await requireSession("portfolio_manager");
  const values = Object.fromEntries(formData) as Record<string, string>;

  const parsed = monthlyUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return { status: "error", errors: firstErrors<Field>(parsed.error), values };
  }
  const { portfolioId, reportingMonth, cashPosition, ragStatus, executionBlocker } = parsed.data;

  // A manager may only report on portfolios they own.
  const portfolio = await db.query.portfolios.findFirst({
    where: and(eq(portfolios.id, portfolioId), eq(portfolios.managerId, session.userId)),
  });
  if (!portfolio) {
    return { status: "error", errors: { portfolioId: "You don’t manage this portfolio." }, values };
  }

  const existing = await db.query.monthlyUpdates.findFirst({
    columns: { id: true },
    where: and(
      eq(monthlyUpdates.portfolioId, portfolioId),
      eq(monthlyUpdates.reportingMonth, reportingMonth),
    ),
  });

  const fields = {
    cashPositionKobo: cashPosition,
    ragStatus,
    executionBlocker,
    submittedById: session.userId,
  };
  const [saved] = await db
    .insert(monthlyUpdates)
    .values({ portfolioId, reportingMonth, ...fields })
    .onConflictDoUpdate({
      target: [monthlyUpdates.portfolioId, monthlyUpdates.reportingMonth],
      set: { ...fields, updatedAt: sql`(unixepoch())` },
    })
    .returning({ id: monthlyUpdates.id });

  revalidatePath("/dashboard");
  revalidatePath("/submit");

  const verb = existing ? "amended" : "submitted";
  return {
    status: "success",
    message: `${portfolio.name} — ${formatMonth(reportingMonth)} update ${verb}.`,
    submissionId: `${saved.id}:${Date.now()}`,
  };
}
