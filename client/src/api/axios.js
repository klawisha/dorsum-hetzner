import axios from 'axios'
import { useAuthStore } from '../store/auth.store'
const baseURL = import.meta.env.VITE_API_URL || '/api'
export const api = axios.create({ baseURL, withCredentials: true, timeout: 20000, headers: { 'X-Dorsum-CSRF': '1' } })
const refreshClient = axios.create({ baseURL, withCredentials: true, timeout: 15000, headers: { 'X-Dorsum-CSRF': '1' } })
let refreshPromise = null, initPromise = null

async function refreshSession() {
  if (!refreshPromise) {
    const perform = async () => {
      const { data } = await refreshClient.post('/auth/refresh', {})
      useAuthStore.getState().setSession(data.user, data.accessToken)
      return data.accessToken
    }
    // Avoid simultaneous rotation by tabs in the same browser.
    refreshPromise = (navigator.locks ? navigator.locks.request('dorsum-refresh', perform) : perform())
      .finally(() => { refreshPromise = null })
  }
  return refreshPromise
}
export function initializeSession() {
  if (!initPromise) initPromise = refreshSession().catch(() => useAuthStore.getState().clearSession())
  return initPromise
}
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = 'Bearer ' + token
  return config
})
api.interceptors.response.use(response => response, async error => {
  const original = error.config
  if (!original || error.response?.status !== 401 || original._retry || original.url?.startsWith('/auth/')) return Promise.reject(error)
  original._retry = true
  try {
    original.headers.Authorization = 'Bearer ' + await refreshSession()
    return api(original)
  } catch (refreshError) {
    useAuthStore.getState().clearSession()
    if (!['/login','/register','/'].includes(window.location.pathname)) window.location.assign('/login')
    return Promise.reject(refreshError)
  }
})
