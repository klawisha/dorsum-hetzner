import { appointmentApi } from "./appointment.api"
import { courseApi } from "../courses/course.api"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { centerWallParts, formatCenterDateTime } from "../../utils/centerTime"


export default function AppointmentDetailsModal({
  appointment,
  open,
  onClose,
  onDeleted,
  onUpdated,
  mode="admin"
}) {

const navigate = useNavigate()

const isAdmin = mode === "admin"
const isSpecialist = mode === "specialist"

const [paymentStatus, setPaymentStatus] = useState("PENDING")
const [status, setStatus] = useState("SCHEDULED")
const [specialists, setSpecialists] = useState([])
const [selectedSpecialistId, setSelectedSpecialistId] = useState("")
const [editDate, setEditDate] = useState("")
const [editTime, setEditTime] = useState("")
const [editDuration, setEditDuration] = useState(60)
const [editKind, setEditKind] = useState("SERVICE")
const [editServiceId, setEditServiceId] = useState("")
const [editCourseId, setEditCourseId] = useState("")
const [services, setServices] = useState([])
const [clientCourses, setClientCourses] = useState([])
const [editingSchedule, setEditingSchedule] = useState(false)
const [actionError, setActionError] = useState("")

useEffect(() => {
  if (appointment) {
    setPaymentStatus(appointment.paymentStatus || "PENDING")
    setStatus(appointment.status || "SCHEDULED")
    setSelectedSpecialistId(appointment.specialist?.id || "")
    const wall = centerWallParts(appointment.startTime)
    setEditDate(wall.date)
    setEditTime(wall.time)
    setEditDuration(Number(appointment.duration || 60))
    setEditKind(appointment.course?.id ? "COURSE" : "SERVICE")
    setEditServiceId(appointment.course?.id ? "" : (appointment.service?.id || ""))
    setEditCourseId(appointment.course?.id || "")
    setActionError("")
  }
}, [appointment])


useEffect(() => {
  if (!open || !appointment || !isAdmin) return
  if (appointment.status !== "SCHEDULED") return

  let cancelled = false

  Promise.all([
    appointmentApi.getServices(),
    courseApi.getClientCourses(appointment.client.id),
  ])
    .then(([servicesResponse, coursesResponse]) => {
      if (cancelled) return

      const regularServices = (servicesResponse.data || []).filter((service) => !service.isPackage)
      setServices(regularServices)
      setClientCourses(coursesResponse.data || [])
    })
    .catch(() => {
      if (!cancelled) setActionError("Не удалось загрузить услуги или курсы клиента")
    })

  return () => {
    cancelled = true
  }
}, [open, appointment, isAdmin])

const selectedEditCourse = clientCourses.find((course) => course.id === editCourseId)
const targetEditServiceId =
  editKind === "COURSE"
    ? selectedEditCourse?.serviceId || ""
    : editServiceId

useEffect(() => {
  if (!open || !appointment || !isAdmin) return
  if (appointment.status !== "SCHEDULED") return
  if (!editDate || !editTime || !editDuration || !targetEditServiceId) return

  let cancelled = false
  const timer = window.setTimeout(() => {
    appointmentApi.getAvailable({
      localDate: editDate,
      localTime: editTime,
      duration: Number(editDuration),
      serviceId: targetEditServiceId,
      excludeAppointmentId: appointment.id,
    })
      .then((response) => {
        if (cancelled) return
        const available = response.data?.specialists || []

        // Keep the current selection only if it is still valid for the edited slot.
        setSpecialists(available)
        if (
          selectedSpecialistId &&
          !available.some((specialist) => specialist.id === selectedSpecialistId)
        ) {
          setSelectedSpecialistId("")
        }
      })
      .catch(() => {
        if (!cancelled) setActionError("Не удалось проверить свободных специалистов")
      })
  }, 180)

  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
}, [
  open,
  appointment,
  isAdmin,
  editDate,
  editTime,
  editDuration,
  targetEditServiceId,
])

  if (!open || !appointment) return null


const handleSaveStatuses = async () => {
  await appointmentApi.updateStatuses(appointment.id, {
    paymentStatus,
    status
  })

  onUpdated()
  onClose()
}


const handleEditSchedule = async () => {
  if (!selectedSpecialistId || !editDate || !editTime || !editDuration) return
  if (editKind === "SERVICE" && !editServiceId) {
    setActionError("Выберите услугу.")
    return
  }
  if (editKind === "COURSE" && !editCourseId) {
    setActionError("Выберите курс клиента.")
    return
  }

  setEditingSchedule(true)
  setActionError("")

  try {
    await appointmentApi.editSchedule(appointment.id, {
      specialistId: selectedSpecialistId,
      localDate: editDate,
      localTime: editTime,
      duration: Number(editDuration),
      serviceId: editKind === "SERVICE" ? editServiceId : null,
      courseId: editKind === "COURSE" ? editCourseId : null,
    })
    await onUpdated()
    onClose()
  } catch (error) {
    const code = error.response?.data?.message
    const messages = {
      SPECIALIST_TIME_SLOT_BUSY: "У выбранного специалиста это время уже занято.",
      CLIENT_TIME_SLOT_BUSY: "У клиента уже есть другое занятие в это время.",
      SPECIALIST_UNAVAILABLE: "У специалиста на это время стоит окно недоступности.",
      GROUP_SESSION_FULL: "Групповое занятие на это время уже заполнено.",
      ONLY_SCHEDULED_CAN_EDIT: "Редактировать можно только запланированное занятие.",
      MOVE_TARGET_IN_PAST: "Нельзя перенести занятие на прошедшее время.",
      INVALID_DURATION: "Некорректная длительность занятия.",
      COURSE_NOT_FOUND: "Выбранный курс не найден.",
      COURSE_WRONG_CLIENT: "Этот курс принадлежит другому клиенту.",
      COURSE_SERVICE_UNAVAILABLE: "У выбранного курса больше нет корректной услуги.",
      COURSE_NOT_PAID: "Выбранный курс ещё не оплачен.",
      COURSE_EXPIRED: "Срок действия выбранного курса закончился.",
      COURSE_SECOND_HALF_PAYMENT_REQUIRED: "Первая оплаченная половина курса уже использована. Сначала отметьте доплату.",
      COURSE_LESSONS_FINISHED: "Все занятия выбранного курса уже использованы.",
      SERVICE_NOT_AVAILABLE: "Выбранная услуга недоступна.",
      PAID_ONE_OFF_MUST_BE_PENDING_BEFORE_SERVICE_CHANGE: "Это разовое занятие уже отмечено оплаченным. Сначала измените оплату на «Не оплачено», сохраните, затем смените услугу или переведите запись на курс.",
    }
    setActionError(messages[code] || code || "Не удалось изменить занятие.")
  } finally {
    setEditingSchedule(false)
  }
}

const handleDelete = async () => {
  const confirmed = window.confirm("Удалить занятие?")

  if (!confirmed) return

  await appointmentApi.delete(appointment.id)

  onDeleted()
  onClose()
}

const smallLabel = {
  display: "block",
  fontSize: 11,
  color: "#9ca3af",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: 1
}

const infoBox = (color) => ({
  borderLeft: `4px solid ${color}`,
  background: "rgba(255,255,255,0.055)",
  borderRadius: 14,
  padding: 12,
  minHeight: 70
})

const rowStyle = {
  margin: "0 0 8px",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 14
}

const formLabel = {
  display: "block",
  marginBottom: 6,
  color: "#f6c453",
  fontSize: 13,
  fontWeight: 800
}

const selectStyle = {
  width: "100%",
  padding: 11,
  background: "rgba(255,255,255,0.08)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 12,
  outline: "none"
}

  return (
  <div
    onClick={onClose}
    style={{
      position: "fixed",
      inset: 0,
      background: "rgba(8, 9, 12, 0.78)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16
    }}
  >
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: "min(520px, 96vw)",
        maxHeight: "90vh",
        overflowY: "auto",
        background: "#17181d",
        color: "#fff",
        padding: 22,
        borderRadius: 22,
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 25px 80px rgba(0,0,0,0.55)"
      }}
    >
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14
      }}>
        <div>
          <p style={{
            margin: 0,
            color: "#f6c453",
            fontSize: 12,
            textTransform: "uppercase",
            letterSpacing: 2,
            fontWeight: 800
          }}>
            Appointment
          </p>

          <h2 style={{
            margin: "4px 0 0",
            fontSize: 24
          }}>
            Details
          </h2>
        </div>

        <button
          onClick={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.08)",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>

{isAdmin &&
 appointment.status === "SCHEDULED" && (
  <div className="appointment-admin-editor" style={{
    marginBottom: 14,
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(246,196,83,.18)",
    background: "rgba(246,196,83,.045)"
  }}>
    <div style={{ marginBottom: 10 }}>
      <span style={{
        display: "block",
        color: "#f6c453",
        fontSize: 10,
        fontWeight: 900,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginBottom: 4
      }}>
        ADMIN / РЕДАКТИРОВАНИЕ
      </span>
      <strong style={{ fontSize: 16 }}>Изменить запланированное занятие</strong>
      <small style={{ display: "block", marginTop: 4, color: "#858b86", lineHeight: 1.4 }}>
        Можно изменить услугу или перевести запись на курс, а также дату, время, длительность и специалиста.
      </small>
    </div>

    <div style={{
      marginBottom: 10,
      padding: 10,
      borderRadius: 12,
      border: "1px solid rgba(255,255,255,.075)",
      background: "rgba(255,255,255,.025)"
    }}>
      <span style={smallLabel}>Что оплачивает занятие</span>

      <div className="appointment-edit-payment-grid" style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 7,
        marginBottom: 9
      }}>
        <button
          type="button"
          onClick={() => {
            setEditKind("SERVICE")
            setEditCourseId("")
            if (!services.some((service) => service.id === editServiceId)) {
              setEditServiceId(appointment.course ? "" : (appointment.service?.id || ""))
            }
            setActionError("")
          }}
          style={{
            minHeight: 38,
            borderRadius: 9,
            border: editKind === "SERVICE"
              ? "1px solid rgba(246,196,83,.5)"
              : "1px solid rgba(255,255,255,.1)",
            background: editKind === "SERVICE"
              ? "rgba(246,196,83,.09)"
              : "rgba(255,255,255,.035)",
            color: editKind === "SERVICE" ? "#f6c453" : "#a0a5a1",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Разовая услуга
        </button>

        <button
          type="button"
          onClick={() => {
            setEditKind("COURSE")
            setEditServiceId("")
            setActionError("")
          }}
          style={{
            minHeight: 38,
            borderRadius: 9,
            border: editKind === "COURSE"
              ? "1px solid rgba(246,196,83,.5)"
              : "1px solid rgba(255,255,255,.1)",
            background: editKind === "COURSE"
              ? "rgba(246,196,83,.09)"
              : "rgba(255,255,255,.035)",
            color: editKind === "COURSE" ? "#f6c453" : "#a0a5a1",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Курс клиента
        </button>
      </div>

      {editKind === "SERVICE" ? (
        <div>
          <span style={smallLabel}>Услуга</span>
          <select
            value={editServiceId}
            onChange={(e) => {
              const nextId = e.target.value
              setEditServiceId(nextId)
              const service = services.find((item) => item.id === nextId)
              if (service?.durationMinutes) {
                setEditDuration(Number(service.durationMinutes))
              }
              setActionError("")
            }}
            style={selectStyle}
          >
            <option value="">Выберите услугу</option>
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.title} · {service.price} грн
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div>
          <span style={smallLabel}>Курс клиента</span>
          <select
            value={editCourseId}
            onChange={(e) => {
              const nextId = e.target.value
              setEditCourseId(nextId)
              const course = clientCourses.find((item) => item.id === nextId)
              if (course?.service?.durationMinutes) {
                setEditDuration(Number(course.service.durationMinutes))
              }
              setActionError("")
            }}
            style={selectStyle}
          >
            <option value="">Выберите купленный курс</option>
            {clientCourses.map((course) => {
              const total = Number(course.totalLessons || 0)
              const used = Number(course.usedLessons || 0)
              const halfLimit = Math.ceil(total / 2)
              const isCurrent = appointment.course?.id === course.id
              const lockedByHalf =
                course.paymentState === "HALF_PAID" &&
                used >= halfLimit &&
                !isCurrent
              const finished = used >= total && !isCurrent
              const unavailable =
                course.paymentState === "UNPAID" ||
                lockedByHalf ||
                finished

              const stateText =
                course.paymentState === "HALF_PAID"
                  ? `оплачено 1/2 · ${used}/${halfLimit} доступных использовано`
                  : `${used}/${total} использовано`

              return (
                <option
                  key={course.id}
                  value={course.id}
                  disabled={unavailable}
                >
                  {course.title} · {stateText}
                  {lockedByHalf ? " · нужна доплата" : ""}
                  {finished ? " · завершён" : ""}
                </option>
              )
            })}
          </select>

          {selectedEditCourse && (
            <div style={{
              marginTop: 7,
              padding: "8px 9px",
              borderLeft: "2px solid #f6c453",
              background: "rgba(246,196,83,.035)",
              color: "#959b95",
              fontSize: 10,
              lineHeight: 1.45
            }}>
              Услуга определяется курсом автоматически:
              {" "}
              <strong style={{ color: "#ddd" }}>
                {selectedEditCourse.service?.title || "—"}
              </strong>.
              {" "}
              Начисление специалисту также будет взято из курса.
            </div>
          )}
        </div>
      )}
    </div>

    <div
      className="appointment-edit-datetime-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 8,
        marginBottom: 8
      }}
    >
      <div className="appointment-edit-field">
        <span style={smallLabel}>Дата</span>
        <input
          className="appointment-edit-native-input"
          type="date"
          value={editDate}
          onChange={(e) => setEditDate(e.target.value)}
          style={selectStyle}
        />
      </div>
      <div className="appointment-edit-field">
        <span style={smallLabel}>Время</span>
        <input
          className="appointment-edit-native-input"
          type="time"
          value={editTime}
          onChange={(e) => setEditTime(e.target.value)}
          style={selectStyle}
        />
      </div>
    </div>

    <div
      className="appointment-edit-specialist-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) minmax(130px,.45fr)",
        gap: 8,
        marginBottom: 10
      }}
    >
      <div className="appointment-edit-field">
        <span style={smallLabel}>Специалист</span>
        <select
          value={selectedSpecialistId}
          onChange={(e) => setSelectedSpecialistId(e.target.value)}
          style={selectStyle}
          disabled={editingSchedule}
        >
          <option value="">
            {specialists.length ? "Выберите свободного специалиста" : "Свободных специалистов нет"}
          </option>
          {specialists.map((specialist) => (
            <option value={specialist.id} key={specialist.id}>{specialist.fullName}</option>
          ))}
        </select>
      </div>

      <div className="appointment-edit-field">
        <span style={smallLabel}>Длительность</span>
        <select value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} style={selectStyle}>
          <option value={30}>30 мин</option>
          <option value={60}>60 мин</option>
          <option value={90}>90 мин</option>
          <option value={120}>120 мин</option>
        </select>
      </div>
    </div>

    <button
      type="button"
      onClick={handleEditSchedule}
      disabled={editingSchedule}
      style={{
        width: "100%",
        minHeight: 42,
        borderRadius: 12,
        border: "none",
        background: "#f6c453",
        color: "#111",
        fontWeight: 900,
        cursor: editingSchedule ? "wait" : "pointer"
      }}
    >
      {editingSchedule ? "Проверяем изменения…" : "Сохранить изменения занятия"}
    </button>

    <div style={{ marginTop: 7, color: "#7f8580", fontSize: 11, lineHeight: 1.4 }}>
      Backend проверит занятость клиента, специалиста, окна недоступности и вместимость группы.
    </div>
  </div>
)}


      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 14
      }}>
        <div style={infoBox("#3b82f6")}>
          <span style={smallLabel}>Client</span>
          <button
            onClick={() => {
              onClose()

              if (isAdmin) {
                navigate(`/admin/clients/${appointment.client.id}`)
              }

              if (isSpecialist) {
                navigate(`/specialist/clients/${appointment.client.id}`)
              }
            }}
            style={{
              background: "transparent",
              border: "none",
              color: "#fff",
              padding: 0,
              fontWeight: 800,
              cursor: "pointer",
              textAlign: "left",
              textDecoration: "underline"
            }}
          >
            {appointment.client.fullName}
</button>
                  </div>

        <div style={infoBox("#8b5cf6")}>
          <span style={smallLabel}>Specialist</span>
          <b>{appointment.specialist.fullName}</b>
        </div>

        <div style={infoBox("#22c55e")}>
          <span style={smallLabel}>{appointment.course ? "Курс / услуга" : "Service"}</span>
          <b>{appointment.course?.title || appointment.service.title}</b>
          {appointment.course && (
            <small style={{ display: "block", marginTop: 5, color: "#9ca3af", lineHeight: 1.3 }}>
              Услуга: {appointment.service.title}
            </small>
          )}
        </div>

        <div style={infoBox("#f97316")}>
          <span style={smallLabel}>Price</span>
          <b>{appointment.price} грн</b>
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.055)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 16,
        padding: 14,
        marginBottom: 12
      }}>
        <p style={rowStyle}>
          <span style={{ color: "#9ca3af" }}>Time:</span>
          <b>
            {formatCenterDateTime(appointment.startTime, "ru-RU", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
            {" — "}
            {formatCenterDateTime(appointment.endTime, "ru-RU", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            })}
          </b>
        </p>

        <p style={rowStyle}>
          <span style={{ color: "#9ca3af" }}>Duration:</span>
          <b>{appointment.duration} min</b>
        </p>

        {appointment.discountPercent > 0 && <p style={rowStyle}><span style={{color:"#9ca3af"}}>Скидка:</span><b>{appointment.discountPercent}% · {appointment.discountReason}</b></p>}
        <p style={rowStyle}><span style={{color:"#9ca3af"}}>Начисление специалисту:</span><b>{appointment.specialistPay || 0} грн</b></p>
        <p style={rowStyle}>
          <span style={{ color: "#9ca3af" }}>Course:</span>
          <b>
            {appointment.course
              ? appointment.course.title
              : "Разовое занятие"}
          </b>
        </p>
      </div>


{actionError && (
  <div style={{
    marginBottom: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(220,38,38,.35)",
    background: "rgba(220,38,38,.10)",
    color: "#fecaca",
    fontSize: 13
  }}>
    {actionError}
  </div>
)}


{isAdmin && (

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10,
        marginBottom: 14
      }}>
        <div>
          <label style={formLabel}>Оплата</label>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="PENDING">Не оплачено</option>
            <option value="PAID">Оплачено</option>
          </select>
        </div>

        <div>
          <label style={formLabel}>Занятие</label>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={selectStyle}
          >
            <option value="SCHEDULED">Запланировано</option>
            <option value="COMPLETED">Проведено</option>
            <option value="NOT_COMPLETED">Не проведено</option>
            <option value="CANCELLED">Отменено</option>
          </select>
        </div>
      </div>
)}

{isAdmin && (

      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 10
      }}>
        <button
          onClick={handleSaveStatuses}
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: "none",
            background: "#f6c453",
            color: "#111",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Save
        </button>

        <button
          onClick={handleDelete}
          style={{
            padding: "12px 14px",
            borderRadius: 14,
            border: "none",
            background: "#dc2626",
            color: "#fff",
            fontWeight: 900,
            cursor: "pointer"
          }}
        >
          Delete
        </button>
      </div>
)}
{isSpecialist && (
  <button
    onClick={() => {
      onClose()
      navigate(`/specialist/clients/${appointment.client.id}`)
    }}
    style={{
      width: "100%",
      padding: "12px 14px",
      borderRadius: 14,
      border: "none",
      background: "#f6c453",
      color: "#111",
      fontWeight: 900,
      cursor: "pointer"
    }}
  >
    Открыть профиль клиента
  </button>
)}
    </div>
  </div>
)
}