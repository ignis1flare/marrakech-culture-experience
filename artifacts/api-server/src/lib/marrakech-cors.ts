function toOrigin(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const candidate = value.trim();
  try {
    return new URL(candidate.includes("://") ? candidate : `https://${candidate}`).origin;
  } catch {
    return null;
  }
}

function parseOriginsFromEnv(): Set<string> {
  const rawList = [
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.REPLIT_DEV_DOMAIN,
    ...(process.env.REPLIT_DOMAINS ?? "").split(","),
    ...(process.env.ALLOWED_ORIGINS ?? "").split(","),
    ...(process.env.NODE_ENV === "production"
      ? []
      : ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000", "http://localhost:21787"]),
  ];

  return new Set(
    rawList
      .map(toOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  );
}

export function isAllowedMarrakechOrigin(origin: string | undefined): boolean {
  if (!origin) return true; // Non-CORS or same-origin requests
  const normalized = toOrigin(origin);
  if (!normalized) return false;

  const origins = parseOriginsFromEnv();
  if (origins.has(normalized)) return true;

  // Allow any .vercel.app domain if ALLOW_VERCEL_PREVIEWS is enabled (or by default if no explicit origins)
  const isVercelHost = /^https:\/\/[a-zA-Z0-9_-]+\.vercel\.app$/.test(normalized);
  if (isVercelHost && (process.env.ALLOW_VERCEL_PREVIEWS === "true" || origins.size === 0)) {
    return true;
  }

  // Development convenience: allow localhost / 127.0.0.1 on any port in development
  if (process.env.NODE_ENV !== "production") {
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalized)) {
      return true;
    }
  }

  return false;
}

export function isSameOriginRequest(
  origin: string | undefined,
  host: string | string[] | undefined,
  protocol: string | string[] | undefined,
): boolean {
  if (!origin) return true;
  if (!host) return false;

  const hostValue = Array.isArray(host) ? host[0] : host;
  const protocolValue = Array.isArray(protocol) ? protocol[0] : protocol;
  const forwardedHost = hostValue?.split(",")[0]?.trim();
  const forwardedProtocol = protocolValue?.split(",")[0]?.trim() || "https";
  if (!forwardedHost) return false;

  try {
    return new URL(origin).origin === new URL(`${forwardedProtocol}://${forwardedHost}`).origin;
  } catch {
    return false;
  }
}
