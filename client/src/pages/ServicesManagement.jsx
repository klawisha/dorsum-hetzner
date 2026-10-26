import { useEffect, useMemo, useState } from 'react'
import { Plus, Save, Search, Archive, RotateCcw, Baby } from 'lucide-react'
import { api } from '../api/axios'
import './ServicesManagement.css'
const categories = ['KINESIOTHERAPY','MASSAGE','APPARATUS_MASSAGE','CONSULTATION','HOME_VISIT','MYOSTIMULATION','SHOCKWAVE','VACUUM_THERAPY','WELLNESS_FITNESS','STRENGTH_FITNESS','STRETCHING','TAPING','OTHER']
const categoryNames = {KINESIOTHERAPY:'Кинезиотерапия',MASSAGE:'Массаж',APPARATUS_MASSAGE:'Аппаратный массаж',CONSULTATION:'Консультации',HOME_VISIT:'Выезд',MYOSTIMULATION:'Миостимуляция',SHOCKWAVE:'Ударно-волновая терапия',VACUUM_THERAPY:'Вакуумная терапия',WELLNESS_FITNESS:'Оздоровительный фитнес',STRENGTH_FITNESS:'Силовой фитнес',STRETCHING:'Стретчинг',TAPING:'Тейпирование',OTHER:'Другие услуги'}
const blank = () => ({ title:'',price:'',durationMinutes:60,category:'KINESIOTHERAPY',audience:'ALL',isPackage:false,packageSessions:12,specialistPayMode:'FIXED',specialistPayPerSession:'',specialistPayPercent:'',groupAllowed:false,maxClients:2,groupPayMode:'PER_CLIENT',active:true,massageHalfHourTracking:false,massagePayClassMinutes:60,massageUseHigherOfTierAndFixed:false })
const money = v => Number(v||0).toLocaleString('ru-RU',{maximumFractionDigits:2})+' грн'
function nextMonth() {
  const current = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit'}).format(new Date())
  const [year,month] = current.split('-').map(Number)
  return new Date(Date.UTC(year,month,1)).toISOString().slice(0,7)
}
export default function ServicesManagement() {
  const [services,setServices]=useState([]), [query,setQuery]=useState(''), [showArchived,setShowArchived]=useState(false)
  const [form,setForm]=useState(null), [editing,setEditing]=useState(null), [error,setError]=useState(''), [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [loading,setLoading]=useState(true)
  const [policies,setPolicies]=useState([]), [policyOpen,setPolicyOpen]=useState(false), [policyMonth,setPolicyMonth]=useState(nextMonth)
  const [policyEnabled,setPolicyEnabled]=useState(true)
  const [tiers,setTiers]=useState([{minHalfHours:0,maxHalfHours:99,pay30:150,pay60:250,pay90:350},{minHalfHours:100,maxHalfHours:149,pay30:150,pay60:270,pay90:390},{minHalfHours:150,maxHalfHours:null,pay30:150,pay60:290,pay90:430}])
  async function load() {
    setLoading(true)
    try { const [items,rules]=await Promise.all([api.get('/services/admin'),api.get('/payroll/massage-policies')]);setServices(items.data);setPolicies(rules.data) }
    catch(e){setError(e.response?.data?.message||'Не удалось загрузить прайс.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{load()},[])
  const filtered=useMemo(()=>services.filter(s=>(showArchived||s.active)&&(!query||s.title.toLowerCase().includes(query.toLowerCase()))),[services,query,showArchived])
  const field=(key,value)=>setForm(prev=>({...prev,[key]:value}))
  function open(service,child=false) {
    setError('');setMessage('');setEditing(service?.id||null)
    setForm(service ? {...blank(),...Object.fromEntries(Object.keys(blank()).map(key=>[key,service[key]??blank()[key]]))} : {...blank(),...(child?{title:'Детский курс кинезиотерапии',audience:'CHILD',isPackage:true}: {})})
    window.scrollTo({top:0,behavior:'smooth'})
  }
  async function save(event) {
    event.preventDefault(); if(busy)return
    setBusy(true);setError('');setMessage('')
    try {
      const body={...form,price:Number(form.price),durationMinutes:Number(form.durationMinutes),packageSessions:form.isPackage?Number(form.packageSessions):null,specialistPayPerSession:Number(form.specialistPayPerSession),specialistPayPercent:Number(form.specialistPayPercent),maxClients:form.groupAllowed?Number(form.maxClients):1,massagePayClassMinutes:Number(form.massagePayClassMinutes)}
      if(editing)await api.patch('/services/'+editing,body);else await api.post('/services',body)
      setForm(null);setEditing(null);setMessage('Сохранено. Старые записи и проданные курсы сохраняют свои цены и ставки.');await load()
    }catch(e){setError(e.response?.data?.message||'Не удалось сохранить услугу.')}
    finally{setBusy(false)}
  }
  async function archive(service) {
    if(busy)return
    if(service.active&&!window.confirm('Убрать услугу из новых продаж? История и уже купленные курсы сохранятся.'))return
    setBusy(true);setError('');setMessage('')
    try { if(service.active)await api.delete('/services/'+service.id);else await api.patch('/services/'+service.id,{active:true});await load() }
    catch(e){setError(e.response?.data?.message||'Не удалось изменить услугу.')}
    finally{setBusy(false)}
  }
  async function savePolicy(event) {
    event.preventDefault();if(busy)return
    setBusy(true);setError('')
    try {
      await api.post('/payroll/massage-policies',{month:policyMonth,name:'Массажная сетка '+policyMonth,enabled:policyEnabled,tiers:tiers.map(t=>({minHalfHours:Number(t.minHalfHours),maxHalfHours:t.maxHalfHours===null||t.maxHalfHours===''?null:Number(t.maxHalfHours),pay30:Number(t.pay30),pay60:Number(t.pay60),pay90:Number(t.pay90)}))})
      setPolicyOpen(false);setMessage('Новая массажная сетка сохранена с '+policyMonth+'. Прошлые месяцы не изменены.');await load()
    }catch(e){setError(e.response?.data?.message||'Не удалось сохранить сетку.')}
    finally{setBusy(false)}
  }
  return <div className="admin-page services-page">
    <header className="services-header"><div><p className="services-eyebrow">ПРАЙС И НАЧИСЛЕНИЯ</p><h1>Услуги и выплаты</h1><p>Разовые процедуры, взрослые и детские курсы, группы и оплата специалистам.</p></div><div className="services-actions"><button onClick={()=>open(null,true)}><Baby size={18}/> Детский курс</button><button onClick={()=>open(null)}><Plus size={18}/> Добавить услугу</button></div></header>
    {error&&<div className="services-error" role="alert">{error}</div>}
    {message&&<div className="services-message" role="status">{message}</div>}
    {form&&<form className="service-editor" onSubmit={save}>
      <div className="services-section-heading"><h2>{editing?'Редактирование услуги':'Новая услуга'}</h2><button type="button" onClick={()=>setForm(null)}>Закрыть</button></div>
      <div className="service-form-grid">
        <label className="service-wide">Название<input required maxLength={200} value={form.title} onChange={e=>field('title',e.target.value)}/></label>
        <label>Категория<select value={form.category} onChange={e=>field('category',e.target.value)}>{categories.map(c=><option key={c} value={c}>{categoryNames[c]||c}</option>)}</select></label>
        <label>Для кого<select value={form.audience} onChange={e=>field('audience',e.target.value)}><option value="ALL">Все</option><option value="ADULT">Взрослые</option><option value="CHILD">Дети</option></select></label>
        <label>Тип<select value={String(form.isPackage)} onChange={e=>field('isPackage',e.target.value==='true')}><option value="false">Разовая услуга</option><option value="true">Курс</option></select></label>
        <label>{form.isPackage?'Цена всего курса, грн':'Цена за одного клиента, грн'}<input required type="number" min="0" max="100000000" step="0.01" value={form.price} onChange={e=>field('price',e.target.value)}/></label>
        <label>Длительность занятия, мин<input required type="number" min="5" max="480" step="1" value={form.durationMinutes} onChange={e=>field('durationMinutes',e.target.value)}/></label>
        {form.isPackage&&<label>Занятий в курсе<input required type="number" min="1" max="1000" value={form.packageSessions} onChange={e=>field('packageSessions',e.target.value)}/></label>}
      </div>
      <h3>Выплата специалисту за проведённое занятие</h3>
      <div className="service-form-grid">
        <label>Как рассчитывать<select value={form.specialistPayMode} onChange={e=>field('specialistPayMode',e.target.value)}><option value="FIXED">Фиксированная сумма</option><option value="PERCENT">Процент от цены после скидки</option><option value="MASSAGE_TIER">Массажная сетка по нагрузке</option></select></label>
        {form.specialistPayMode==='PERCENT'?<label>Доля специалиста, %<input required type="number" min="0" max="100" step="0.01" value={form.specialistPayPercent} onChange={e=>field('specialistPayPercent',e.target.value)}/></label>:<label>{form.specialistPayMode==='MASSAGE_TIER'?'Фиксированный минимум, грн':'Сумма за одно занятие, грн'}<input required type="number" min="0" max="100000000" step="0.01" value={form.specialistPayPerSession} onChange={e=>field('specialistPayPerSession',e.target.value)}/></label>}
        {form.specialistPayMode==='MASSAGE_TIER'&&<><label>Класс массажа<select value={form.massagePayClassMinutes} onChange={e=>field('massagePayClassMinutes',Number(e.target.value))}>{[30,60,90].map(n=><option key={n} value={n}>{n} минут</option>)}</select></label><label className="service-check"><input type="checkbox" checked={form.massageUseHigherOfTierAndFixed} onChange={e=>field('massageUseHigherOfTierAndFixed',e.target.checked)}/> Выплата не ниже фиксированного минимума</label></>}
        <label className="service-check"><input type="checkbox" checked={form.massageHalfHourTracking} onChange={e=>field('massageHalfHourTracking',e.target.checked)}/> Учитывать длительность в массажной нагрузке месяца</label>
      </div>
      <p className="service-help">{form.isPackage?'У курса сумма указана за одно занятие. Процент считается от оплаченной стоимости курса после скидки, поделённой на число занятий.':'Процент рассчитывается от цены занятия после скидки.'} Зарплата начисляется только за проведённые занятия.</p>
      <h3>Групповые занятия</h3>
      <div className="service-form-grid">
        <label className="service-check"><input type="checkbox" checked={form.groupAllowed} onChange={e=>field('groupAllowed',e.target.checked)}/> Разрешить несколько клиентов в одном сеансе</label>
        {form.groupAllowed&&<><label>Максимум участников<input required type="number" min="2" max="100" value={form.maxClients} onChange={e=>field('maxClients',e.target.value)}/></label><label>Начисление за группу<select value={form.groupPayMode} onChange={e=>field('groupPayMode',e.target.value)}><option value="PER_CLIENT">За каждого участника</option><option value="PER_SESSION" disabled={form.specialistPayMode==='PERCENT'}>Один раз за весь сеанс</option></select></label></>}
      </div>
      <p className="service-help">В группу можно добавить клиента только к той же услуге с полностью совпадающим временем. Лимит проверяется на сервере. Выплата за сеанс целиком требует фиксированной суммы или массажной сетки. Для общей выплаты ставка фиксируется по первой записи сеанса.</p>
      <label className="service-check"><input type="checkbox" checked={form.active} onChange={e=>field('active',e.target.checked)}/> Услуга доступна для новых продаж</label>
      <div className="services-actions"><button disabled={busy} type="submit"><Save size={18}/>{busy?'Сохраняем…':'Сохранить'}</button><button type="button" onClick={()=>setForm(null)}>Отмена</button></div>
    </form>}
    <div className="services-toolbar"><label><Search size={18}/><input aria-label="Поиск услуг" placeholder="Название услуги или курса" value={query} onChange={e=>setQuery(e.target.value)}/></label><label className="service-check"><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/> Показывать архив</label></div>
    {loading&&<p>Загружаем прайс…</p>}
    <div className="services-list">{filtered.map(s=><article className={'service-row '+(!s.active?'service-archived':'')} key={s.id}>
      <div><div className="service-tags"><span>{s.isPackage?'Курс · '+s.packageSessions+' занятий':'Разовая'}</span>{s.audience==='CHILD'&&<span>Детская</span>}{s.groupAllowed&&<span>Группа · до {s.maxClients}</span>}{!s.active&&<span>Архив</span>}</div><h3>{s.title}</h3><p>{s.durationMinutes} мин · {categoryNames[s.category]||s.category}</p></div>
      <div className="service-numbers"><span>Цена</span><strong>{money(s.price)}</strong><small>{s.isPackage?'за курс':'за клиента'}</small></div>
      <div className="service-numbers"><span>Специалисту</span><strong>{s.specialistPayMode==='PERCENT'?s.specialistPayPercent+'%':s.specialistPayMode==='MASSAGE_TIER'?'Массажная сетка':money(s.specialistPayPerSession)}</strong><small>{s.groupAllowed&&s.groupPayMode==='PER_SESSION'?'за весь сеанс':'за проведённое занятие клиента'}</small></div>
      <div className="services-actions"><button onClick={()=>open(s)}>Изменить</button><button disabled={busy} onClick={()=>archive(s)} title={s.active?'Убрать из прайса':'Восстановить'}>{s.active?<Archive size={17}/>:<RotateCcw size={17}/>} {s.active?'В архив':'Вернуть'}</button></div>
    </article>)}</div>
    {!loading&&!filtered.length&&<p>Услуги не найдены. Добавьте новую услугу или детский курс.</p>}
    <section className="service-editor">
      <div className="services-section-heading"><div><h2>Массажная сетка</h2><p className="service-help">Новые ставки вводятся с будущего месяца. История прошлых месяцев сохраняется.</p></div><button onClick={()=>setPolicyOpen(!policyOpen)}>Новые ставки</button></div>
      {policies.slice(0,4).map(p=><div className="policy-summary" key={p.id}><strong>{p.name}</strong><span>С {new Date(p.effectiveFrom).toLocaleDateString('ru-RU',{timeZone:'Europe/Kyiv'})} · {p.enabled?'включена':'выключена'}</span><p>{p.tiers.map(t=>t.minHalfHours+'–'+(t.maxHalfHours??'∞')+': '+t.pay30+'/'+t.pay60+'/'+t.pay90+' грн').join(' · ')}</p></div>)}
      {policyOpen&&<form onSubmit={savePolicy}><div className="service-form-grid"><label>С какого месяца<input required type="month" min={nextMonth()} value={policyMonth} onChange={e=>setPolicyMonth(e.target.value)}/></label><label className="service-check"><input type="checkbox" checked={policyEnabled} onChange={e=>setPolicyEnabled(e.target.checked)}/> Применять массажную сетку</label></div>
        <p className="service-help">Каждая строка: диапазон получасов за месяц и выплата за 30 / 60 / 90 минут.</p>
        {tiers.map((tier,i)=><div className="policy-grid" key={i}>{[['minHalfHours','От получасов'],['maxHalfHours','До (пусто = без лимита)'],['pay30','30 мин, грн'],['pay60','60 мин, грн'],['pay90','90 мин, грн']].map(([key,label])=><label key={key}>{label}<input type="number" min="0" step={key.startsWith('pay')?'0.01':'1'} value={tier[key]??''} onChange={e=>setTiers(prev=>prev.map((t,index)=>index===i?{...t,[key]:e.target.value}:t))}/></label>)}</div>)}
        <div className="services-actions"><button disabled={busy} type="submit">Сохранить сетку с нового месяца</button><button type="button" onClick={()=>setPolicyOpen(false)}>Отмена</button></div>
      </form>}
    </section>
  </div>
}
