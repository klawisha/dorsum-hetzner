import { api } from "../../api/axios"

export const clientApi = {
  getMe: () => api.get("/clients/me"),
  getList: () => api.get("/clients"),
  getAssigned: () => api.get("/clients/assigned"),
  getDetails: (id) => api.get(`/clients/${id}/details`),
  updateAdminIdentity: (id, data) => api.patch(`/clients/${id}/admin-identity`, data),
  archive: (id, reason = "") => api.patch(`/clients/${id}/archive`, { reason }),
  updateDiscountStatus: (id, data) => api.patch(`/clients/${id}/discount-status`, data),
  updateNotes: (id, notes) => api.patch(`/clients/${id}/notes`, { notes }),
  uploadCardImage: (id, payload) => api.put(`/clients/${id}/card-image`, payload),
  getCardImage: (id) => api.get(`/clients/${id}/card-image`, { responseType: "blob" }),
  deleteCardImage: (id) => api.delete(`/clients/${id}/card-image`),
}
