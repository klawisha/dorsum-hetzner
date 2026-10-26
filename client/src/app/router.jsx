
import { useEffect, useState } from "react"
import { BrowserRouter, Routes, Route } from "react-router-dom"

import Register from "../pages/Register"
import Login from "../pages/Login"
import AdminDashboard from "../pages/AdminDashboard"
import ClientHome from "../pages/ClientHome"

import DashboardLayout from "../layouts/DashboardLayout"
import RoleRoute from "../guards/RoleRoute"
import SpecialistDashboard from "../pages/SpecialistDashboard"
import UsersManagement from "../pages/UsersManagement"

import ClientProfile from "../pages/ClientProfile"
import CoursesManagement from "../pages/CoursesManagement"
import AdminClients from "../pages/AdminClients"
import AdminClientProfile from "../pages/AdminClientProfile"
import SpecialistClients from "../pages/SpecialistClients"
import FinancePage from "../pages/FinancePage"
import InventorySales from "../pages/InventorySales"
import ExpensesPage from "../pages/ExpensesPage"
import DorsumLoader from "../components/DorsumLoader"

import ServicesManagement from "../pages/ServicesManagement"
import ChangePassword from "../security/ChangePassword"

export default function AppRouter() {
  const [bootLoading, setBootLoading] = useState(true)

  useEffect(() => {
    const ready = () => window.setTimeout(() => setBootLoading(false), 320)
    if (document.readyState === "complete") {
      ready()
    } else {
      window.addEventListener("load", ready, { once: true })
      const safety = window.setTimeout(() => setBootLoading(false), 1800)
      return () => {
        window.removeEventListener("load", ready)
        window.clearTimeout(safety)
      }
    }
    return undefined
  }, [])

  return (
    <>
      <DorsumLoader active={bootLoading} label="Запускаем Dorsum" />
    <BrowserRouter>
      <Routes>
        <Route path="/admin/services" element={<RoleRoute allowedRoles={["ADMIN"]}><DashboardLayout><ServicesManagement /></DashboardLayout></RoleRoute>} />
        <Route path="/change-password" element={<RoleRoute allowedRoles={["ADMIN","SPECIALIST","CLIENT"]}><ChangePassword /></RoleRoute>} />
        <Route path="/register" element={<Register />} />

        <Route path="/login" element={<Login />} />

        <Route path="/" element={<ClientHome />} />
        <Route path="/client" element={<ClientHome />} />
  
        <Route
          path="/admin"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout>
                <AdminDashboard />
              </DashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/finance"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout><FinancePage /></DashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/expenses"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout><ExpensesPage /></DashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/inventory-sales"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout><InventorySales /></DashboardLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout>
                <UsersManagement />
              </DashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/courses"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout>
                <CoursesManagement />
              </DashboardLayout>
            </RoleRoute>
          }
        />
        <Route
          path="/admin/clients"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout>
                <AdminClients />
              </DashboardLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/admin/clients/:id"
          element={
            <RoleRoute allowedRoles={["ADMIN"]}>
              <DashboardLayout>
                <AdminClientProfile mode="admin" />
              </DashboardLayout>
            </RoleRoute>
          }
        />


        <Route
          path="/client/profile"
          element={
            <RoleRoute allowedRoles={["CLIENT"]}>
              <ClientProfile />
            </RoleRoute>
          }
        />

        <Route
          path="/specialist"
          element={
            <RoleRoute allowedRoles={["SPECIALIST"]}>
              <DashboardLayout>
                <SpecialistDashboard />
              </DashboardLayout>
            </RoleRoute>
          }
        />
 
        <Route
          path="/specialist/clients"
          element={
            <RoleRoute allowedRoles={["SPECIALIST"]}>
              <DashboardLayout>
                <SpecialistClients />
              </DashboardLayout>
            </RoleRoute>
          }
        />

        <Route
          path="/specialist/clients/:id"
          element={
            <RoleRoute allowedRoles={["SPECIALIST"]}>
              <DashboardLayout>
                <AdminClientProfile mode="specialist" />
              </DashboardLayout>
            </RoleRoute>
          }
        />


      </Routes>
    </BrowserRouter>
    </>
  )
}