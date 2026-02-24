import { useMutation } from "@tanstack/react-query";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function useLogin() {
  return useMutation<TokenPair, Error, { email: string; password: string }>({
    mutationFn: async (credentials) => {
      const resp = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.error || "Login failed");
      }
      return resp.json();
    },
  });
}

export function useLogout() {
  return useMutation<void, Error, string>({
    mutationFn: async (refreshToken) => {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    },
  });
}

export function getGoogleLoginURL() {
  return `${API_URL}/api/auth/google`;
}
