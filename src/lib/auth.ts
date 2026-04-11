import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "./types";
import {
  createSessionRow,
  createUserRow,
  deleteSession,
  getPasswordHashByEmail,
  getSession,
  getUserByEmail,
  getUserById,
  seedWorkspace,
} from "./store";

// Small auth layer over the SQLite store. We keep everything in-house
// rather than pulling in next-auth/auth.js:
//
//   - Passwords are hashed with scrypt (stdlib, no native deps).
//   - Sessions are opaque random tokens stored in a `sessions` table and
//     mirrored into an HttpOnly cookie. No JWTs — a session can be
//     revoked by deleting its row.
//   - `getCurrentUser()` / `requireUser()` are the two call sites server
//     components and API routes use to resolve the caller.

export const SESSION_COOKIE = "smb_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SCRYPT_KEYLEN = 64;
const SALT_BYTES = 16;

// ---------- Password hashing ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_BYTES);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = scryptSync(password, salt, expected.length);
  try {
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------- Signup / login ----------

export interface SignupInput {
  email: string;
  password: string;
  name: string;
}

export interface AuthResult {
  user: User;
  sessionId: string;
  expiresAt: string;
}

/**
 * Creates a new user, populates their workspace with sample data, and
 * issues a fresh session. Throws on duplicate email or weak password.
 */
export function signup(input: SignupInput): AuthResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new AuthError("missing_fields");
  if (input.password.length < 8) throw new AuthError("weak_password");
  if (getUserByEmail(email)) throw new AuthError("email_taken");

  const user = createUserRow({
    email,
    name,
    passwordHash: hashPassword(input.password),
  });
  seedWorkspace(user.id);

  const session = issueSession(user.id);
  return { user, sessionId: session.id, expiresAt: session.expiresAt };
}

export interface LoginInput {
  email: string;
  password: string;
}

export function login(input: LoginInput): AuthResult {
  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) throw new AuthError("missing_fields");

  const user = getUserByEmail(email);
  const hash = getPasswordHashByEmail(email);
  if (!user || !hash || !verifyPassword(input.password, hash)) {
    // Intentionally vague — don't leak which half of the credential
    // pair was wrong.
    throw new AuthError("invalid_credentials");
  }

  const session = issueSession(user.id);
  return { user, sessionId: session.id, expiresAt: session.expiresAt };
}

export function logoutSession(sessionId: string): void {
  deleteSession(sessionId);
}

// ---------- Session helpers ----------

function issueSession(userId: string): {
  id: string;
  userId: string;
  expiresAt: string;
} {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  return createSessionRow({ id, userId, expiresAt });
}

/**
 * Resolve the current user from the session cookie. Returns null if the
 * caller isn't signed in, if the session was revoked, or if it's expired.
 */
export function getCurrentUser(): User | null {
  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const session = getSession(sessionId);
  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    // Best-effort cleanup; we don't throw if this fails.
    try {
      deleteSession(session.id);
    } catch {
      // ignore
    }
    return null;
  }

  const user = getUserById(session.userId);
  return user ?? null;
}

/**
 * For server components and API routes that require a signed-in user.
 * Server components get a redirect to /login; API routes should catch
 * AuthError("unauthorized") and return 401 so they don't accidentally
 * issue a redirect response to fetch() callers.
 */
export function requireUser(options: { redirectTo?: string } = {}): User {
  const user = getCurrentUser();
  if (user) return user;
  if (typeof options.redirectTo === "string") redirect(options.redirectTo);
  redirect("/login");
}

// For API routes: same idea, but throws instead of redirecting.
export function requireUserForApi(): User {
  const user = getCurrentUser();
  if (!user) throw new AuthError("unauthorized");
  return user;
}

// ---------- Errors ----------

export class AuthError extends Error {
  code:
    | "missing_fields"
    | "weak_password"
    | "email_taken"
    | "invalid_credentials"
    | "unauthorized";
  status: number;
  constructor(code: AuthError["code"]) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.status = code === "unauthorized" ? 401 : 400;
  }
}
