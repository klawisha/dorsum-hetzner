import { create } from 'zustand'
import { api } from '../api/axios'
for (const key of ['accessToken', 'refreshToken', 'user']) {
  try { localStorage.removeItem(key) } catch { /* Storage can be disabled in private mode. */ }
}
export const useAuthStore = create(set => ({
  user: null, token: null, ready: false,
  setUser: user => set({ user }), setToken: token => set({ token }),
  setSession: (user, token) => set({ user, token, ready: true }),
  clearSession: () => set({ user: null, token: null, ready: true }),
  logout: async () => {
    try { await api.post('/auth/logout', {}); set({ user: null, token: null, ready: true }) }
    catch { window.alert('Не удалось завершить сессию. Проверьте соединение и повторите выход.'); throw new Error('Logout failed') }
  },
}))
