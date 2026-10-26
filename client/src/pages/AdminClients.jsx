import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2, ChevronRight, CreditCard, Search, ShieldCheck, Pencil, Trash2, UserPlus, Users, X } from "lucide-react"
import { clientApi } from "../features/client/client.api"
import { userApi } from "../features/users/user.api"
import { formatCenterDateTime } from "../utils/centerTime"
import "./ClientRecords.css"

function discountLabel(client) {
  if (client.isMilitary && client.isPensioner) return "Военный · Пенсионер"
  if (client.isMilitary) return "Военный"
  if (client.isPensioner) return "Пенсионер"
  return null
}

function courseRemaining(course) {
  return Math.max(0, Number(course.totalLessons || 0) - Number(course.usedLessons || 0))
}

export default function AdminClients() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [createOpen, setCreateOpen] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState("")
  const [createSuccess, setCreateSuccess] = useState("")
  const [archivingId, setArchivingId] = useState("")
  const [editingId, setEditingId] = useState("")
  const [newClient, setNewClient] = useState({
    fullName: "",
    phone: "",
    password: "",
    repeatPassword: "",
    isMilitary: false,
    isPensioner: false,
    allowSharedPhone: false,
  })

  const loadClients = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await clientApi.getList()
      setClients(response.data || [])
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось загрузить клиентов")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClients()
  }, [])

  const createClient = async (event) => {
    event.preventDefault()
    if (createBusy) return

    setCreateError("")
    setCreateSuccess("")

    if (!newClient.fullName.trim()) return setCreateError("Введите ФИО")
    if (!newClient.phone.trim()) return setCreateError("Введите телефон")
    if (!newClient.allowSharedPhone && newClient.password.length < 12) {
      return setCreateError("Пароль для входа должен быть минимум 12 символов")
    }
    if (!newClient.allowSharedPhone && newClient.password !== newClient.repeatPassword) {
      return setCreateError("Пароли не совпадают")
    }

    setCreateBusy(true)
    try {
      const response = await userApi.createClient({
        fullName: newClient.fullName,
        phone: newClient.phone,
        password: newClient.password,
        isMilitary: newClient.isMilitary,
        isPensioner: newClient.isPensioner,
        allowSharedPhone: newClient.allowSharedPhone,
      })

      setCreateSuccess(`${response.data.profile.fullName} создан`)
      setNewClient({
        fullName: "",
        phone: "",
        password: "",
        repeatPassword: "",
        isMilitary: false,
        isPensioner: false,
        allowSharedPhone: false,
      })
      await loadClients()
    } catch (requestError) {
      setCreateError(requestError.response?.data?.message || "Не удалось создать клиента")
    } finally {
      setCreateBusy(false)
    }
  }

  const editClient = async (event, client) => {
    event.stopPropagation()

    const fullName = window.prompt("ФИО клиента", client.fullName || "")
    if (fullName === null) return

    const currentPhone = client.user?.phone || client.phone || ""
    const phone = window.prompt("Телефон клиента", currentPhone)
    if (phone === null) return

    setEditingId(client.id)
    setError("")
    try {
      await clientApi.updateAdminIdentity(client.id, { fullName, phone })
      await loadClients()
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось изменить данные клиента")
    } finally {
      setEditingId("")
    }
  }

  const archiveClient = async (event, client) => {
    event.stopPropagation()

    const confirmed = window.confirm(
      `Удалить клиента из активной базы?\n\n${client.fullName}\n${client.user?.phone || client.phone || ""}\n\nПрошлые занятия, курсы и финансовая история НЕ удалятся. Клиент больше не сможет войти и исчезнет из выбора для новых записей.`
    )

    if (!confirmed) return

    setArchivingId(client.id)
    setError("")

    try {
      await clientApi.archive(client.id, "Клиент удалён из активной базы администратором")
      await loadClients()
    } catch (requestError) {
      const code = requestError.response?.data?.message
      if (code === "HAS_FUTURE_APPOINTMENTS") {
        const raw = requestError.response?.data?.nextAppointmentAt
        const when = raw ? new Date(raw).toLocaleString("ru-RU") : ""
        setError(`У клиента есть будущее запланированное занятие${when ? ` (${when})` : ""}. Сначала отмените или удалите эту запись.`)
      } else {
        setError(code || "Не удалось удалить клиента из активной базы")
      }
    } finally {
      setArchivingId("")
    }
  }

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return clients

    return clients.filter((client) => {
      const phone = client.user?.phone || client.phone || ""
      return client.fullName?.toLowerCase().includes(query) || phone.includes(query)
    })
  }, [clients, search])

  const activeCourseCount = clients.reduce(
    (sum, client) => sum + (client.courses || []).filter((course) => courseRemaining(course) > 0).length,
    0,
  )

  return (
    <div className="admin-page client-records-page">
      <header className="records-header">
        <div>
          <span className="records-eyebrow">КЛИЕНТСКАЯ БАЗА</span>
          <h1>Клиенты центра</h1>
          <p>Контакты, курсы, ближайшие занятия, карточка клиента и внутренние заметки.</p>
        </div>

        <div className="records-header-actions">
          <div className="records-stats">
            <div><Users size={17} /><span>Клиентов</span><strong>{clients.length}</strong></div>
            <div><CreditCard size={17} /><span>Активных курсов</span><strong>{activeCourseCount}</strong></div>
          </div>

          <button
            type="button"
            className="records-create-client-button"
            onClick={() => {
              setCreateOpen((value) => !value)
              setCreateError("")
              setCreateSuccess("")
            }}
          >
            {createOpen ? <X size={17} /> : <UserPlus size={17} />}
            {createOpen ? "Закрыть" : "Добавить клиента"}
          </button>
        </div>
      </header>

      {createOpen && (
        <form className="records-create-client-panel" onSubmit={createClient}>
          <div className="records-create-client-heading">
            <div>
              <span className="records-eyebrow">NEW CLIENT</span>
              <h2>Новый клиент</h2>
              <p>
                Обычный клиент получает аккаунт. Для ребёнка/члена семьи можно создать отдельную карточку на общий номер без собственного входа.
              </p>
            </div>
          </div>

          {createError && <div className="records-error">{createError}</div>}
          {createSuccess && (
            <div className="admin-create-success">
              <CheckCircle2 size={17} />
              <strong>{createSuccess}</strong>
            </div>
          )}

          <div className="records-create-client-grid">
            <label>
              <span>ФИО *</span>
              <input
                value={newClient.fullName}
                onChange={(e) => setNewClient({ ...newClient, fullName: e.target.value })}
                placeholder="ФИО клиента"
                maxLength={160}
              />
            </label>

            <label>
              <span>Телефон *</span>
              <input
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                inputMode="tel"
                placeholder="+380 67 123 45 67"
              />
            </label>

            <label>
              <span>Пароль для входа {newClient.allowSharedPhone ? "— не нужен" : "*"}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newClient.password}
                disabled={newClient.allowSharedPhone}
                onChange={(e) => setNewClient({ ...newClient, password: e.target.value })}
                placeholder="Минимум 12 символов"
              />
            </label>

            <label>
              <span>Повторите пароль {newClient.allowSharedPhone ? "— не нужен" : "*"}</span>
              <input
                type="password"
                autoComplete="new-password"
                value={newClient.repeatPassword}
                disabled={newClient.allowSharedPhone}
                onChange={(e) => setNewClient({ ...newClient, repeatPassword: e.target.value })}
              />
            </label>
          </div>

          <label className="records-shared-phone-toggle">
            <input
              type="checkbox"
              checked={newClient.allowSharedPhone}
              onChange={(e) => setNewClient({
                ...newClient,
                allowSharedPhone: e.target.checked,
                password: e.target.checked ? "" : newClient.password,
                repeatPassword: e.target.checked ? "" : newClient.repeatPassword,
              })}
            />
            <span>
              <strong>Общий семейный номер</strong>
              <small>
                Создать отдельную карточку ребёнка или члена семьи на номер родителя. У этой карточки не будет собственного входа.
                Если на номер приходится несколько клиентов, клиентский вход по этому номеру блокируется.
              </small>
            </span>
          </label>

          <div className="records-create-client-checks">
            <label>
              <input
                type="checkbox"
                checked={newClient.isMilitary}
                onChange={(e) => setNewClient({ ...newClient, isMilitary: e.target.checked })}
              />
              <span>Военный</span>
            </label>
            <label>
              <input
                type="checkbox"
                checked={newClient.isPensioner}
                onChange={(e) => setNewClient({ ...newClient, isPensioner: e.target.checked })}
              />
              <span>Пенсионер</span>
            </label>
          </div>

          <button className="records-create-client-submit" type="submit" disabled={createBusy}>
            <UserPlus size={17} />
            {createBusy ? "Создаём…" : "Создать клиента"}
          </button>
        </form>
      )}

      <div className="records-toolbar">
        <Search size={18} />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Поиск по ФИО или телефону"
          aria-label="Поиск клиентов"
        />
        <span>{filteredClients.length}</span>
      </div>

      {error && <div className="records-error">{error}</div>}
      {loading && <div className="records-empty">Загрузка клиентской базы…</div>}

      {!loading && !error && (
        <div className="client-record-grid">
          {filteredClients.map((client) => {
            const phone = client.user?.phone || client.phone || "Телефон не указан"
            const activeCourses = (client.courses || []).filter((course) => courseRemaining(course) > 0)
            const nextAppointment = client.appointments?.[0]
            const category = discountLabel(client)

            return (
              <article
                className="client-record-card"
                key={client.id}
                onClick={() => navigate(`/admin/clients/${client.id}`)}
              >
                <button
                  type="button"
                  className="client-record-edit-button"
                  onClick={(event) => editClient(event, client)}
                  disabled={editingId === client.id}
                  title="Изменить ФИО или телефон"
                  aria-label={`Изменить данные клиента ${client.fullName}`}
                >
                  <Pencil size={14} />
                  <span>{editingId === client.id ? "Сохраняем…" : "Изменить"}</span>
                </button>

                <button
                  type="button"
                  className="client-record-archive-button"
                  onClick={(event) => archiveClient(event, client)}
                  disabled={archivingId === client.id}
                  title="Удалить клиента из активной базы"
                  aria-label={`Удалить клиента ${client.fullName}`}
                >
                  <Trash2 size={15} />
                  <span>{archivingId === client.id ? "Удаляем…" : "Удалить"}</span>
                </button>

                <div className="client-record-card-top">
                  <div className="client-avatar-mark" aria-hidden="true">
                    {client.fullName?.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "CL"}
                  </div>
                  <div className="client-record-identity">
                    <span>КЛИЕНТ</span>
                    <h2>{client.fullName}</h2>
                    <p>{phone}</p>
                  </div>
                  <ChevronRight className="client-record-chevron" size={20} />
                </div>

                <div className="client-record-tags">
                  {client.managedOnly && <span className="record-tag shared-phone">Ребёнок / семья · общий номер</span>}
                  {category && <span className="record-tag gold"><ShieldCheck size={13} />{category}</span>}
                  {client.cardImage && <span className="record-tag">Карточка загружена</span>}
                  {client.hasNotes && <span className="record-tag">Есть заметка</span>}
                </div>

                <div className="client-record-summary">
                  <div>
                    <span>Курсы</span>
                    <strong>{activeCourses.length}</strong>
                    <small>
                      {activeCourses[0]
                        ? `${activeCourses[0].title} · ${courseRemaining(activeCourses[0])} осталось`
                        : "Активных курсов нет"}
                    </small>
                  </div>
                  <div>
                    <span>Ближайшее занятие</span>
                    <strong className="record-next-date">
                      {nextAppointment
                        ? formatCenterDateTime(nextAppointment.startTime, "ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
                        : "—"}
                    </strong>
                    <small>{nextAppointment?.service?.title || "Не запланировано"}</small>
                  </div>
                </div>
              </article>
            )
          })}

          {filteredClients.length === 0 && (
            <div className="records-empty">По этому запросу клиентов не найдено.</div>
          )}
        </div>
      )}
    </div>
  )
}
