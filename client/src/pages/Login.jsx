import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../features/auth/auth.api'
import { useAuthStore } from '../store/auth.store'
import '../pages/auth.css'
import PlatformFooter from "../components/PlatformFooter"

export default function Login(){
  const navigate=useNavigate(),setToken=useAuthStore(s=>s.setToken),setUser=useAuthStore(s=>s.setUser)
  const [phone,setPhone]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const handleLogin=async()=>{if(busy)return;try{setBusy(true);setError('');const res=await authApi.login({phone,password});setToken(res.data.accessToken);setUser(res.data.user);const role=res.data.user.role;navigate(role==='ADMIN'?'/admin':role==='SPECIALIST'?'/specialist':'/client/profile')}catch(err){setError(err.response?.data?.message||'Ошибка входа')}finally{setBusy(false)}}
  return <div className="auth-platform-shell"><div className="auth-page"><div className="auth-card"><p className="auth-label">Dorsum System</p><h1>Вход</h1><p className="auth-subtitle">Войдите по номеру телефона.</p>{error&&<p className="auth-error">{error}</p>}<div className="auth-form">
    <input placeholder="Телефон" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
    <input placeholder="Пароль" type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleLogin()}/>
    <button disabled={busy} onClick={handleLogin}>{busy?'Вход...':'Войти'}</button><button className="auth-secondary-button" onClick={()=>navigate('/register')}>Создать аккаунт</button>
  </div></div></div><PlatformFooter compact /></div>
}
