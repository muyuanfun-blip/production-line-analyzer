import { useCallback, useMemo } from "react";

// 簡化版 useAuth - 無需登入
// 所有使用者都視為已登入的匿名用戶

export function useAuth() {
  const state = useMemo(() => ({
    user: { 
      id: 1, 
      name: "訪客用戶", 
      email: null,
      openId: "guest",
      loginMethod: "none" as const,
      lastSignedIn: new Date(),
    },
    loading: false,
    error: null,
    isAuthenticated: true,
  }), []);

  const logout = useCallback(async () => {
    // 訪客模式不需要登出
  }, []);

  return {
    ...state,
    refresh: () => {},
    logout,
  };
}
