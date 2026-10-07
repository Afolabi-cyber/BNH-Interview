"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { loginSchema } from "@/lib/validation";

export type LoginState = { error?: string; email?: string };

// Compared against when the email is unknown, so response time doesn't reveal
// which accounts exist.
const DUMMY_HASH = "$2b$10$BrHHLC4lDYeG71hu7nvIQeXgK3y9Tw73C.T3Stp5AbLOlCjhhpDq6";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  const email = String(formData.get("email") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0].message, email };

  const user = await db.query.users.findFirst({ where: eq(users.email, parsed.data.email) });
  const valid = await bcrypt.compare(parsed.data.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) return { error: "That email and password don’t match our records.", email };

  await createSession({ userId: user.id, name: user.name, role: user.role });
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
