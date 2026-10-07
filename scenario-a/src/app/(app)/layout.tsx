import Link from "next/link";
import { Wordmark } from "@/components/wordmark";
import { homeFor, requireSession } from "@/lib/auth";
import { logout } from "../login/actions";

const ROLE_LABEL = { chief_of_staff: "Chief of Staff", portfolio_manager: "Portfolio Manager" } as const;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const initials = session.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-hairline bg-paper/85 sticky top-0 z-20 border-b backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href={homeFor(session.role)} aria-label="Home">
            <Wordmark />
          </Link>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-ink text-sm leading-tight font-medium">{session.name}</p>
              <p className="text-muted text-xs leading-tight">{ROLE_LABEL[session.role]}</p>
            </div>
            <span
              aria-hidden
              className="bg-brass-soft text-brass ring-brass/25 grid size-9 place-items-center rounded-full text-xs font-semibold ring-1"
            >
              {initials}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-muted hover:bg-ink/5 hover:text-ink rounded-lg px-3 py-1.5 text-sm transition"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8 sm:py-12">{children}</main>

      <footer className="border-hairline border-t">
        <div className="text-faint mx-auto flex max-w-6xl justify-between px-5 py-5 text-xs sm:px-8">
          <span>BNH · Portfolio Pulse</span>
          <span>All figures in Nigerian Naira (NGN)</span>
        </div>
      </footer>
    </div>
  );
}
