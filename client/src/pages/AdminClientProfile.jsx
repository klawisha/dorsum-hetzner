import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  ArrowLeft,
  CalendarDays,
  Check,
  ExternalLink,
  FileImage,
  LockKeyhole,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react"
import { clientApi } from "../features/client/client.api"
import { formatCenterDateTime } from "../utils/centerTime"
import "./ClientRecords.css"

const MAX_CARD_BYTES = 5 * 1024 * 1024
const ALLOWED_CARD_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "")
    reader.onerror = () => reject(reader.error || new Error("Не удалось прочитать файл"))
    reader.readAsDataURL(file)
  })
}

function money(value) {
  return `${Number(value || 0).toFixed(0)} грн`
}

function courseRemaining(course) {
  return Math.max(0, Number(course.totalLessons || 0) - Number(course.usedLessons || 0))
}

function appointmentStatusLabel(appointment) {
  if (appointment.status === "COMPLETED") return "Проведено"
  if (appointment.status === "CANCELLED") return "Отменено"
  if (appointment.status === "NOT_COMPLETED") return "Не проведено"
  return "Запланировано"
}

function paymentLabel(appointment) {
  return appointment.paymentStatus === "PAID" ? "Оплачено" : "Не оплачено"
}

export default function AdminClientProfile({ mode = "admin" }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const isAdmin = mode === "admin"

  const [client, setClient] = useState(null)
  const [notesDraft, setNotesDraft] = useState("")
  const [cardUrl, setCardUrl] = useState("")
  const [cardOpen, setCardOpen] = useState(false)
  const [savingFlags, setSavingFlags] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [uploadingCard, setUploadingCard] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  async function loadClient() {
    const response = await clientApi.getDetails(id)
    setClient(response.data)
    setNotesDraft(response.data?.notes || "")
    return response.data
  }

  async function loadCardImage(hasCard = client?.cardImage) {
    if (!hasCard) {
      setCardUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return ""
      })
      return
    }

    try {
      const response = await clientApi.getCardImage(id)
      const nextUrl = URL.createObjectURL(response.data)
      setCardUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return nextUrl
      })
    } catch {
      setCardUrl("")
    }
  }

  useEffect(() => {
    let mounted = true

    loadClient()
      .then((data) => {
        if (mounted && data?.cardImage) loadCardImage(data.cardImage)
      })
      .catch((requestError) => {
        if (mounted) setError(requestError.response?.data?.message || "Не удалось загрузить профиль клиента")
      })

    return () => {
      mounted = false
      setCardUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous)
        return ""
      })
    }
  }, [id])

  const planned = useMemo(
    () => (client?.appointments || []).filter((appointment) => appointment.status === "SCHEDULED"),
    [client],
  )

  const history = useMemo(
    () => (client?.appointments || []).filter((appointment) => appointment.status !== "SCHEDULED"),
    [client],
  )

  async function saveFlags(next) {
    setSavingFlags(true)
    setError("")
    try {
      await clientApi.updateDiscountStatus(id, next)
      await loadClient()
      setNotice("Категории клиента обновлены")
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось сохранить категории")
    } finally {
      setSavingFlags(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    setError("")
    try {
      await clientApi.updateNotes(id, notesDraft)
      await loadClient()
      setNotice("Дополнительная информация сохранена")
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось сохранить информацию")
    } finally {
      setSavingNotes(false)
    }
  }

  async function handleCardFile(file) {
    if (!file) return
    setError("")
    setNotice("")

    if (!ALLOWED_CARD_TYPES.has(file.type)) {
      setError("Карточка должна быть в формате JPEG, PNG или WebP")
      return
    }

    if (file.size > MAX_CARD_BYTES) {
      setError("Размер изображения карточки не должен превышать 5 МБ")
      return
    }

    setUploadingCard(true)
    try {
      const dataBase64 = await fileToBase64(file)
      await clientApi.uploadCardImage(id, {
        fileName: file.name,
        mimeType: file.type,
        dataBase64,
      })
      const data = await loadClient()
      await loadCardImage(data?.cardImage)
      setNotice("Карточка клиента загружена")
    } catch (requestError) {
      const code = requestError.response?.data?.message
      const message = {
        CARD_IMAGE_TOO_LARGE: "Файл слишком большой. Максимум — 5 МБ.",
        UNSUPPORTED_CARD_IMAGE_TYPE: "Поддерживаются только JPEG, PNG и WebP.",
        CARD_IMAGE_SIGNATURE_MISMATCH: "Содержимое файла не соответствует формату изображения.",
      }[code]
      setError(message || code || "Не удалось загрузить карточку")
    } finally {
      setUploadingCard(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function deleteCard() {
    if (!window.confirm("Удалить изображение карточки клиента?")) return

    setUploadingCard(true)
    try {
      await clientApi.deleteCardImage(id)
      await loadClient()
      await loadCardImage(false)
      setNotice("Карточка удалена")
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось удалить карточку")
    } finally {
      setUploadingCard(false)
    }
  }

  if (!client) {
    return <div className="admin-page records-empty">{error || "Загрузка профиля…"}</div>
  }

  const phone = client.user?.phone || client.phone || "Не указан"
  const initials = client.fullName?.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") || "CL"

  return (
    <div className="admin-page client-profile-page">
      <button
        className="profile-back-button"
        onClick={() => navigate(isAdmin ? "/admin/clients" : "/specialist/clients")}
      >
        <ArrowLeft size={17} /> Назад к клиентам
      </button>

      <header className="client-profile-hero">
        <div className="client-profile-avatar">{initials}</div>
        <div className="client-profile-title">
          <span>{isAdmin ? "КАРТОЧКА КЛИЕНТА / ADMIN" : "КАРТОЧКА КЛИЕНТА / ПРОСМОТР"}</span>
          <h1>{client.fullName}</h1>
          <div className="client-profile-contact"><Phone size={15} />{phone}</div>
        </div>
        <div className="client-profile-badges">
          {client.isMilitary && <span><ShieldCheck size={14} />Военный</span>}
          {client.isPensioner && <span><ShieldCheck size={14} />Пенсионер</span>}
          {!client.isMilitary && !client.isPensioner && <span className="muted">Без льготной категории</span>}
        </div>
      </header>

      {(error || notice) && (
        <div className={error ? "records-error" : "records-notice"}>{error || notice}</div>
      )}

      <div className="client-profile-layout">
        <main className="client-profile-main">
          <section className="record-section">
            <div className="record-section-heading">
              <div><span>01</span><div><h2>Курсы</h2><p>Активные пакеты и остаток занятий.</p></div></div>
              <strong>{client.courses.length}</strong>
            </div>

            <div className="profile-course-grid">
              {client.courses.map((course) => {
                const remaining = courseRemaining(course)
                const total = Math.max(1, Number(course.totalLessons || 1))
                const used = Math.min(total, Number(course.usedLessons || 0))
                const progress = Math.round((used / total) * 100)

                return (
                  <article className="profile-course-card" key={course.id}>
                    <div>
                      <span>КУРС</span>
                      <strong>{remaining}</strong>
                    </div>
                    <div className="profile-course-title-row">
                      <h3>{course.title}</h3>
                      {course.paymentState === "HALF_PAID" && (
                        <span className="profile-course-half-badge">ОПЛАЧЕНО 1/2</span>
                      )}
                      {course.paymentState === "PAID" && (
                        <span className="profile-course-paid-badge">ОПЛАЧЕНО</span>
                      )}
                    </div>
                    <p>{used}/{total} использовано · {remaining} осталось</p>
                    {course.paymentState === "HALF_PAID" && (
                      <p className="profile-course-payment-limit">
                        До доплаты доступно {Math.ceil(total / 2)} занятий.
                        {used >= Math.ceil(total / 2) ? " Следующая запись заблокирована." : ""}
                      </p>
                    )}
                    <div className="profile-course-progress"><i style={{ width: `${progress}%` }} /></div>
                    <footer><span>{money(course.price)}</span>{course.discountPercent > 0 && <b>−{course.discountPercent}%</b>}</footer>
                  </article>
                )
              })}
              {client.courses.length === 0 && <div className="records-empty compact">У клиента пока нет курсов.</div>}
            </div>
          </section>

          <section className="record-section">
            <div className="record-section-heading">
              <div><span>02</span><div><h2>Запланированные занятия</h2><p>Ближайшие визиты клиента.</p></div></div>
              <strong>{planned.length}</strong>
            </div>
            <div className="profile-appointment-list">
              {planned.map((appointment) => (
                <article className="profile-appointment-row" key={appointment.id}>
                  <div className="appointment-date-block">
                    <CalendarDays size={16} />
                    <strong>{formatCenterDateTime(appointment.startTime, "ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</strong>
                  </div>
                  <div className="appointment-main-copy"><strong>{appointment.service.title}</strong><span>{appointment.specialist.fullName}</span></div>
                  <div className={`appointment-payment ${appointment.paymentStatus === "PAID" ? "paid" : ""}`}>
                    {appointment.paymentStatus === "PAID" ? <Check size={13} /> : null}{paymentLabel(appointment)}
                  </div>
                </article>
              ))}
              {planned.length === 0 && <div className="records-empty compact">Запланированных занятий нет.</div>}
            </div>
          </section>

          <section className="record-section">
            <div className="record-section-heading">
              <div><span>03</span><div><h2>История занятий</h2><p>Проведённые, отменённые и не проведённые записи.</p></div></div>
              <strong>{history.length}</strong>
            </div>
            <div className="profile-appointment-list">
              {history.map((appointment) => (
                <article className={`profile-appointment-row history ${appointment.status.toLowerCase()}`} key={appointment.id}>
                  <div className="appointment-date-block"><strong>{formatCenterDateTime(appointment.startTime, "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</strong></div>
                  <div className="appointment-main-copy"><strong>{appointment.service.title}</strong><span>{appointment.specialist.fullName}</span></div>
                  <div className="appointment-history-status"><span>{appointmentStatusLabel(appointment)}</span><small>{paymentLabel(appointment)}</small></div>
                </article>
              ))}
              {history.length === 0 && <div className="records-empty compact">История пока пустая.</div>}
            </div>
          </section>
        </main>

        <aside className="client-profile-side">
          <section className="profile-side-card client-card-image-panel">
            <div className="side-card-heading"><FileImage size={18} /><div><span>КАРТОЧКА КЛИЕНТА</span><h2>Фото / скан</h2></div></div>

            {cardUrl ? (
              <button className="client-card-preview" onClick={() => setCardOpen(true)} title="Открыть карточку">
                <img src={cardUrl} alt={`Карточка клиента ${client.fullName}`} />
                <span><ExternalLink size={15} />Открыть полностью</span>
              </button>
            ) : (
              <div className="client-card-placeholder"><FileImage size={30} /><strong>Карточка не загружена</strong><p>Достаточно одной стороны карточки клиента.</p></div>
            )}

            {client.cardImage && (
              <div className="client-card-meta">
                <span>{client.cardImage.fileName}</span>
                <small>{Math.max(1, Math.round(client.cardImage.byteSize / 1024))} КБ · {client.cardImage.mimeType.replace("image/", "").toUpperCase()}</small>
              </div>
            )}

            {isAdmin ? (
              <div className="client-card-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(event) => handleCardFile(event.target.files?.[0])}
                />
                <button onClick={() => fileInputRef.current?.click()} disabled={uploadingCard}>
                  <Upload size={16} />{client.cardImage ? "Заменить" : "Загрузить"}
                </button>
                {client.cardImage && <button className="danger-outline" onClick={deleteCard} disabled={uploadingCard}><Trash2 size={16} />Удалить</button>}
              </div>
            ) : (
              <div className="profile-readonly-hint"><LockKeyhole size={14} />Карточка доступна только для просмотра.</div>
            )}
            <p className="client-card-security-note">JPEG / PNG / WebP · до 5 МБ.</p>
          </section>

          <section className="profile-side-card">
            <div className="side-card-heading"><UserRound size={18} /><div><span>ДОПОЛНИТЕЛЬНАЯ ИНФОРМАЦИЯ</span><h2>Заметка о клиенте</h2></div></div>

            {isAdmin ? (
              <>
                <textarea
                  className="client-notes-editor"
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value.slice(0, 5000))}
                  placeholder="Например: на какие зоны акцент, упражнения, особенности коммуникации, организационные детали, другая важная информация для специалистов…"
                  rows={8}
                />
                <div className="client-notes-footer"><span>{notesDraft.length}/5000</span><button onClick={saveNotes} disabled={savingNotes}><Save size={15} />Сохранить</button></div>
              </>
            ) : (
              <div className="client-notes-readonly">
                {client.notes ? <p>{client.notes}</p> : <span>Администратор пока не добавил дополнительную информацию.</span>}
                <small><LockKeyhole size={13} />Редактирование доступно только администратору</small>
              </div>
            )}
          </section>

          {isAdmin && (
            <section className="profile-side-card compact-settings">
              <div className="side-card-heading"><ShieldCheck size={18} /><div><span>СКИДКИ</span><h2>Категории</h2></div></div>
              <label className="profile-check-row"><input type="checkbox" checked={!!client.isMilitary} disabled={savingFlags} onChange={(event) => saveFlags({ isMilitary: event.target.checked, isPensioner: !!client.isPensioner })} /><span>Военный</span><small>10% разово / 20% курс</small></label>
              <label className="profile-check-row"><input type="checkbox" checked={!!client.isPensioner} disabled={savingFlags} onChange={(event) => saveFlags({ isMilitary: !!client.isMilitary, isPensioner: event.target.checked })} /><span>Пенсионер</span><small>15%</small></label>
            </section>
          )}
        </aside>
      </div>

      {cardOpen && cardUrl && (
        <div className="client-card-lightbox" onClick={() => setCardOpen(false)}>
          <button aria-label="Закрыть" onClick={() => setCardOpen(false)}><X size={22} /></button>
          <img onClick={(event) => event.stopPropagation()} src={cardUrl} alt={`Карточка клиента ${client.fullName}`} />
        </div>
      )}
    </div>
  )
}
