import { createContext } from 'react'

type AuthContextValue = {
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export { AuthContext }
export type { AuthContextValue }
