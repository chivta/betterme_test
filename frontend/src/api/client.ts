const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onLogout: (() => void) | null = null;

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
    const resp = await fetch(`${API_URL}/api/auth/refresh`, {
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

  let resp = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (resp.status === 401 && getStoredRefreshToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      resp = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(body.error || `Request failed: ${resp.status}`);
  }

  return resp.json();
}
