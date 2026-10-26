import { api } from '../api/axios'
export const blocksApi={list:()=>api.get('/specialists/me/blocks'),create:data=>api.post('/specialists/me/blocks',data),remove:id=>api.delete(`/specialists/me/blocks/${id}`)}
