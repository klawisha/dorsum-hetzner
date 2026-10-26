import { useEffect, useState } from 'react'
import AppointmentCalendar from "../features/appointments/AppointmentCalendar"
import { blocksApi } from '../features/blocks.api'
export default function SpecialistDashboard() {
  const [blocks,setBlocks]=useState([]),[start,setStart]=useState(''),[end,setEnd]=useState(''),[reason,setReason]=useState('')
  const load=()=>blocksApi.list().then(r=>setBlocks(r.data))
  useEffect(()=>{load()},[])
  const create=async()=>{ if(!start||!end)return; await blocksApi.create({startTime:new Date(start).toISOString(),endTime:new Date(end).toISOString(),reason}); setStart('');setEnd('');setReason('');load() }
  return <div className="admin-page"><h1>Specialist Schedule</h1>
    <div style={{background:'#17181d',color:'#fff',padding:16,borderRadius:16,marginBottom:16}}><h2>Моё отсутствие</h2><div style={{display:'flex',gap:8,flexWrap:'wrap'}}><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)}/><input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)}/><input placeholder="Причина (необязательно)" value={reason} onChange={e=>setReason(e.target.value)}/><button onClick={create}>Заблокировать время</button></div>{blocks.map(b=><div key={b.id} style={{marginTop:8}}>{new Date(b.startTime).toLocaleString()} — {new Date(b.endTime).toLocaleString()} {b.reason||''} <button onClick={async()=>{await blocksApi.remove(b.id);load()}}>Удалить</button></div>)}</div>
    <AppointmentCalendar mode="specialist" /></div>
}
