import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, adminSessionsTable, participantsTable } from "@workspace/db";

const SESSION_HOURS = 10;

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function signedCookie(req: Request, name: string): string | null {
  const value = (req as Request & { signedCookies?: Record<string, unknown> }).signedCookies?.[name];
  return typeof value === "string" ? value : null;
}

export async function isAdminRequest(req: Request): Promise<boolean> {
  const token = signedCookie(req, "marrakech_admin");
  if (!token) return false;
  const [session] = await db
    .select({ id: adminSessionsTable.id })
    .from(adminSessionsTable)
    .where(and(eq(adminSessionsTable.tokenHash, hashToken(token)), gt(adminSessionsTable.expiresAt, new Date())))
    .limit(1);
  return Boolean(session);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  void isAdminRequest(req)
    .then((authenticated) => {
      if (!authenticated) {
        res.status(401).json({ error: "Presenter sign-in required" });
        return;
      }
      next();
    })
    .catch(next);
}

export async function getParticipantRequest(req: Request, sessionCode: string) {
  const token = signedCookie(req, "marrakech_participant");
  if (!token) return null;
  const [participant] = await db
    .select()
    .from(participantsTable)
    .where(
      and(
        eq(participantsTable.sessionCode, sessionCode),
        eq(participantsTable.tokenHash, hashToken(token)),
        isNull(participantsTable.removedAt),
      ),
    )
    .limit(1);
  return participant ?? null;
}

export function issueOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function getCookieOptions(maxAge: number) {
  const isCrossSite =
    process.env.COOKIE_SAME_SITE === "none" ||
    process.env.CROSS_ORIGIN_COOKIES === "true";
  const sameSite: "none" | "lax" = isCrossSite ? "none" : "lax";
  const secure = isCrossSite || process.env.NODE_ENV === "production";

  return {
    signed: true,
    httpOnly: true,
    sameSite,
    secure,
    maxAge,
    path: "/",
  };
}

export function setAdminCookie(res: Response, token: string): void {
  res.cookie("marrakech_admin", token, getCookieOptions(SESSION_HOURS * 60 * 60 * 1000));
}

export function clearAdminCookie(res: Response): void {
  const isCrossSite =
    process.env.COOKIE_SAME_SITE === "none" ||
    process.env.CROSS_ORIGIN_COOKIES === "true";
  const sameSite: "none" | "lax" = isCrossSite ? "none" : "lax";
  const secure = isCrossSite || process.env.NODE_ENV === "production";

  res.clearCookie("marrakech_admin", {
    httpOnly: true,
    sameSite,
    secure,
    path: "/",
  });
}

export function setParticipantCookie(res: Response, token: string): void {
  res.cookie("marrakech_participant", token, getCookieOptions(12 * 60 * 60 * 1000));
}

export function passwordMatches(candidate: string, configured: string): boolean {
  const secret =
    process.env.SESSION_SECRET ||
    (process.env.NODE_ENV !== "production"
      ? "marrakech-dev-insecure-session-secret-min32"
      : undefined);
  if (!secret) throw new Error("SESSION_SECRET is required for presenter authentication");
  const salt = createHash("sha256").update(secret).digest();
  const expected = scryptSync(configured, salt, 64);
  const actual = scryptSync(candidate, salt, 64);
  return timingSafeEqual(actual, expected);
}

export async function createAdminSession() {
  const token = issueOpaqueToken();
  const id = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await db.insert(adminSessionsTable).values({
    id,
    tokenHash: hashToken(token),
    expiresAt,
  });
  return { token, expiresAt };
}
