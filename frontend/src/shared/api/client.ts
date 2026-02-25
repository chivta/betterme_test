let accessToken: string | null = null;
let refreshToken: string | null = null;
let onLogout: (() => void) | null = null;

type ErrorEnvelope = {
  error?: string;
};

async function parseErrorMessage(resp: Response): Promise<string> {
  const fallback = `Request failed: ${resp.status}`;
  const contentType = resp.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return resp.statusText || fallback;
  }

  const body = (await resp.json().catch(() => null)) as ErrorEnvelope | null;
  if (body?.error && typeof body.error === "string") {
    return body.error;
  }

  return resp.statusText || fallback;
}

export function setTokens(access: string, refresh: string) {
  accessToken = access;
  refreshToken = refresh;
  localStorage.setItem("refresh_token", refresh);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem("refresh_token");
}

export function getStoredRefreshToken(): string | null {
  return refreshToken || localStorage.getItem("refresh_token");
}

export function setLogoutCallback(cb: () => void) {
  onLogout = cb;
}

async function refreshAccessToken(): Promise<boolean> {
  const rt = getStoredRefreshToken();
  if (!rt) return false;

  try {
    const resp = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    });

    if (!resp.ok) {
      clearTokens();
      onLogout?.();
      return false;
    }

    const data = await resp.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    clearTokens();
    onLogout?.();
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  let resp = await fetch(path, { ...options, headers });

  if (resp.status === 401 && getStoredRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      resp = await fetch(path, { ...options, headers });
    }
  }

  if (!resp.ok) {
    const errorMessage = await parseErrorMessage(resp);
    throw new Error(errorMessage);
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  return resp.json();
}
