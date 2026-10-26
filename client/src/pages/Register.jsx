import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../features/auth/auth.api'
import '../pages/auth.css'
import PlatformFooter from "../components/PlatformFooter"

export default function Register(){
  const navigate=useNavigate()
  const [fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[password,setPassword]=useState(''),[repeatPassword,setRepeatPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const handleRegister=async()=>{
    if(busy)return
    try{setBusy(true);setError('')
      if(!fullName.trim())throw new Error('Введите ФИО')
      if(!phone.trim())throw new Error('Введите телефон')
      if(password.length<12)throw new Error('Пароль должен быть минимум 12 символов')
      if(password!==repeatPassword)throw new Error('Пароли не совпадают')
      await authApi.register({fullName,phone,password}); navigate('/login')
    }catch(err){setError(err.response?.data?.message||err.message||'Ошибка регистрации')}finally{setBusy(false)}
  }
  return <div className="auth-platform-shell"><div className="auth-page"><div className="auth-card"><p className="auth-label">Dorsum Client Portal</p><h1>Регистрация</h1><p className="auth-subtitle">Создайте аккаунт по номеру телефона. Email не требуется.</p>
    {error&&<p className="auth-error">{error}</p>}<div className="auth-form">
      <input placeholder="ФИО" value={fullName} onChange={e=>setFullName(e.target.value)}/>
      <input placeholder="Телефон, например +380 67 123 45 67" inputMode="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)}/>
      <input placeholder="Пароль" type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
      <input placeholder="Повторите пароль" type="password" autoComplete="new-password" value={repeatPassword} onChange={e=>setRepeatPassword(e.target.value)}/>
      <button disabled={busy} onClick={handleRegister}>{busy?'Регистрация...':'Зарегистрироваться'}</button>
      <button className="auth-secondary-button" onClick={()=>navigate('/login')}>Уже есть аккаунт</button>
    </div></div></div><PlatformFooter compact /></div>
}
