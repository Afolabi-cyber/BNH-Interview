import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { getSession, homeFor } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="bg-navy-deep relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div
          aria-hidden
          className="bg-brass/20 pointer-events-none absolute -right-40 -bottom-40 size-[520px] rounded-full blur-3xl"
        />

        <div className="relative">
          <Wordmark inverted />
        </div>

        <div className="relative max-w-md">
          <p className="text-brass text-[11px] font-semibold tracking-[0.2em] uppercase">Monthly reporting</p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.05] font-light tracking-tight">
            Every portfolio.
            <br />
            <span className="italic">One clear view.</span>
          </h1>
          <p className="mt-6 text-[15px] leading-relaxed text-white/65">
            Portfolio Managers file a single monthly update. The Chief of Staff sees cash, status and blockers
            across the book — the moment they land.
          </p>
        </div>

        <p className="relative text-xs text-white/40">Confidential · For internal use only</p>
      </section>

      <section className="flex flex-col justify-center px-6 py-16 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <p className="eyebrow">Secure sign-in</p>
          <h2 className="mt-2 font-serif text-3xl font-normal tracking-tight">Welcome back</h2>
          <p className="text-muted mt-2 text-sm">Sign in to file or review monthly portfolio updates.</p>
          <div className="mt-8">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
