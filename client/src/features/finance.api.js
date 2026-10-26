import { api } from '../api/axios'
export const financeApi={summary:(period='day',date='')=>api.get('/finance/summary',{params:{period,date}})}
