/**
 * Seeds demo users, portfolios and three months of history (the latest only partly reported).
 * Run with `npm run db:seed`. Safe to re-run: it clears existing data first.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { recentMonths } from "../lib/format";
import { db } from "./index";
import { monthlyUpdates, portfolios, users, type RagStatus } from "./schema";

export const DEMO_PASSWORD = "bnh-demo-2026";

const people = [
  { key: "cos", name: "Adaeze Okafor", email: "cos@bnh.demo", role: "chief_of_staff" },
  { key: "pm1", name: "Tunde Bakare", email: "tunde@bnh.demo", role: "portfolio_manager" },
  { key: "pm2", name: "Ngozi Eze", email: "ngozi@bnh.demo", role: "portfolio_manager" },
  { key: "pm3", name: "Ibrahim Musa", email: "ibrahim@bnh.demo", role: "portfolio_manager" },
] as const;

const book = [
  { name: "Lagos Real Estate Fund I", manager: "pm1" },
  { name: "Infrastructure Debt Fund", manager: "pm1" },
  { name: "Agro-Processing Ventures", manager: "pm2" },
  { name: "Consumer Growth Equity", manager: "pm2" },
  { name: "Fintech Opportunities", manager: "pm3" },
] as const;

type Row = [cashNaira: number, rag: RagStatus, blocker: string];

// Index 0 = previous month, index 1 = the month before. The current month is
// left partly unreported so the dashboard shows outstanding submissions.
const history: Record<string, Row[]> = {
  "Lagos Real Estate Fund I": [
    [
      4_820_500_000,
      "amber",
      "Lekki Phase II title perfection delayed at Lands Registry; handover slips to Q1.",
    ],
    [5_105_000_000, "green", "None"],
  ],
  "Infrastructure Debt Fund": [
    [12_340_000_000, "green", "None — drawdown schedule on track."],
    [11_900_000_000, "green", "Awaiting final DFI co-lender sign-off on tenor extension."],
  ],
  "Agro-Processing Ventures": [
    [
      1_275_250_000,
      "red",
      "FX allocation for imported milling equipment still pending; plant commissioning blocked.",
    ],
    [1_640_000_000, "amber", "Offtake agreement with major FMCG buyer under legal review."],
  ],
  "Consumer Growth Equity": [
    [2_960_000_000, "green", "None"],
    [3_015_750_000, "amber", "CFO search for portfolio company ongoing; interim cover in place."],
  ],
  "Fintech Opportunities": [
    [880_000_000, "amber", "CBN licence variation for lead investee awaiting approval."],
    [920_400_000, "amber", "CBN licence variation for lead investee awaiting approval."],
  ],
};

const currentMonthRows: Record<string, Row> = {
  "Infrastructure Debt Fund": [12_510_000_000, "green", "None"],
  "Agro-Processing Ventures": [
    1_190_000_000,
    "red",
    "FX allocation still outstanding; escalated to CBN desk via relationship bank.",
  ],
};

async function main() {
  await db.delete(monthlyUpdates);
  await db.delete(portfolios);
  await db.delete(users);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const inserted = await db
    .insert(users)
    .values(people.map(({ name, email, role }) => ({ name, email, role, passwordHash })))
    .returning();
  const userId = (key: string) =>
    inserted.find((u) => u.email === people.find((p) => p.key === key)!.email)!.id;

  const insertedPortfolios = await db
    .insert(portfolios)
    .values(book.map((p) => ({ name: p.name, managerId: userId(p.manager) })))
    .returning();

  const [thisMonth, lastMonth, monthBefore] = recentMonths(3);
  const toUpdate = (portfolioName: string, month: string, [cash, rag, blocker]: Row) => {
    const portfolio = insertedPortfolios.find((p) => p.name === portfolioName)!;
    // Updates land a few days after month end; never later than now.
    const [y, m] = month.split("-").map(Number);
    const offsetDays = 2 + (portfolio.name.length % 5);
    const submittedAt = new Date(Math.min(Date.UTC(y, m, offsetDays, 9 + offsetDays), Date.now()));
    return {
      submittedAt,
      updatedAt: submittedAt,
      portfolioId: portfolio.id,
      reportingMonth: month,
      cashPositionKobo: cash * 100,
      ragStatus: rag,
      executionBlocker: blocker,
      submittedById: portfolio.managerId,
    };
  };

  await db
    .insert(monthlyUpdates)
    .values([
      ...Object.entries(history).flatMap(([name, [last, before]]) => [
        toUpdate(name, lastMonth, last),
        toUpdate(name, monthBefore, before),
      ]),
      ...Object.entries(currentMonthRows).map(([name, row]) => toUpdate(name, thisMonth, row)),
    ]);

  console.log(`Seeded ${inserted.length} users, ${insertedPortfolios.length} portfolios.`);
  console.log(`Demo password for all accounts: ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
