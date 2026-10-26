import { useNavigate, useLocation } from "react-router-dom"
import { useAuthStore } from "../store/auth.store"
import { useState } from "react"
import PlatformFooter from "../components/PlatformFooter"

export default function DashboardLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()

  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  const [sidebarOpen, setSidebarOpen] = useState(false)


  const isActive = (path) =>
    location.pathname === path



  return (
  <div className="admin-shell">

      <button
      className="admin-mobile-menu-toggle"
      onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>   

    <aside className={`admin-sidebar ${sidebarOpen ? "open" : ""}`}>
      <button
        className="admin-mobile-close"
        onClick={() => setSidebarOpen(false)}
      >
        ×
      </button>
      
      <div className="admin-logo">Dorsum</div>

      <p className="admin-user">{user?.phone || user?.email || "—"}</p>
      <p className="admin-role">{user?.role}</p>

      {user?.role === "ADMIN" && (
        <>
          <button
            className={`admin-menu-button ${isActive("/admin") ? "active" : ""}`}
            onClick={() => {
              navigate("/admin")
              setSidebarOpen(false)
            }}
          >
            Dashboard
          </button>

          <button
            className={`admin-menu-button ${isActive("/admin/finance") ? "active" : ""}`}
            onClick={() => { navigate("/admin/finance"); setSidebarOpen(false) }}
          >
            Finance
          </button>

          <button
            className={`admin-menu-button ${isActive("/admin/expenses") ? "active" : ""}`}
            onClick={() => { navigate("/admin/expenses"); setSidebarOpen(false) }}
          >
            Expenses
          </button>

          <button
            className={`admin-menu-button ${isActive("/admin/inventory-sales") ? "active" : ""}`}
            onClick={() => { navigate("/admin/inventory-sales"); setSidebarOpen(false) }}
          >
            Sell inventory
          </button>
<button
            className={`admin-menu-button ${location.pathname.startsWith("/admin/clients") ? "active" : ""}`}
            onClick={() => {
              navigate("/admin/clients")
              setSidebarOpen(false)
            }}
          >
            Clients
          </button>

          <button
            className={`admin-menu-button ${isActive("/admin/courses") ? "active" : ""}`}
            onClick={() => {
              navigate("/admin/courses")
              setSidebarOpen(false)
            }}
          >
            Courses
          </button>

          <button className={`admin-menu-button ${isActive('/admin/services')?'active':''}`} onClick={()=>{navigate('/admin/services');setSidebarOpen(false)}}>Прайс / Выплаты</button>
          <button
            className={`admin-menu-button ${isActive("/admin/users") ? "active" : ""}`}
            onClick={() => {
              navigate("/admin/users")
              setSidebarOpen(false)
            }}
          >
            Staff / Roles
          </button>
        </>
      )}

      {user?.role === "SPECIALIST" && (
        <>
          <button
            className={`admin-menu-button ${isActive("/specialist") ? "active" : ""}`}
            onClick={() => {
              navigate("/specialist")
              setSidebarOpen(false)
            }}
          >
            My Schedule
          </button>

          <button
            className={`admin-menu-button ${location.pathname.startsWith("/specialist/clients") ? "active" : ""}`}
            onClick={() => {
              navigate("/specialist/clients")
              setSidebarOpen(false)
            }}
          >
            Clients
          </button>
        </>
      )}

      <button className="admin-menu-button" onClick={() => navigate("/change-password")}>Сменить пароль</button>
      <button
        className="admin-menu-button"
        onClick={async () => {
          await logout()
          navigate("/login")
          setSidebarOpen(false)
        }}
      >
        Logout
      </button>
    </aside>

    <main className="admin-content">
      <div className="admin-content-body">{children}</div>
      <PlatformFooter />
    </main>
  </div>
  

)
}