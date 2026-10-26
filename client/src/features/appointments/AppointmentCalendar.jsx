import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ruLocale from '@fullcalendar/core/locales/ru'
import { useEffect, useState } from 'react'
import { appointmentApi } from './appointment.api'
import CreateAppointmentModal from './CreateAppointmentModal'
import AppointmentDetailsModal from './AppointmentDetailsModal'
import './AppointmentCalendar.css'
import { formatCenterDateTime, toCenterCalendarTime } from "../../utils/centerTime"

const DEFAULT_SPECIALIST_COLOR = '#d2a71f'

function normalizeHexColor(value) {
  if (typeof value !== 'string') return DEFAULT_SPECIALIST_COLOR
  const color = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(color)) return color
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
  }
  return DEFAULT_SPECIALIST_COLOR
}

function hexToRgba(hex, alpha) {
  const value = normalizeHexColor(hex).slice(1)
  const red = Number.parseInt(value.slice(0, 2), 16)
  const green = Number.parseInt(value.slice(2, 4), 16)
  const blue = Number.parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

function visualFor(appointment) {
  if (appointment.status === 'COMPLETED') {
    return {
      backgroundColor: 'rgba(107, 114, 128, .28)',
      borderColor: '#8b929d',
      textColor: '#f7f7f5',
      classNames: ['dorsum-status-completed'],
    }
  }

  if (appointment.status === 'CANCELLED') {
    return {
      backgroundColor: 'rgba(255, 255, 255, .92)',
      borderColor: '#ffffff',
      textColor: '#111411',
      classNames: ['dorsum-status-cancelled'],
    }
  }

  const specialistColor = normalizeHexColor(appointment.specialist?.color)

  if (appointment.status === 'NOT_COMPLETED') {
    return {
      // Preserve specialist identity even for a missed/not-completed record.
      // Status is communicated by the red rail/class, not by replacing the
      // entire specialist colour.
      backgroundColor: hexToRgba(specialistColor, 0.26),
      borderColor: '#9d4c4c',
      textColor: '#fafaf7',
      classNames: ['dorsum-status-missed'],
    }
  }

  return {
    backgroundColor: hexToRgba(specialistColor, 0.26),
    borderColor: specialistColor,
    textColor: '#fafaf7',
    classNames: ['dorsum-status-scheduled'],
  }
}

function useCalendarViewport() {
  const getMode = () => {
    if (window.innerWidth <= 640) return 'phone'
    if (window.innerWidth <= 1024) return 'tablet'
    return 'desktop'
  }

  const [viewport, setViewport] = useState(getMode)

  useEffect(() => {
    const onResize = () => setViewport(getMode())
    window.addEventListener('resize', onResize, { passive: true })
    return () => window.removeEventListener('resize', onResize)
  }, [])

  return viewport
}

function capitalize(value) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

function formatDayHeader(date) {
  const weekday = capitalize(new Intl.DateTimeFormat('ru-RU', { weekday: 'long' }).format(date))
  const compactDate = new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
  }).format(date)

  return { weekday, compactDate }
}


function normalizeCalendarSlotStart(date, slotMinutes = 30) {
  const normalized = new Date(date)
  const minutes = normalized.getMinutes()
  normalized.setMinutes(Math.floor(minutes / slotMinutes) * slotMinutes, 0, 0)
  return normalized
}

function calendarWallParts(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return { localDate: "", localTime: "" }
  }

  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const dd = String(date.getDate()).padStart(2, "0")
  const hh = String(date.getHours()).padStart(2, "0")
  const min = String(date.getMinutes()).padStart(2, "0")

  return {
    localDate: `${yyyy}-${mm}-${dd}`,
    localTime: `${hh}:${min}`,
  }
}

function appointmentDurationMinutes(event) {
  if (!event.start || !event.end) return 60
  return Math.max(1, Math.round((event.end.getTime() - event.start.getTime()) / 60000))
}

function CalendarEventContent({ arg }) {
  const appointment = arg.event.extendedProps.appointment
  const duration = appointmentDurationMinutes(arg.event)
  const compact = duration <= 30

  const clientName = appointment.client?.fullName || 'Клиент'
  const serviceTitle = appointment.course?.title || appointment.service?.title || 'Занятие'
  const specialistName = appointment.specialist?.fullName || 'Специалист'

  return (
    <div
      className={[
        'dorsum-event-card',
        compact ? 'is-short' : '',
        appointment.paymentStatus === 'PAID' ? 'is-paid' : '',
        appointment.status === 'COMPLETED' || appointment.status === 'CANCELLED' ? 'has-status' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="dorsum-event-topline">
        <span className="dorsum-event-time">{arg.timeText}</span>
        <span className="dorsum-event-badges">
          {appointment.status === 'COMPLETED' && (
            <span className="dorsum-status-badge" title="Проведено">✓</span>
          )}
          {appointment.status === 'CANCELLED' && (
            <span className="dorsum-status-badge" title="Отменено">×</span>
          )}
          {appointment.status === 'NOT_COMPLETED' && (
            <span className="dorsum-status-badge dorsum-missed-badge" title="Не проведено">!</span>
          )}
          {appointment.paymentStatus === 'PAID' && (
            <span className="dorsum-paid-badge" title="Оплачено">$</span>
          )}
        </span>
      </div>

      <strong className="dorsum-event-client" title={clientName}>{clientName}</strong>
      <span className="dorsum-event-service" title={serviceTitle}>{serviceTitle}</span>
      <span className="dorsum-event-specialist" title={specialistName}>{specialistName}</span>
    </div>
  )
}

export default function AppointmentCalendar({ mode = 'admin' }) {
  const [events, setEvents] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedAppointment, setSelectedAppointment] = useState(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [clickedAppointment, setClickedAppointment] = useState(null)
  const [moveError, setMoveError] = useState("")
  const [movingAppointmentId, setMovingAppointmentId] = useState("")
  const viewport = useCalendarViewport()

  const isPhone = viewport === 'phone'
  const isTablet = viewport === 'tablet'

  useEffect(() => {
    loadAppointments()
  }, [])

  async function loadAppointments() {
    const response = mode === 'specialist'
      ? await appointmentApi.getMy()
      : await appointmentApi.getAll()

    setEvents(response.data.map((appointment) => ({
      id: appointment.id,
      title: appointment.client?.fullName || 'Занятие',
      start: toCenterCalendarTime(appointment.startTime),
      end: toCenterCalendarTime(appointment.endTime),
      ...visualFor(appointment),
      editable:
        mode === 'admin' &&
        appointment.status === 'SCHEDULED',
      extendedProps: { appointment },
    })))
  }

  const handleDateClick = (info) => {
    // Only ADMIN can create appointments. Specialists use the calendar
    // exclusively to view/open existing appointments.
    if (mode !== 'admin') return

    // FullCalendar may report a 15-minute snap position (for example 11:45)
    // even though the visible grid is divided into 30-minute rows.
    // For click-to-create UX, the whole visible row belongs to its start time.
    setSelectedDate(normalizeCalendarSlotStart(info.date, 30))
    setModalOpen(true)
  }

  const handleEventAllow = (dropInfo, draggedEvent) => {
    if (mode !== 'admin') return false

    const appointment = draggedEvent.extendedProps.appointment
    if (!appointment || appointment.status !== 'SCHEDULED') return false

    // Source appointment may already be earlier today / overdue.
    // Only the target slot must be in the future.
    return dropInfo.start && dropInfo.start.getTime() > Date.now()
  }

  const handleEventDrop = async (info) => {
    if (mode !== 'admin') {
      info.revert()
      return
    }

    const appointment = info.event.extendedProps.appointment
    if (!appointment || appointment.status !== 'SCHEDULED') {
      info.revert()
      return
    }

    const { localDate, localTime } = calendarWallParts(info.event.start)
    if (!localDate || !localTime) {
      info.revert()
      setMoveError("Не удалось определить новое время занятия.")
      return
    }

    setMovingAppointmentId(appointment.id)
    setMoveError("")

    try {
      await appointmentApi.move(appointment.id, { localDate, localTime })
      await loadAppointments()
    } catch (error) {
      info.revert()

      const code = error.response?.data?.message
      const messages = {
        CLIENT_TIME_SLOT_BUSY: "У клиента уже есть другое занятие в выбранное время.",
        TIME_SLOT_BUSY: "У специалиста уже есть другое занятие в выбранное время.",
        SPECIALIST_UNAVAILABLE: "Специалист отметил выбранное время как недоступное.",
        GROUP_SESSION_FULL: "Групповое занятие в выбранном слоте уже заполнено.",
        ONLY_SCHEDULED_CAN_MOVE: "Переносить можно только запланированные занятия.",
        PAST_APPOINTMENT_CANNOT_MOVE: "Уже начавшееся или прошлое занятие переносить нельзя.",
        MOVE_TARGET_IN_PAST: "Нельзя перенести занятие на прошедшее время.",
        CLIENT_ARCHIVED: "Этот клиент архивирован и не может быть перенесён на новый слот.",
        SPECIALIST_ARCHIVED: "Этот специалист архивирован и не может быть перенесён на новый слот.",
      }

      setMoveError(messages[code] || code || "Не удалось перенести занятие.")
    } finally {
      setMovingAppointmentId("")
    }
  }

  const handleEventClick = (info) => {
    const appointment = info.event.extendedProps.appointment
    if (mode === 'admin') {
      setClickedAppointment(appointment)
      setActionModalOpen(true)
    } else {
      setSelectedAppointment(appointment)
      setDetailsOpen(true)
    }
  }

  const openAppointmentDetails = () => {
    setSelectedAppointment(clickedAppointment)
    setDetailsOpen(true)
    setActionModalOpen(false)
  }

  const createAtSameTime = () => {
    const wallTime = toCenterCalendarTime(clickedAppointment.startTime)
    setSelectedDate(new Date(wallTime))
    setModalOpen(true)
    setActionModalOpen(false)
  }

  return (
    <div className="dorsum-calendar-shell">
      {mode === 'admin' && (
        <div className="dorsum-calendar-actions">
          <button
            className="dorsum-calendar-create"
            onClick={() => {
              setSelectedDate(new Date())
              setModalOpen(true)
            }}
          >
            <span>+</span>
            Создать занятие
          </button>
          <div className="dorsum-calendar-legend" aria-label="Легенда расписания">
            <span><i className="legend-dot scheduled" /> Запланировано</span>
            <span><i className="legend-dot completed" /> Проведено</span>
            <span><i className="legend-dot cancelled" /> Отменено</span>
            <span><b>$</b> Оплачено</span>
          </div>
        </div>
      )}

      {mode === 'admin' && (
        <div className="dorsum-calendar-edit-hint">
          <strong>Быстрый перенос:</strong>
          <span>зажмите будущее запланированное занятие и перетащите его на нужную дату/время.</span>
        </div>
      )}

      {moveError && mode === 'admin' && (
        <div className="dorsum-calendar-move-error" role="alert">
          <span>{moveError}</span>
          <button type="button" onClick={() => setMoveError("")} aria-label="Закрыть">×</button>
        </div>
      )}

      {movingAppointmentId && mode === 'admin' && (
        <div className="dorsum-calendar-moving-note" aria-live="polite">
          Проверяем новый слот…
        </div>
      )}

      <div className="dorsum-calendar-frame">
        <FullCalendar
          plugins={[timeGridPlugin, interactionPlugin]}
          initialView={isPhone ? 'timeGridDay' : 'timeGridWeek'}
          events={events}
          editable={mode === 'admin'}
          eventStartEditable={mode === 'admin'}
          eventDurationEditable={false}
          eventLongPressDelay={350}
          eventDragMinDistance={5}
          eventAllow={mode === 'admin' ? handleEventAllow : undefined}
          eventDrop={mode === 'admin' ? handleEventDrop : undefined}
          dateClick={mode === 'admin' ? handleDateClick : undefined}
          eventClick={handleEventClick}
          eventContent={(arg) => <CalendarEventContent arg={arg} />}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dayHeaderContent={(arg) => {
            const header = formatDayHeader(arg.date)
            return (
              <div className="dorsum-day-header">
                <span>{header.weekday}</span>
                <strong>{header.compactDate}</strong>
              </div>
            )
          }}
          slotLabelContent={(arg) => (
            <span className="dorsum-time-label">
              {new Intl.DateTimeFormat('ru-RU', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }).format(arg.date)}
            </span>
          )}
          slotDuration="00:30:00"
          slotLabelInterval="00:30:00"
          snapDuration="00:30:00"
          slotMinTime="07:00:00"
          slotMaxTime="20:30:00"
          scrollTime="07:00:00"
          scrollTimeReset={false}
          slotEventOverlap={false}
          eventOrder="start,-duration,title"
          eventOrderStrict
          nowIndicator
          allDaySlot={false}
          expandRows={!isPhone}
          stickyHeaderDates
          handleWindowResize
          eventLongPressDelay={180}
          selectLongPressDelay={180}
          // On mobile FullCalendar must own the vertical scroll area.
          // `auto` expanded the full 08:00–21:00 grid, while the dashboard
          // viewport clipped its lower part and left no scrollable element.
          height={isPhone ? '72dvh' : isTablet ? '78vh' : '82vh'}
          contentHeight={undefined}
          headerToolbar={{
            left: 'prev,next',
            center: 'title',
            right: isPhone ? 'today' : 'today,timeGridDay,timeGridWeek',
          }}
          buttonText={{
            today: 'Сегодня',
            day: 'День',
            week: 'Неделя',
          }}
          titleFormat={isPhone
            ? { day: '2-digit', month: 'long', year: 'numeric' }
            : { month: 'long', year: 'numeric' }}
          locale={ruLocale}
          firstDay={1}
        />
      </div>

      {mode === 'admin' && (
        <CreateAppointmentModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          selectedDate={selectedDate}
          onCreated={loadAppointments}
        />
      )}

      <AppointmentDetailsModal
        open={detailsOpen}
        appointment={selectedAppointment}
        onClose={() => setDetailsOpen(false)}
        onDeleted={loadAppointments}
        onUpdated={loadAppointments}
        mode={mode}
      />

      {actionModalOpen && clickedAppointment && (
        <div className="dorsum-calendar-action-backdrop" onClick={() => setActionModalOpen(false)}>
          <div className="dorsum-calendar-action-modal" onClick={(event) => event.stopPropagation()}>
            <p>ВЫБЕРИТЕ ДЕЙСТВИЕ</p>
            <h3>{clickedAppointment.client.fullName}</h3>
            <span>
              {formatCenterDateTime(clickedAppointment.startTime, 'ru-RU', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
            <button className="primary" onClick={openAppointmentDetails}>Открыть занятие</button>
            <button className="secondary" onClick={createAtSameTime}>Создать занятие на это же время</button>
          </div>
        </div>
      )}
    </div>
  )
}
