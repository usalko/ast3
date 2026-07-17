const ACCESS_TOKEN_KEY = "ast3_access";
const REFRESH_TOKEN_KEY = "ast3_refresh";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const json = atob(normalized);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function isLikelyJwt(token: string): boolean {
  return token.split(".").length === 3;
}

export function clearAuthStorage(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasValidSessionStorage(): boolean {
  const access = localStorage.getItem(ACCESS_TOKEN_KEY);
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY);

  // Force re-login for old storage formats and half-migrated sessions.
  if (!access || !refresh) {
    return false;
  }

  if (!isLikelyJwt(access) || !isLikelyJwt(refresh)) {
    return false;
  }

  const payload = decodeJwtPayload(access);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (!exp) {
    return false;
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  return exp > nowInSeconds;
}
