import { useEffect, useMemo, useState } from "react"

import { appointmentApi } from "./appointment.api"
import { courseApi } from "../courses/course.api"

const errorMessages = {
  GROUP_SESSION_FULL: "Группа на это время уже заполнена. Выберите другое время или другого специалиста.",
  TIME_SLOT_BUSY: "У специалиста уже есть другое занятие в это время.",
  CLIENT_TIME_SLOT_BUSY: "У клиента уже есть занятие в это время.",
  SPECIALIST_UNAVAILABLE: "Специалист отметил это время как недоступное.",
  COURSE_SECOND_HALF_PAYMENT_REQUIRED: "Использована оплаченная половина курса. Для следующей записи сначала отметьте доплату второй половины курса.",
  COURSE_NOT_PAID: "Курс ещё не оплачен.",
  "Service not found": "Услуга больше не найдена. Обновите страницу и выберите услугу заново.",
  "Client not found": "Клиент больше не найден. Обновите список клиентов.",
}

function messageForError(error) {
  const code = error?.response?.data?.message || error?.message || "UNKNOWN_ERROR"
  return errorMessages[code] || `Не удалось создать занятие: ${code}`
}

function localDateParts(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return { date: "", time: "" }

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")

  return {
    date: `${yyyy}-${mm}-${dd}`,
    time: `${hh}:${min}`,
  }
}

function normalizeSearch(value = "") {
  return String(value)
    .toLocaleLowerCase("ru")
    .replace(/\s+/g, " ")
    .trim()
}

function phoneDigits(value = "") {
  return String(value).replace(/\D/g, "")
}

function clientPhone(client) {
  return client?.phone || client?.user?.phone || ""
}

export default function CreateAppointmentModal({
  open,
  onClose,
  selectedDate,
  onCreated,
}) {
  const [allClients, setAllClients] = useState([])
  const [allSpecialists, setAllSpecialists] = useState([])
  const [services, setServices] = useState([])

  const [availableClientIds, setAvailableClientIds] = useState(null)
  const [availableSpecialistIds, setAvailableSpecialistIds] = useState(null)
  const [joinableGroupSessions, setJoinableGroupSessions] = useState([])

  const [clientId, setClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [specialistId, setSpecialistId] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [duration, setDuration] = useState(60)
  const [courses, setCourses] = useState([])
  const [courseId, setCourseId] = useState("")

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [errorMessage, setErrorMessage] = useState("")
  const [loadingAvailability, setLoadingAvailability] = useState(false)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (!selectedDate) return
    const parts = localDateParts(selectedDate)
    setDate(parts.date)
    setTime(parts.time)
  }, [selectedDate])

  useEffect(() => {
    if (!open) return

    setClientSearch("")
    let cancelled = false

    async function loadData() {
      try {
        const [clientsRes, specialistsRes, servicesRes] = await Promise.all([
          appointmentApi.getClients(),
          appointmentApi.getSpecialists(),
          appointmentApi.getServices(),
        ])

        if (cancelled) return
        setAllClients(clientsRes.data || [])
        setAllSpecialists(specialistsRes.data || [])
        setServices(servicesRes.data || [])
      } catch (error) {
        if (!cancelled) setErrorMessage(messageForError(error))
      }
    }

    loadData()
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!clientId) {
      setCourses([])
      setCourseId("")
      return
    }

    let cancelled = false

    async function loadClientCourses() {
      try {
        const res = await courseApi.getClientCourses(clientId)
        if (cancelled) return

        const activeCourses = (res.data || []).filter((course) => {
          if (course.usedLessons >= course.totalLessons) return false

          if (course.paymentState === "HALF_PAID") {
            const halfLimit = Math.ceil(Number(course.totalLessons || 0) / 2)
            return Number(course.usedLessons || 0) < halfLimit
          }

          return course.paymentState !== "UNPAID"
        })
        setCourses(activeCourses)
      } catch (error) {
        if (!cancelled) setErrorMessage(messageForError(error))
      }
    }

    loadClientCourses()
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    if (!date || !time || !duration) return

    let cancelled = false

    async function loadAvailability() {
      setLoadingAvailability(true)
      try {
        // Intentionally request slot context without a service filter.
        // This lets the API return both free specialists and specialists
        // whose existing group session can accept another participant.
        const res = await appointmentApi.getAvailable({
          localDate: date,
          localTime: time,
          duration: Number(duration),
        })

        if (cancelled) return

        const nextClients = res.data?.clients || []
        const nextSpecialists = res.data?.specialists || []

        setAvailableClientIds(new Set(nextClients.map((item) => item.id)))
        setAvailableSpecialistIds(new Set(nextSpecialists.map((item) => item.id)))
        setJoinableGroupSessions(res.data?.joinableGroupSessions || [])

        if (clientId && !nextClients.some((item) => item.id === clientId)) {
          setClientId("")
          setCourseId("")
        }

        if (specialistId && !nextSpecialists.some((item) => item.id === specialistId)) {
          setSpecialistId("")
          if (!courseId) setServiceId("")
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(messageForError(error))
      } finally {
        if (!cancelled) setLoadingAvailability(false)
      }
    }

    loadAvailability()
    return () => {
      cancelled = true
    }
  }, [date, time, duration, clientId, specialistId, courseId])

  const selectedClient = allClients.find((item) => item.id === clientId)
  const selectedSpecialist = allSpecialists.find((item) => item.id === specialistId)

  const clients = useMemo(() => {
    return allClients.filter((client) => {
      if (availableClientIds && !availableClientIds.has(client.id)) return false
      if (selectedSpecialist?.userId && client.userId === selectedSpecialist.userId) return false
      return true
    })
  }, [allClients, availableClientIds, selectedSpecialist])

  const filteredClients = useMemo(() => {
    const textQuery = normalizeSearch(clientSearch)
    const digitQuery = phoneDigits(clientSearch)

    if (!textQuery && !digitQuery) return clients

    return clients.filter((client) => {
      const name = normalizeSearch(client.fullName)
      const phone = clientPhone(client)
      const digits = phoneDigits(phone)

      return (
        (textQuery && name.includes(textQuery)) ||
        (digitQuery && digits.includes(digitQuery))
      )
    })
  }, [clients, clientSearch])

  const specialists = useMemo(() => {
    return allSpecialists.filter((specialist) => {
      if (availableSpecialistIds && !availableSpecialistIds.has(specialist.id)) return false
      if (selectedClient?.userId && specialist.userId === selectedClient.userId) return false
      return true
    })
  }, [allSpecialists, availableSpecialistIds, selectedClient])

  const selectedCourse = courses.find((course) => course.id === courseId)

  const activeGroupSession = useMemo(
    () => joinableGroupSessions.find((session) => session.specialistId === specialistId) || null,
    [joinableGroupSessions, specialistId],
  )

  useEffect(() => {
    if (!activeGroupSession) return

    setServiceId(activeGroupSession.serviceId)
    setDuration(activeGroupSession.durationMinutes)

    // Keep a selected course when it belongs to the same group service.
    // Otherwise joining an existing group remains a one-off booking.
    if (selectedCourse && selectedCourse.serviceId !== activeGroupSession.serviceId) {
      setCourseId("")
    }
  }, [activeGroupSession, selectedCourse])

  const selectedService = services.find((service) => service.id === serviceId)
  const regularServices = services.filter((service) => !service.isPackage)

  useEffect(() => {
    if (!selectedCourse) return

    if (selectedCourse.serviceId) {
      setServiceId(selectedCourse.serviceId)
    }

    if (selectedCourse.service?.durationMinutes) {
      setDuration(Number(selectedCourse.service.durationMinutes))
    }

    setErrorMessage("")
  }, [selectedCourse])

  async function handleCreate() {
    setErrorMessage("")

    if (!clientId || !specialistId || (!serviceId && !courseId) || !date || !time) {
      setErrorMessage("Заполните клиента, специалиста, услугу/курс, дату и время.")
      return
    }

    try {
      setCreating(true)
      await appointmentApi.create({
        clientId,
        specialistId,
        serviceId: courseId ? null : serviceId,
        localDate: date,
        localTime: time,
        duration: Number(duration),
        courseId: courseId || null,
      })

      setCourseId("")
      await onCreated()
      onClose()
    } catch (error) {
      setErrorMessage(messageForError(error))
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  const inputStyle = {
    width: "100%",
    padding: 12,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#fff",
    borderRadius: 12,
    outline: "none",
    boxSizing: "border-box",
  }

  const labelStyle = {
    display: "block",
    marginBottom: 7,
    color: "rgba(255,255,255,0.6)",
    fontSize: 12,
    fontWeight: 700,
  }

  return (
    <div className="admin-page">
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.58)",
          zIndex: 9999,
          padding: "24px 12px",
          overflowY: "auto",
        }}
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            pointerEvents: "auto",
            width: "min(460px, 94vw)",
            background: "#17181d",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 24,
            boxShadow: "0 25px 80px rgba(0,0,0,0.45)",
            padding: 20,
            margin: "48px auto",
          }}
        >
          <h2 style={{ marginTop: 0 }}>Создать занятие</h2>

          {errorMessage && (
            <div
              role="alert"
              style={{
                marginBottom: 16,
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid rgba(239, 111, 108, .35)",
                background: "rgba(239, 111, 108, .08)",
                color: "#ffb7b4",
                fontSize: 13,
                lineHeight: 1.45,
              }}
            >
              {errorMessage}
            </div>
          )}

          <label style={labelStyle}>Дата</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />

          <div style={{ height: 14 }} />

          <label style={labelStyle}>Время</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />

          <div style={{ height: 14 }} />

          <label style={labelStyle}>Клиент</label>

          <input
            type="search"
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="Поиск по ФИО или номеру телефона"
            autoComplete="off"
            inputMode="search"
            style={{
              ...inputStyle,
              marginBottom: 8,
              borderColor: clientSearch
                ? "rgba(246,196,83,.32)"
                : "rgba(255,255,255,0.12)",
            }}
          />

          <select
            style={inputStyle}
            value={clientId}
            onChange={(e) => {
              const nextId = e.target.value
              setClientId(nextId)
              setErrorMessage("")

              const picked = allClients.find((client) => client.id === nextId)
              if (picked) {
                const phone = clientPhone(picked)
                setClientSearch(phone ? `${picked.fullName} · ${phone}` : picked.fullName)
              }
            }}
          >
            <option value="">
              {clientSearch && filteredClients.length === 0
                ? "Клиенты не найдены"
                : `Выберите клиента${clientSearch ? ` · найдено ${filteredClients.length}` : ""}`}
            </option>

            {filteredClients.map((client) => {
              const phone = clientPhone(client)
              return (
                <option key={client.id} value={client.id}>
                  {client.fullName}{phone ? ` · ${phone}` : ""}
                </option>
              )
            })}

            {clientId &&
             !filteredClients.some((client) => client.id === clientId) &&
             selectedClient && (
              <option value={selectedClient.id}>
                {selectedClient.fullName}
                {clientPhone(selectedClient) ? ` · ${clientPhone(selectedClient)}` : ""}
              </option>
            )}
          </select>

          <div
            style={{
              marginTop: 7,
              minHeight: 16,
              color: "rgba(255,255,255,.45)",
              fontSize: 11,
              lineHeight: 1.35,
            }}
          >
            {clientSearch
              ? filteredClients.length > 0
                ? `Найдено клиентов: ${filteredClients.length}`
                : "Совпадений по ФИО или телефону нет"
              : `Доступно клиентов в этом слоте: ${clients.length}`}
          </div>

          <div style={{ height: 14 }} />

          <label style={labelStyle}>Специалист</label>
          <select
            style={inputStyle}
            value={specialistId}
            onChange={(e) => {
              setSpecialistId(e.target.value)
              setServiceId("")
              setCourseId("")
              setErrorMessage("")
            }}
          >
            <option value="">Выберите специалиста</option>
            {specialists.map((specialist) => (
              <option key={specialist.id} value={specialist.id}>
                {specialist.fullName}
              </option>
            ))}
          </select>

          {loadingAvailability && (
            <div style={{ marginTop: 8, color: "rgba(255,255,255,.45)", fontSize: 11 }}>
              Проверяем занятость слота…
            </div>
          )}

          <div style={{ height: 14 }} />

          {activeGroupSession ? (
            <div
              style={{
                padding: "14px 15px",
                borderRadius: 14,
                border: "1px solid rgba(223, 183, 65, .35)",
                background: "rgba(223, 183, 65, .08)",
              }}
            >
              <div style={{ color: "#e6bd4a", fontWeight: 800, fontSize: 12, marginBottom: 7 }}>
                Присоединение к групповому занятию
              </div>
              <div style={{ fontWeight: 800, lineHeight: 1.35 }}>
                {activeGroupSession.serviceTitle}
              </div>
              <div style={{ marginTop: 7, color: "rgba(255,255,255,.64)", fontSize: 12 }}>
                Уже записано: {activeGroupSession.currentClients}/{activeGroupSession.maxClients} · свободно мест: {activeGroupSession.remainingPlaces}
              </div>
            </div>
          ) : (
            <>
              <label style={labelStyle}>Курс</label>
              <select
                style={inputStyle}
                value={courseId}
                onChange={(e) => {
                  const nextCourseId = e.target.value
                  setCourseId(nextCourseId)
                  setErrorMessage("")

                  if (!nextCourseId) {
                    setServiceId("")
                  }
                }}
              >
                <option value="">Без курса / разовая оплата</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} — {course.totalLessons - course.usedLessons}/{course.totalLessons} осталось
                  </option>
                ))}
              </select>

              <div style={{ height: 14 }} />

              {selectedCourse ? (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid rgba(246,196,83,.24)",
                    background: "rgba(246,196,83,.055)",
                  }}
                >
                  <div style={{ color: "#f6c453", fontSize: 11, fontWeight: 900, marginBottom: 5 }}>
                    УСЛУГА ИЗ КУРСА
                  </div>
                  <strong>{selectedCourse.title}</strong>
                  <div style={{ marginTop: 5, color: "rgba(255,255,255,.58)", fontSize: 11 }}>
                    {selectedCourse.service?.title || "Услуга курса"} · услуга и начисление специалисту определяются выбранным курсом автоматически.
                  </div>
                </div>
              ) : (
                <>
                  <label style={labelStyle}>Услуга</label>
                  <select
                    style={inputStyle}
                    value={serviceId}
                    onChange={(e) => {
                      const nextId = e.target.value
                      setServiceId(nextId)
                      setErrorMessage("")

                      const service = services.find((item) => item.id === nextId)
                      if (service?.durationMinutes) setDuration(service.durationMinutes)
                    }}
                  >
                    <option value="">Выберите услугу</option>
                    {regularServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.title} — {service.price} грн
                      </option>
                    ))}
                  </select>

                  {selectedService?.groupAllowed && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        background: "rgba(255,255,255,0.04)",
                        color: "rgba(255,255,255,0.72)",
                        borderRadius: 10,
                        fontSize: 13,
                        lineHeight: 1.4,
                      }}
                    >
                      Групповая услуга · максимум {selectedService.maxClients || 1} клиентов в одном слоте
                    </div>
                  )}
                </>
              )}
            </>
          )}

          <div style={{ height: 14 }} />

          <label style={labelStyle}>Длительность</label>
          <select
            style={inputStyle}
            value={duration}
            disabled={Boolean(activeGroupSession)}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value={30}>30 минут</option>
            <option value={60}>1 час</option>
            <option value={90}>1,5 часа</option>
            <option value={120}>2 часа</option>
          </select>

          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={handleCreate} disabled={creating || loadingAvailability}>
              {creating ? "Создаём…" : activeGroupSession ? "Добавить в группу" : "Создать"}
            </button>
            <button onClick={onClose} disabled={creating}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
