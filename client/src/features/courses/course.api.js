import { api } from "../../api/axios"

export const courseApi = {
  getClientCourses: (clientId) =>
    api.get(`/clients/${clientId}/courses`),

  create: (data) =>
    api.post("/courses", data),

  getAll: () =>
    api.get("/courses"),

  delete: (id) =>
    api.delete(`/courses/${id}`),

  completePayment: (id) =>
    api.patch(`/courses/${id}/complete-payment`)
}