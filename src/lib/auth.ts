import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "./types";
import {
  createPasswordResetToken,
  createSessionRow,
  createUserRow,
  deleteExpiredPasswordResetTokens,
  deleteSession,
  deleteSessionsForUser,
  findPasswordResetToken,
  findUserByInboundAddress,
  getPasswordHashByEmail,
  getSession,
  getUserByEmail,
  getUserById,
  markPasswordResetTokenUsed,
  seedWorkspace,
  updateUserPasswordHash,
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
const RESET_TOKEN_BYTES = 32;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

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
 * Creates a new user, mints their dedicated inbound email address,
 * populates their workspace with sample data, and issues a fresh session.
 * Throws on duplicate email or weak password.
 */
export function signup(input: SignupInput): AuthResult {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) throw new AuthError("missing_fields");
  if (input.password.length < 8) throw new AuthError("weak_password");
  if (getUserByEmail(email)) throw new AuthError("email_taken");

  const inboundAddress = mintInboundAddress(name);
  const user = createUserRow({
    email,
    name,
    passwordHash: hashPassword(input.password),
    inboundAddress,
  });
  seedWorkspace(user.id);

  const session = issueSession(user.id);
  return { user, sessionId: session.id, expiresAt: session.expiresAt };
}

/**
 * Generate a unique inbound email address for a new workspace. The local
 * part is a slug derived from the owner's name plus a short random suffix
 * so two "Sarah Nguyen"s don't collide. The domain comes from
 * `INBOUND_ADDRESS_DOMAIN` (e.g. `inbound.smbaiops.com`); in dev we fall
 * back to `inbound.local` so signup still works with zero config.
 *
 * We retry on the rare collision against an existing inboundAddress row.
 * After 5 retries we bail to an opaque `u-<8hex>@domain` form.
 */
function mintInboundAddress(ownerName: string): string {
  const domain =
    process.env.INBOUND_ADDRESS_DOMAIN?.trim().replace(/^@/, "") ||
    "inbound.local";
  const slug = slugify(ownerName) || "inbox";

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = randomBytes(3).toString("hex");
    const candidate = `${slug}-${suffix}@${domain}`;
    if (!findUserByInboundAddress(candidate)) {
      return candidate;
    }
  }
  return `u-${randomBytes(4).toString("hex")}@${domain}`;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
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

// ---------- Password reset ----------

export interface PasswordResetRequestOutput {
  // The caller-facing API always reports success to avoid leaking which
  // emails exist. In dev (no Postmark) we hand back `resetUrl` so the
  // developer can still complete the flow without an inbox.
  resetUrl?: string;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Mint a one-shot password-reset token for a user. The plaintext token is
 * only ever returned from this function — we persist a SHA-256 hash. Even
 * with read access to the DB, an attacker can't replay the email link.
 *
 * Always returns success-shaped output, even when the email isn't known,
 * so that an attacker can't use this endpoint as an account enumeration
 * oracle.
 */
export function requestPasswordReset(input: {
  email: string;
}): PasswordResetRequestOutput {
  // Opportunistic cleanup so the table doesn't grow unbounded.
  try {
    deleteExpiredPasswordResetTokens();
  } catch {
    // best-effort
  }

  const email = input.email.trim().toLowerCase();
  if (!email) return {};

  const user = getUserByEmail(email);
  if (!user) return {};

  const plaintext = randomBytes(RESET_TOKEN_BYTES).toString("base64url");
  const tokenHash = hashResetToken(plaintext);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();
  createPasswordResetToken({ userId: user.id, tokenHash, expiresAt });

  // The caller (the API route) is responsible for actually sending the
  // email. We return the URL so the route can decide whether to email
  // it (prod) or log it (dev).
  const base = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  const url = `${base.replace(/\/$/, "")}/reset?token=${encodeURIComponent(plaintext)}`;
  return { resetUrl: url };
}

/**
 * Consume a password-reset token: verify it, update the user's hash, mark
 * the token used, and revoke every existing session so an attacker with a
 * stale cookie is kicked out.
 */
export function completePasswordReset(input: {
  token: string;
  newPassword: string;
}): void {
  const token = input.token.trim();
  if (!token) throw new AuthError("invalid_token");
  if (input.newPassword.length < 8) throw new AuthError("weak_password");

  const row = findPasswordResetToken(hashResetToken(token));
  if (!row) throw new AuthError("invalid_token");
  if (row.usedAt) throw new AuthError("token_used");
  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    throw new AuthError("token_expired");
  }

  updateUserPasswordHash(row.userId, hashPassword(input.newPassword));
  markPasswordResetTokenUsed(row.id);
  deleteSessionsForUser(row.userId);
}

// ---------- Errors ----------

export class AuthError extends Error {
  code:
    | "missing_fields"
    | "weak_password"
    | "email_taken"
    | "invalid_credentials"
    | "unauthorized"
    | "invalid_token"
    | "token_expired"
    | "token_used";
  status: number;
  constructor(code: AuthError["code"]) {
    super(code);
    this.name = "AuthError";
    this.code = code;
    this.status = code === "unauthorized" ? 401 : 400;
  }
}
