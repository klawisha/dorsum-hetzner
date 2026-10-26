import { api } from '../api/axios'

export const inventoryApi = {
  items: () => api.get('/inventory/items'),
  updateItem: (id, data) => api.patch(`/inventory/items/${id}`, data),
  sales: (month) => api.get('/inventory/sales', { params: { month } }),
  createSale: (data) => api.post('/inventory/sales', data),
  voidSale: (id, reason = '') => api.post(`/inventory/sales/${id}/void`, { reason }),
}
