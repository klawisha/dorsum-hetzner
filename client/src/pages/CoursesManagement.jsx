import { useEffect, useMemo, useState } from "react"
import { BookOpen, CheckCircle2, CreditCard, History, LockKeyhole, Trash2, Users } from "lucide-react"
import { courseApi } from "../features/courses/course.api"
import { appointmentApi } from "../features/appointments/appointment.api"

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

export default function CoursesManagement() {
  const [clients, setClients] = useState([])
  const [courses, setCourses] = useState([])
  const [services, setServices] = useState([])
  const [clientId, setClientId] = useState("")
  const [clientSearch, setClientSearch] = useState("")
  const [serviceId, setServiceId] = useState("")
  const [error, setError] = useState("")
  const [deletingCourseId, setDeletingCourseId] = useState("")
  const [legacyImported, setLegacyImported] = useState(false)
  const [initialUsedLessons, setInitialUsedLessons] = useState(0)
  const [paymentMode, setPaymentMode] = useState("FULL")
  const [settlingCourseId, setSettlingCourseId] = useState("")

  async function loadData() {
    const [clientsResponse, coursesResponse, servicesResponse] = await Promise.all([
      appointmentApi.getClients(),
      courseApi.getAll(),
      appointmentApi.getServices(),
    ])

    setClients(clientsResponse.data)
    setCourses(coursesResponse.data)
    setServices(servicesResponse.data.filter((service) => service.isPackage))
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === clientId),
    [clients, clientId],
  )

  const filteredClients = useMemo(() => {
    const textQuery = normalizeSearch(clientSearch)
    const digitQuery = phoneDigits(clientSearch)

    if (!textQuery && !digitQuery) return clients

    return clients.filter((client) => {
      const name = normalizeSearch(client.fullName)
      const digits = phoneDigits(clientPhone(client))

      return (
        (textQuery && name.includes(textQuery)) ||
        (digitQuery && digits.includes(digitQuery))
      )
    })
  }, [clients, clientSearch])

  const selectedService = useMemo(
    () => services.find((service) => service.id === serviceId),
    [services, serviceId],
  )

  async function create() {
    try {
      setError("")

      if (!clientId || !serviceId) {
        setError("Выберите клиента и курс")
        return
      }

      const totalLessons = Number(selectedService?.packageSessions || 0)
      const usedLessons = Number(initialUsedLessons || 0)

      if (legacyImported && (
        !Number.isInteger(usedLessons) ||
        usedLessons < 0 ||
        usedLessons > totalLessons
      )) {
        setError(`Количество пройденных занятий должно быть от 0 до ${totalLessons}.`)
        return
      }

      await courseApi.create({
        clientId,
        serviceId,
        legacyImported,
        usedLessons: legacyImported ? usedLessons : 0,
        paymentMode,
      })

      setClientId("")
      setClientSearch("")
      setServiceId("")
      setLegacyImported(false)
      setInitialUsedLessons(0)
      setPaymentMode("FULL")
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось оформить курс")
    }
  }

  async function completeCoursePayment(course) {
    if (course.paymentState !== "HALF_PAID") return

    const remaining = Math.max(
      0,
      Number(course.price || 0) - Number(course.paidAmount || 0),
    )

    const confirmed = window.confirm(
      `Отметить курс полностью доплаченным?\n\n${course.client?.fullName || "Клиент"}\n${course.title}\n\nДоплата: ${remaining.toFixed(2)} грн\n\nПосле этого откроется оставшаяся половина занятий.`
    )
    if (!confirmed) return

    setSettlingCourseId(course.id)
    setError("")
    try {
      await courseApi.completePayment(course.id)
      await loadData()
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Не удалось отметить доплату по курсу")
    } finally {
      setSettlingCourseId("")
    }
  }

  async function removeCourse(course) {
    const used = Number(course.usedLessons || 0)
    if (used > 0) {
      setError("Курс уже использовался. Его нельзя удалить, чтобы не разрушить историю занятий и финансов.")
      return
    }

    const confirmed = window.confirm(
      `Отменить неиспользованный курс?\n\n${course.client?.fullName || "Клиент"}\n${course.title}\n${Number(course.price || 0).toFixed(2)} грн\n\nОтмена сохранится в истории. Фактически полученная сумма будет отражена возвратом на текущую дату. Деньги клиенту нужно вернуть отдельно.`
    )

    if (!confirmed) return

    setDeletingCourseId(course.id)
    setError("")

    try {
      await courseApi.delete(course.id)
      await loadData()
    } catch (requestError) {
      const code = requestError.response?.data?.message

      if (code === "COURSE_HAS_APPOINTMENTS") {
        setError("Курс уже связан с занятиями. Сначала исправьте или удалите связанные записи — сам курс сейчас удалять нельзя.")
      } else if (code === "COURSE_NOT_FOUND") {
        setError("Курс уже был удалён. Обновите страницу.")
        await loadData()
      } else {
        setError(code || "Не удалось удалить курс")
      }
    } finally {
      setDeletingCourseId("")
    }
  }

  return (
    <div className="admin-page courses-page">
      <header className="courses-page-header">
        <div>
          <span className="courses-eyebrow">КУРСЫ / АДМИНИСТРИРОВАНИЕ</span>
          <h1>Курсы клиентов</h1>
          <p>Продажа пакетов занятий, скидки и контроль оставшихся посещений.</p>
        </div>

        <div className="courses-summary" aria-label="Статистика курсов">
          <div>
            <BookOpen size={17} />
            <span>Всего курсов</span>
            <strong>{courses.length}</strong>
          </div>
          <div>
            <Users size={17} />
            <span>Клиентов</span>
            <strong>{new Set(courses.map((course) => course.client?.id).filter(Boolean)).size}</strong>
          </div>
        </div>
      </header>

      {error && (
        <div className="courses-error" role="alert">
          {error}
        </div>
      )}

      <div className="courses-layout">
        <section className="course-sale-panel">
          <div className="course-panel-heading">
            <span>01</span>
            <div>
              <h2>Оформить курс</h2>
              <p>Выберите клиента и курс из актуального прайса.</p>
            </div>
          </div>

          <div className="course-client-search-block">
            <label className="course-field">
              <span>Поиск клиента</span>
              <input
                type="search"
                value={clientSearch}
                onChange={(event) => setClientSearch(event.target.value)}
                placeholder="ФИО или номер телефона"
                autoComplete="off"
                inputMode="search"
              />
            </label>

            <label className="course-field">
              <span>Клиент</span>
              <select
                value={clientId}
                onChange={(event) => {
                  const nextId = event.target.value
                  setClientId(nextId)

                  const picked = clients.find((client) => client.id === nextId)
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
                      {client.fullName}
                      {phone ? ` · ${phone}` : ""}
                      {client.isMilitary ? " · военный" : ""}
                      {client.isPensioner ? " · пенсионер" : ""}
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
            </label>

            <div className="course-client-search-meta">
              {clientSearch
                ? filteredClients.length > 0
                  ? `Найдено клиентов: ${filteredClients.length}`
                  : "Совпадений по ФИО или телефону нет"
                : `Всего клиентов: ${clients.length}`}
            </div>
          </div>

          <label className="course-field">
            <span>Курс из прайса</span>
            <select
              value={serviceId}
              onChange={(event) => {
                setServiceId(event.target.value)
                setInitialUsedLessons(0)
              }}
            >
              <option value="">Выберите курс</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.title} — {service.price} грн
                </option>
              ))}
            </select>
          </label>

          {selectedService && (
            <div className="course-payment-choice">
              <span>Оплата курса</span>
              <div>
                <button
                  type="button"
                  className={paymentMode === "FULL" ? "active" : ""}
                  onClick={() => setPaymentMode("FULL")}
                >
                  <CheckCircle2 size={16} />
                  Полностью
                  <small>
                    {legacyImported
                      ? "Был полностью оплачен до переноса"
                      : `${Number(selectedService.price || 0).toFixed(0)} грн до скидки`}
                  </small>
                </button>
                <button
                  type="button"
                  className={paymentMode === "HALF" ? "active" : ""}
                  onClick={() => setPaymentMode("HALF")}
                >
                  <CreditCard size={16} />
                  Половина
                  <small>
                    {legacyImported
                      ? "Была оплачена только первая половина"
                      : "Откроется 1/2 занятий"}
                  </small>
                </button>
              </div>
            </div>
          )}

          <div className={legacyImported ? "course-legacy-box active" : "course-legacy-box"}>
            <label className="course-legacy-toggle">
              <input
                type="checkbox"
                checked={legacyImported}
                onChange={(event) => {
                  setLegacyImported(event.target.checked)
                  setInitialUsedLessons(0)
                }}
              />
              <span>
                <History size={17} />
                <strong>Курс был куплен ранее</strong>
                <small>Для переноса существующего клиента. Новая выручка: 0 грн.</small>
              </span>
            </label>

            {legacyImported && (
              <label className="course-field course-used-lessons-field">
                <span>Уже пройдено занятий</span>
                <input
                  type="number"
                  min="0"
                  max={Number(selectedService?.packageSessions || 0)}
                  step="1"
                  disabled={!selectedService}
                  value={initialUsedLessons}
                  onChange={(event) => setInitialUsedLessons(event.target.value)}
                  placeholder="0"
                />
                <small>
                  {selectedService
                    ? `Всего в курсе ${selectedService.packageSessions} · останется ${Math.max(
                        0,
                        Number(selectedService.packageSessions || 0) - Number(initialUsedLessons || 0),
                      )}`
                    : "Сначала выберите курс из прайса"}
                </small>
              </label>
            )}
          </div>

          {(selectedClient || selectedService) && (
            <div className="course-order-preview">
              <span>Предпросмотр оформления</span>
              <strong>{selectedClient?.fullName || "Клиент не выбран"}</strong>
              <p>{selectedService?.title || "Выберите курс из прайса"}</p>
              {selectedService && (
                <>
                  <b>
                    {legacyImported
                      ? "0 грн новой выручки"
                      : paymentMode === "HALF"
                        ? `${(Number(selectedService.price || 0) / 2).toFixed(0)} грн сейчас`
                        : `${selectedService.price} грн`}
                  </b>
                  {!legacyImported && paymentMode === "HALF" && (
                    <small className="course-half-preview-note">
                      Половинная оплата · после использования половины занятий потребуется доплата.
                    </small>
                  )}
                  {legacyImported && (
                    <small className="course-legacy-preview-note">
                      {paymentMode === "HALF"
                        ? "До переноса была оплачена только половина курса"
                        : "Курс был полностью оплачен до переноса"}
                      {" · "}
                      {Number(initialUsedLessons || 0)}/{selectedService.packageSessions} использовано
                    </small>
                  )}
                </>
              )}
            </div>
          )}

          <button className="course-create-button" onClick={create}>
            {legacyImported ? <History size={18} /> : <CreditCard size={18} />}
            {legacyImported
              ? paymentMode === "HALF"
                ? "Перенести курс · оплачено 1/2"
                : "Перенести курс · оплачен полностью"
              : paymentMode === "HALF"
                ? "Оформить с оплатой 1/2"
                : "Оформить и оплатить полностью"}
          </button>

          <div className="course-discount-note">
            <CheckCircle2 size={18} />
            <p>
              Военным — скидка 20% на курс, пенсионерам — 15%. Если применимы обе категории,
              используется большая скидка.
            </p>
          </div>
        </section>

        <section className="client-courses-panel">
          <div className="course-panel-heading">
            <span>02</span>
            <div>
              <h2>Активные курсы</h2>
              <p>Прогресс использования по каждому клиенту.</p>
            </div>
          </div>

          <div className="client-course-list">
            {courses.length === 0 && (
              <div className="courses-empty">
                Пока нет оформленных курсов.
              </div>
            )}

            {courses.map((course) => {
              const total = Math.max(1, Number(course.totalLessons) || 1)
              const used = Math.min(total, Math.max(0, Number(course.usedLessons) || 0))
              const remaining = Math.max(0, total - used)
              const progress = Math.min(100, Math.round((used / total) * 100))

              return (
                <article className="client-course-card" key={course.id}>
                  <div className="client-course-top">
                    <div>
                      <div className="client-course-label-row">
                        <span className="client-course-label">КУРС</span>
                        {course.legacyImported && (
                          <span className="course-legacy-badge">ПЕРЕНЕСЁН</span>
                        )}
                        {!course.legacyImported && course.paymentState === "HALF_PAID" && (
                          <span className="course-half-paid-badge">ОПЛАЧЕНО 1/2</span>
                        )}
                        {!course.legacyImported && course.paymentState === "PAID" && (
                          <span className="course-paid-badge">ОПЛАЧЕНО</span>
                        )}
                      </div>
                      <h3>{course.title}</h3>
                    </div>
                    <strong>{remaining}</strong>
                  </div>

                  <div className="client-course-person">
                    {course.client?.fullName || "Клиент"}
                  </div>

                  <div className="course-progress-meta">
                    <span>{used}/{total} использовано</span>
                    <span>{remaining} осталось</span>
                  </div>

                  <div className="course-progress" aria-label={`Использовано ${progress}%`}>
                    <span style={{ width: `${progress}%` }} />
                  </div>

                  {course.paymentState === "HALF_PAID" && (
                    <div className="course-half-access-note">
                      <LockKeyhole size={14} />
                      <span>
                        До доплаты доступно {Math.ceil(total / 2)} занятий ·
                        использовано {used}/{Math.ceil(total / 2)}
                      </span>
                    </div>
                  )}

                  <div className="client-course-footer">
                    <div className="client-course-price">
                      <span>
                        {course.legacyImported ? "Новая выручка" : "Цена"}{" "}
                        <strong>{course.price} грн</strong>
                      </span>
                      {!course.legacyImported && (
                        <span className="course-paid-amount">
                          Оплачено {Number(course.paidAmount || 0).toFixed(0)} / {Number(course.price || 0).toFixed(0)} грн
                        </span>
                      )}
                      {course.discountPercent > 0 && (
                        <span className="course-discount-badge">
                          −{course.discountPercent}%
                        </span>
                      )}
                    </div>

                    {course.paymentState === "HALF_PAID" && (
                      <button
                        type="button"
                        className="course-complete-payment-button"
                        disabled={settlingCourseId === course.id}
                        onClick={() => completeCoursePayment(course)}
                      >
                        <CreditCard size={15} />
                        <span>
                          {settlingCourseId === course.id
                            ? "Сохраняем…"
                            : `Доплачено? +${Math.max(
                                0,
                                Number(course.price || 0) - Number(course.paidAmount || 0),
                              ).toFixed(0)} грн`}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      className="course-delete-button"
                      disabled={deletingCourseId === course.id || used > 0}
                      onClick={() => removeCourse(course)}
                      title={
                        used > 0
                          ? "Курс уже использовался и защищён от удаления"
                          : "Удалить ошибочно созданный курс"
                      }
                      aria-label={`Удалить курс ${course.title}`}
                    >
                      <Trash2 size={15} />
                      <span>{deletingCourseId === course.id ? "Удаляем…" : "Удалить"}</span>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
