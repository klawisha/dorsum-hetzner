import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronRight, Search, Users } from "lucide-react"
import { clientApi } from "../features/client/client.api"
import { formatCenterDateTime } from "../utils/centerTime"
import "./ClientRecords.css"

export default function SpecialistClients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    clientApi.getAssigned()
      .then((response) => setClients(response.data || []))
      .catch((requestError) => setError(requestError.response?.data?.message || "Не удалось загрузить клиентов"))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients
    return clients.filter((client) => {
      const phone = client.user?.phone || client.phone || ""
      return client.fullName?.toLowerCase().includes(query) || phone.includes(query)
    })
  }, [clients, search])

  return (
    <div className="admin-page client-records-page">
      <header className="records-header">
        <div>
          <span className="records-eyebrow">МОИ КЛИЕНТЫ</span>
          <h1>Клиентские карточки</h1>
          <p>Только клиенты, с которыми у вас есть или были занятия. Данные доступны в режиме просмотра.</p>
        </div>
        <div className="records-stats single"><div><Users size={17} /><span>Клиентов</span><strong>{clients.length}</strong></div></div>
      </header>

      <div className="records-toolbar">
        <Search size={18} />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск клиента" />
        <span>{filtered.length}</span>
      </div>

      {error && <div className="records-error">{error}</div>}
      {loading && <div className="records-empty">Загрузка…</div>}

      {!loading && !error && (
        <div className="client-record-grid">
          {filtered.map((client) => {
            const nextAppointment = client.appointments?.[0]
            return (
              <article className="client-record-card specialist-card" key={client.id} onClick={() => navigate(`/specialist/clients/${client.id}`)}>
                <div className="client-record-card-top">
                  <div className="client-avatar-mark">{client.fullName?.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "CL"}</div>
                  <div className="client-record-identity">
                    <span>КЛИЕНТ</span>
                    <h2>{client.fullName}</h2>
                    <p>{client.user?.phone || client.phone || "Телефон не указан"}</p>
                  </div>
                  <ChevronRight className="client-record-chevron" size={20} />
                </div>
                <div className="client-record-tags">
                  {client.cardImage && <span className="record-tag">Карточка доступна</span>}
                  {client.hasNotes && <span className="record-tag gold">Есть информация администратора</span>}
                </div>
                <div className="client-record-summary one-column">
                  <div>
                    <span>Ближайшее занятие</span>
                    <strong className="record-next-date">{nextAppointment ? formatCenterDateTime(nextAppointment.startTime, "ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"}</strong>
                    <small>{nextAppointment?.service?.title || "Не запланировано"}</small>
                  </div>
                </div>
              </article>
            )
          })}
          {filtered.length === 0 && <div className="records-empty">Клиенты не найдены.</div>}
        </div>
      )}
    </div>
  )
}
