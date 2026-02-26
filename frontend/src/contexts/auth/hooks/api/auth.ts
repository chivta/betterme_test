import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/shared/api/client'

type TokenPair = {
  access_token: string
  refresh_token: string
  expires_in: number
}

function useLogin() {
  const { mutateAsync, isPending, error } = useMutation<TokenPair, Error, { email: string; password: string }>({
    mutationFn: (credentials) =>
      apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),
  })
  return { loginAsync: mutateAsync, isLoggingIn: isPending, loginError: error }
}

function useLogout() {
  const { mutateAsync, isPending } = useMutation<void, Error, string>({
    mutationFn: (refreshToken) =>
      apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }),
  })
  return { logoutAsync: mutateAsync, isLoggingOut: isPending }
}

function getGoogleLoginURL() {
  return '/api/auth/google'
}

export { useLogin, useLogout, getGoogleLoginURL }
export type { TokenPair }
