import { randomBytes } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import { AdminLoginBody, AdminLoginResponse, AdminLogoutResponse, GetAdminAuthResponse } from "@workspace/api-zod";
import { adminSessionsTable, db } from "@workspace/db";
import {
  clearAdminCookie,
  createAdminSession,
  hashToken,
  isAdminRequest,
  passwordMatches,
  setAdminCookie,
} from "../lib/marrakech-auth";

const router: IRouter = Router();
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

router.post("/admin/login", async (req, res): Promise<void> => {
  const now = Date.now();
  const ip = req.ip ?? "unknown";
  const attempt = loginAttempts.get(ip);
  if (attempt && attempt.resetAt > now && attempt.count >= 10) {
    res.status(429).json({ error: "Too many sign-in attempts. Please wait before trying again." });
    return;
  }
  if (!attempt || attempt.resetAt <= now) loginAttempts.set(ip, { count: 0, resetAt: now + 10 * 60 * 1000 });

  const parsed = AdminLoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedPassword) {
    req.log.error("ADMIN_PASSWORD secret is missing");
    res.status(503).json({ error: "Presenter sign-in is not configured." });
    return;
  }
  const expectedUsername = process.env.ADMIN_USERNAME ?? "presenter";
  const usernameOk = parsed.data.username.trim().toLowerCase() === expectedUsername.toLowerCase();
  const passwordOk = passwordMatches(parsed.data.password, expectedPassword);
  const current = loginAttempts.get(ip);
  if (!usernameOk || !passwordOk) {
    loginAttempts.set(ip, {
      count: (current?.count ?? 0) + 1,
      resetAt: current?.resetAt && current.resetAt > now ? current.resetAt : now + 10 * 60 * 1000,
    });
    res.status(401).json({ error: "The username or password is incorrect." });
    return;
  }

  loginAttempts.delete(ip);
  const session = await createAdminSession();
  setAdminCookie(res, session.token);
  res.json(AdminLoginResponse.parse({ authenticated: true, username: expectedUsername }));
});

router.post("/admin/logout", async (req, res): Promise<void> => {
  const token = (req as typeof req & { signedCookies?: Record<string, unknown> }).signedCookies?.marrakech_admin;
  if (typeof token === "string") {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.tokenHash, hashToken(token)));
  }
  clearAdminCookie(res);
  res.json(AdminLogoutResponse.parse({ authenticated: false, username: null }));
});

router.get("/admin/auth", async (req, res): Promise<void> => {
  const authenticated = await isAdminRequest(req);
  res.json(
    GetAdminAuthResponse.parse({
      authenticated,
      username: authenticated ? process.env.ADMIN_USERNAME ?? "presenter" : null,
    }),
  );
});

export default router;
