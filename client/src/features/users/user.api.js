import { api } from "../../api/axios"

export const userApi = {
getAll: (search = "") =>
  api.get("/users", {
    params: { search }
  }),

  createClient: (data) =>
    api.post("/users/admin-create-client", data),

  createSpecialist: (data) =>
    api.post("/users/admin-create-specialist", data),

  archive: (id, reason = "") =>
    api.patch(`/users/${id}/archive`, { reason }),

  updateIdentity: (id, data) =>
    api.patch(`/users/${id}/identity`, data),

  updateSpecializations: (id, specializations) =>
  api.patch(`/users/${id}/specializations`, {
    specializations
  }),

  updateRole: (id, role) =>
    api.patch(`/users/${id}/role`, { role }),

  updateSpecialistColor: (id, color) =>
  api.patch(`/users/${id}/specialist-color`, {
    color
  }),
}
