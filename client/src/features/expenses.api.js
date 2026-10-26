import { api } from '../api/axios'

export const expensesApi = {
  list: (month) => api.get('/expenses', { params: { month } }),
  create: (payload) => api.post('/expenses', payload),
  void: (id, reason = '') => api.post(`/expenses/${id}/void`, { reason }),
  uploadReceipt: (id, payload) => api.put(`/expenses/${id}/receipt`, payload),
  receipt: (id) => api.get(`/expenses/${id}/receipt`, { responseType: 'blob' }),
  deleteReceipt: (id) => api.delete(`/expenses/${id}/receipt`),
}
