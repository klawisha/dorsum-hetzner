import { Navigate } from "react-router-dom"
import { useAuthStore } from "../store/auth.store"

export default function RoleRoute({ allowedRoles, children }) {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)

  const ready = useAuthStore(s => s.ready)
  if (!ready) return null

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(user.role)) {
    if (user.role === "CLIENT") {
      return <Navigate to="/client/profile" replace />
    }

    if (user.role === "ADMIN") {
      return <Navigate to="/admin" replace />
    }

    return <Navigate to="/login" replace />
  }

  return children
}