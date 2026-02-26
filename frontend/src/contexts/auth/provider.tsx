import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { setTokens, clearTokens, getStoredRefreshToken, setLogoutCallback } from '@/shared/api/client'
import { AuthContext } from './context'

function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredRefreshToken())

  const login = useCallback((accessToken: string, refreshToken: string) => {
    setTokens(accessToken, refreshToken)
    setIsAuthenticated(true)
  }, [])

  const logout = useCallback(() => {
    clearTokens()
    setIsAuthenticated(false)
  }, [])

  useEffect(() => {
    setLogoutCallback(logout)
  }, [logout])

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthProvider }
