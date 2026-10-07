"use client";

import { useActionState, useRef } from "react";
import { login, type LoginState } from "./actions";

const DEMO_ACCOUNTS = [
  { email: "cos@bnh.demo", label: "Chief of Staff", name: "Adaeze Okafor" },
  { email: "tunde@bnh.demo", label: "Portfolio Manager", name: "Tunde Bakare" },
  { email: "ngozi@bnh.demo", label: "Portfolio Manager", name: "Ngozi Eze" },
];
const DEMO_PASSWORD = "bnh-demo-2026";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const fill = (email: string) => {
    emailRef.current!.value = email;
    passwordRef.current!.value = DEMO_PASSWORD;
    passwordRef.current!.form?.requestSubmit();
  };

  return (
    <div className="w-full max-w-sm">
      <form action={action} className="space-y-5" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-ink-soft text-sm font-medium">
            Work email
          </label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email}
            required
            className="field"
            placeholder="name@bnh.com"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-ink-soft text-sm font-medium">
            Password
          </label>
          <input
            ref={passwordRef}
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="field"
          />
        </div>

        {state.error && (
          <p role="alert" className="bg-rag-red-bg text-rag-red rounded-lg px-3.5 py-2.5 text-sm">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full py-3">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="border-hairline mt-10 border-t pt-6">
        <p className="eyebrow">Demo access</p>
        <p className="text-muted mt-1 text-sm">Select an account to sign in instantly.</p>
        <ul className="mt-4 space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                disabled={pending}
                onClick={() => fill(account.email)}
                className="group border-hairline bg-surface hover:border-navy/40 flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left transition hover:shadow-(--shadow-card) disabled:opacity-60"
              >
                <span>
                  <span className="text-ink block text-sm font-medium">{account.name}</span>
                  <span className="text-muted block text-xs">{account.email}</span>
                </span>
                <span className="text-brass text-[11px] font-semibold tracking-wider uppercase">
                  {account.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-faint mt-3 text-xs">
          Password for all demo accounts: <code className="text-ink-soft font-mono">{DEMO_PASSWORD}</code>
        </p>
      </div>
    </div>
  );
}
