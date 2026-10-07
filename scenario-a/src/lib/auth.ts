import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/db/schema";

const COOKIE = "bnh_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // one working day

export type Session = { userId: string; name: string; role: Role };

function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters.");
  }
  return new TextEncoder().encode(value);
}

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

/** Reads and verifies the session cookie. Memoised per request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<Session>(token, secret());
    return { userId: payload.userId, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
});

export const homeFor = (role: Role) => (role === "chief_of_staff" ? "/dashboard" : "/submit");

/** Guards a page or action: signed in, and optionally holding a given role. */
export async function requireSession(role?: Role): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (role && session.role !== role) redirect(homeFor(session.role));
  return session;
}
