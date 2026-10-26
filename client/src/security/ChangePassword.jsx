import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/axios'
import { useAuthStore } from '../store/auth.store'
export default function ChangePassword() {
  const navigate = useNavigate()
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event) {
    event.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    try {
      if (next.length < 12 || new TextEncoder().encode(next).length > 72) throw new Error('Пароль: минимум 12 символов, не более 72 байт UTF-8.')
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next })
      useAuthStore.getState().clearSession()
      navigate('/login', { replace: true })
    } catch (e) { setError(e.response?.data?.message || e.message || 'Не удалось изменить пароль.') }
    finally { setBusy(false) }
  }
  return <div className="auth-page"><form className="auth-card auth-form" onSubmit={submit}>
    <h1>Сменить пароль</h1>
    <label>Текущий пароль<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)} /></label>
    <label>Новый пароль<input type="password" autoComplete="new-password" required minLength={12} value={next} onChange={e=>setNext(e.target.value)} /></label>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <p>После изменения пароля потребуется войти снова на всех устройствах.</p>
    <button disabled={busy}>{busy ? 'Сохраняем…' : 'Изменить пароль'}</button>
    <button type="button" onClick={()=>navigate(-1)}>Назад</button>
  </form></div>
}
