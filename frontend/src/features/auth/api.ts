import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/shared/api/client";

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export function useLogin() {
  return useMutation<TokenPair, Error, { email: string; password: string }>({
    mutationFn: (credentials) =>
      apiFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(credentials),
      }),
  });
}

export function useLogout() {
  return useMutation<void, Error, string>({
    mutationFn: (refreshToken) =>
      apiFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
  });
}

export function getGoogleLoginURL() {
  return "/api/auth/google";
}
