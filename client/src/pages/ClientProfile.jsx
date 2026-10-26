import { useEffect, useMemo, useState } from "react"
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Phone,
  User,
} from "lucide-react"
import { useNavigate } from "react-router-dom"

import { clientApi } from "../features/client/client.api"
import { formatCenterDateTime } from "../utils/centerTime"
import PlatformFooter from "../components/PlatformFooter"
import "./ClientProfile.css"

const CENTER_PHONE_DISPLAY = "+38 066 114 14 53"
const CENTER_PHONE_HREF = "+380661141453"
const CENTER_ADDRESS = "г. Павлоград, ТЦ 'ЦУМ', ул. Шевченка 118 (3 этаж)"

function formatDate(value) {
  if (!value) return "—"
  return formatCenterDateTime(value, "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

export default function ClientProfile() {
  const [data, setData] = useState(null)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  useEffect(() => {
    let cancelled = false

    clientApi.getMe()
      .then((response) => {
        if (!cancelled) setData(response.data)
      })
      .catch(() => {
        if (!cancelled) setError("Не удалось загрузить личный кабинет")
      })

    return () => {
      cancelled = true
    }
  }, [])

  const appointments = data?.appointments || []
  const upcoming = useMemo(
    () => appointments.filter((appointment) => appointment.status === "SCHEDULED").sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    [appointments],
  )
  const completed = useMemo(
    () => appointments.filter((appointment) => appointment.status === "COMPLETED").sort((a, b) => new Date(b.startTime) - new Date(a.startTime)),
    [appointments],
  )

  if (error) {
    return <div className="profile-loading"><strong>DORSUM</strong><span>{error}</span><button onClick={() => navigate("/")}>На главную</button></div>
  }

  if (!data) {
    return <div className="profile-loading"><strong>DORSUM</strong><span>Загрузка личного кабинета...</span></div>
  }

  const profile = data.user?.clientProfile
  const courses = data.courses || []
  const fullName = profile?.fullName || "Клиент Dorsum"
  const phone = data.user?.phone || profile?.phone || "Телефон не указан"

  return (
    <div className="profile-page branded-profile-page">
      <header className="profile-brand-header">
        <button className="profile-back" onClick={() => navigate("/")}><ArrowLeft size={19} /> На главную</button>
        <div className="profile-brand-logo"><strong>DORSUM</strong><span>CLIENT AREA</span></div>
        <a href={`tel:${CENTER_PHONE_HREF}`}><Phone size={16} /><span>{CENTER_PHONE_DISPLAY}</span></a>
      </header>

      <main className="profile-brand-main">
        <section className="profile-hero-v2">
          <div className="profile-identity">
            <span className="profile-kicker">ЛИЧНЫЙ КАБИНЕТ</span>
            <h1>{fullName}</h1>
            <div className="profile-meta-v2">
              <span><Phone size={15} /> {phone}</span>
              <span><MapPin size={15} /> {CENTER_ADDRESS}</span>
            </div>
          </div>
          <div className="profile-monogram"><User size={40} /><span>DORSUM</span></div>
        </section>

        <section className="profile-stats-v2">
          <article><span>01</span><strong>{upcoming.length}</strong><p>Запланировано</p></article>
          <article><span>02</span><strong>{completed.length}</strong><p>Проведено</p></article>
          <article><span>03</span><strong>{courses.length}</strong><p>Активных курсов</p></article>
          <article><span>04</span><strong>{appointments.length}</strong><p>Всего записей</p></article>
        </section>

        <section className="profile-block profile-upcoming">
          <div className="profile-block-heading">
            <div><span>РАСПИСАНИЕ</span><h2>Ближайшие занятия</h2></div>
            <Clock3 size={27} />
          </div>
          {upcoming.length ? (
            <div className="profile-appointment-list">
              {upcoming.map((appointment, index) => (
                <article key={appointment.id} className="profile-appointment-row">
                  <span className="profile-row-number">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{appointment.service?.title || "Занятие"}</strong><small>{appointment.specialist?.fullName || "Специалист Dorsum"}</small></div>
                  <span className="profile-date"><CalendarDays size={15} /> {formatDate(appointment.startTime)}</span>
                  <i style={{ background: appointment.specialist?.color || "#d2a71f" }} />
                </article>
              ))}
            </div>
          ) : <div className="profile-empty">Сейчас нет запланированных занятий.</div>}
        </section>

        <section className="profile-grid-sections">
          <div className="profile-block">
            <div className="profile-block-heading compact"><div><span>КУРСЫ</span><h2>Мои программы</h2></div><BookOpen size={25} /></div>
            <div className="profile-course-list">
              {courses.length ? courses.map((course) => {
                const remaining = Math.max(0, course.totalLessons - course.usedLessons)
                const progress = course.totalLessons ? Math.min(100, Math.round((course.usedLessons / course.totalLessons) * 100)) : 0
                return (
                  <article className="profile-course-card" key={course.id}>
                    <span className="course-status">АКТИВЕН</span>
                    <h3>{course.title}</h3>
                    <div className="course-progress"><span style={{ width: `${progress}%` }} /></div>
                    <div className="course-meta"><span>Осталось {remaining} / {course.totalLessons}</span><strong>{course.price} грн</strong></div>
                  </article>
                )
              }) : <div className="profile-empty small">Активных курсов пока нет.</div>}
            </div>
          </div>

          <div className="profile-block">
            <div className="profile-block-heading compact"><div><span>ИСТОРИЯ</span><h2>Пройденные занятия</h2></div><CheckCircle2 size={25} /></div>
            <div className="profile-history-list">
              {completed.length ? completed.slice(0, 8).map((appointment) => (
                <article key={appointment.id}>
                  <CheckCircle2 size={17} />
                  <div><strong>{appointment.service?.title || "Занятие"}</strong><small>{appointment.specialist?.fullName || "Специалист Dorsum"}</small></div>
                  <span>{formatDate(appointment.startTime)}</span>
                </article>
              )) : <div className="profile-empty small">Проведённых занятий пока нет.</div>}
            </div>
          </div>
        </section>
      </main>

      <PlatformFooter />

    </div>
  )
}
