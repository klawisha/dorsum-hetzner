import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/auth.store'
export default function ProtectedRoute({ children }) {
  const { token, ready } = useAuthStore()
  if (!ready) return null
  return token ? children : <Navigate to="/login" replace />
}
