import { AppointmentRepository } from './appointment.repository.js'
import { prisma } from '../../config/prisma.js'
import { fixedPayFor, payConfigFor } from '../payroll/pay-snapshot.js'
import { discountFor, discountedPrice } from '../finance/pricing.js'
import { centerWallRange } from '../../utils/center-time.js'
//import { FastifyError } from 'fastify'

export const AppointmentService = {
  
  async create(dto) {

    // A course is the source of truth for its service. The browser does not
    // choose a second service when a course is selected.
    let bookingCourse = dto.courseId
      ? await prisma.course.findUnique({
          where: { id: dto.courseId },
          include: { service: true },
        })
      : null

    if (dto.courseId && (!bookingCourse || bookingCourse.voidedAt)) {
      throw new Error("Course not found")
    }

    const resolvedServiceId = bookingCourse?.serviceId || dto.serviceId
    let service = bookingCourse?.service || await prisma.service.findUnique({
      where: { id: resolvedServiceId }
    })

    if (!service || (!dto.courseId && (!service.active || service.isPackage))) {
      throw new Error("Service not found")
    }

    const duration = Number(dto.duration || service.durationMinutes)
    if (!Number.isInteger(duration) || duration < 5 || duration > 480) throw Object.assign(new Error("INVALID_DURATION"), { statusCode: 400 })

    // Preferred contract: the browser sends the centre wall-clock date/time,
    // and only the backend decides which UTC instant that means.
    // Legacy startTime remains as a fallback for older clients during rollout.
    let start
    let end

    if (dto.localDate && dto.localTime) {
      const range = centerWallRange(dto.localDate, dto.localTime, duration)
      start = range.start
      end = range.end
    } else {
      start = new Date(dto.startTime)
      end = new Date(start.getTime() + duration * 60000)
    }

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Invalid date")
    }

    const client = await prisma.clientProfile.findUnique({
      where: { id: dto.clientId },
      include: { user: { select: { active: true } } },
    })
    if (!client) throw new Error("Client not found")
    if (client.active === false || client.user?.active === false) {
      const error = new Error("CLIENT_ARCHIVED")
      error.statusCode = 409
      throw error
    }

    const specialist = await prisma.specialistProfile.findUnique({
      where: { id: dto.specialistId },
      include: { user: { select: { active: true } } },
    })
    if (!specialist) throw new Error("Specialist not found")
    if (specialist.user?.active === false) {
      const error = new Error("SPECIALIST_ARCHIVED")
      error.statusCode = 409
      throw error
    }

    if (client.userId && client.userId === specialist.userId) throw Object.assign(new Error('Клиент и специалист не могут быть одним аккаунтом.'), { statusCode: 409 })
    return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      if (dto.courseId) {
        bookingCourse = await tx.course.findUnique({ where: { id: dto.courseId }, include: { service: true } })
        if (!bookingCourse?.service) throw new Error('Course service is unavailable')
        service = bookingCourse.service
      }

      /*const conflicts = await tx.appointment.findMany({
        where: {
          specialistId: dto.specialistId,
          startTime: { lt: end },
          endTime: { gt: start }
        }
      })*/
      // Serialize both client and specialist resources for this slot.
      // The deterministic order avoids deadlocks and prevents two concurrent
      // requests from booking the same client with different specialists.
      const bookingLockKeys = [
        `client:${dto.clientId}:${start.toISOString()}:${end.toISOString()}`,
        `specialist:${dto.specialistId}:${start.toISOString()}:${end.toISOString()}`,
      ].sort()

      for (const key of bookingLockKeys) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
      }

      // A client can never be in two overlapping appointments, even if both
      // services are group-enabled.
      const clientConflict = await tx.appointment.findFirst({
        where: {
          clientId: dto.clientId,
          status: { not: "CANCELLED" },
          startTime: { lt: end },
          endTime: { gt: start }
        }
      })

      if (clientConflict) {
        const error = new Error("CLIENT_TIME_SLOT_BUSY")
        error.statusCode = 409
        throw error
      }

      const specialistConflicts = await tx.appointment.findMany({
        where: {
          specialistId: dto.specialistId,
          status: { not: "CANCELLED" },
          startTime: { lt: end },
          endTime: { gt: start }
        },
        select: {
          id: true,
          serviceId: true,
          startTime: true,
          endTime: true,
          payConfig: true,
          specialistPay: true,
        }
      })

      const blocked = await tx.specialistBlock.findFirst({
        where: { specialistId: dto.specialistId, startTime: { lt: end }, endTime: { gt: start } }
      })
      if (blocked) {
        const error = new Error("SPECIALIST_UNAVAILABLE")
        error.statusCode = 409
        throw error
      }

      if (specialistConflicts.length > 0) {
        // Individual services always block overlapping appointments.
        if (!service.groupAllowed) {
          const error = new Error("TIME_SLOT_BUSY")
          error.statusCode = 409
          throw error
        }

        // A group participant may join only the exact same group session.
        // Partial overlaps and another service still block the specialist.
        const sameGroupSession = specialistConflicts.every((appointment) =>
          appointment.serviceId === service.id &&
          appointment.startTime.getTime() === start.getTime() &&
          appointment.endTime.getTime() === end.getTime()
        )

        if (!sameGroupSession) {
          const error = new Error("TIME_SLOT_BUSY")
          error.statusCode = 409
          throw error
        }

        const capacity = Number(service.maxClients || 1)
        if (specialistConflicts.length >= capacity) {
          const error = new Error("GROUP_SESSION_FULL")
          error.statusCode = 409
          throw error
        }
      }

      let paymentStatus = "PENDING"

      if (dto.courseId) {
        const course = await tx.course.findUnique({
          where: { id: dto.courseId }
        })

        if (!course || course.voidedAt) {
          throw new Error("Course not found")
        }

        if (course.clientId !== dto.clientId) {
          throw new Error("Course does not belong to this client")
        }

        if (!course.serviceId || course.serviceId !== service.id) {
          throw new Error("Course service is unavailable")
        }

        if (course.paymentState === "UNPAID") {
          const error = new Error("COURSE_NOT_PAID")
          error.statusCode = 409
          throw error
        }

        const paymentLessonLimit = course.paymentState === "HALF_PAID"
          ? Math.ceil(Number(course.totalLessons) / 2)
          : Number(course.totalLessons)

        if (course.usedLessons >= paymentLessonLimit) {
          const error = new Error(
            course.paymentState === "HALF_PAID"
              ? "COURSE_SECOND_HALF_PAYMENT_REQUIRED"
              : "Course lessons are finished"
          )
          error.statusCode = 409
          throw error
        }

        if (course.usedLessons >= course.totalLessons) {
          const error = new Error("Course lessons are finished")
          error.statusCode = 409
          throw error
        }

        if (course.expiresAt && course.expiresAt < new Date()) {
          throw new Error("Course expired")
        }

        paymentStatus = "PAID"

        await tx.course.update({
          where: { id: dto.courseId },
          data: {
            usedLessons: {
              increment: 1
            }
          }
        })
      }

      const discount = discountFor(client, false)
      const appointmentPrice = dto.courseId ? 0 : discountedPrice(service.price, discount.percent)
      const firstGroupMember = specialistConflicts[0]
      const payConfig = bookingCourse?.payConfig || payConfigFor(service)
      let specialistPay = dto.courseId
        ? (bookingCourse?.specialistPayPerSession ?? fixedPayFor(service, Number(bookingCourse?.price || 0) / Math.max(1, Number(bookingCourse?.totalLessons || 1))))
        : fixedPayFor(service, appointmentPrice)
      if (firstGroupMember?.payConfig?.isGroup) {
        payConfig.groupPayMode = firstGroupMember.payConfig.groupPayMode
        payConfig.isGroup = true
        if (payConfig.groupPayMode === 'PER_SESSION') { Object.assign(payConfig, firstGroupMember.payConfig); specialistPay = firstGroupMember.specialistPay }
      }
      const appointment = await tx.appointment.create({
        data: {
          clientId: dto.clientId,
          specialistId: dto.specialistId,
          serviceId: resolvedServiceId,
          startTime: start,
          endTime: end,
          duration,
          price: appointmentPrice,
          basePrice: service.price,
          discountPercent: dto.courseId ? 0 : discount.percent,
          discountReason: dto.courseId ? null : discount.reason,
          specialistPay,
          payConfig,
          status: "SCHEDULED",
          roomId: dto.roomId || null,
          courseId: dto.courseId || null,
          paymentStatus,
          paidAt: paymentStatus === "PAID" ? null : null
        }
      })

      return appointment
    })
  },

  async getAll() {
  return prisma.appointment.findMany({
    include: {
      client: true,
      specialist: true,
      service: true,
      course: true
    },
    orderBy: {
      startTime: "asc"
    }
  })
},

async getMyAppointments(userId) {
  const specialist = await prisma.specialistProfile.findUnique({
    where: {
      userId
    }
  })

  if (!specialist) {
    throw new Error("Specialist profile not found")
  }

  return prisma.appointment.findMany({
    where: {
      specialistId: specialist.id
    },
    include: {
      client: { select: { id: true, fullName: true, phone: true } },
      specialist: { select: { id: true, fullName: true, color: true } },
      service: true,
      course: true
    },
    orderBy: {
      startTime: "asc"
    }
  })
},

async delete(id) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
    const existing = await tx.appointment.findUnique({ where: { id } })
    if (!existing) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
    if (!existing.courseId && existing.paymentStatus === 'PAID') throw Object.assign(new Error('Сначала оформите возврат/исправление оплаты. Оплаченную запись нельзя удалить.'), { statusCode: 409 })
    await tx.appointment.delete({ where: { id } })
    if (existing.courseId) await tx.course.updateMany({ where: { id: existing.courseId, usedLessons: { gt: 0 } }, data: { usedLessons: { decrement: 1 } } })
    return { message: 'Appointment deleted' }
  })
},

async syncPastStatuses() {
  // Appointment status must never be inferred from payment status or current time.
  // A paid appointment can still be cancelled/missed, and an unpaid appointment
  // can be successfully completed. Status changes are explicit user actions.
  return { updated: 0 }
},

async editScheduled(id, dto) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
    const appointment = await tx.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        course: true,
        client: { include: { user: { select: { active: true } } } },
      },
    })

    if (!appointment) {
      throw Object.assign(new Error("Appointment not found"), { statusCode: 404 })
    }
    if (appointment.status !== "SCHEDULED") {
      throw Object.assign(new Error("ONLY_SCHEDULED_CAN_EDIT"), { statusCode: 409 })
    }
    if (appointment.client?.active === false || appointment.client?.user?.active === false) {
      throw Object.assign(new Error("CLIENT_ARCHIVED"), { statusCode: 409 })
    }

    const requestedCourseId = dto?.courseId ? String(dto.courseId) : null
    const requestedServiceId = dto?.serviceId ? String(dto.serviceId) : null

    // Resolve what the edited appointment represents. Course is authoritative:
    // when courseId is supplied, serviceId from the browser is ignored.
    let targetCourse = null
    let targetService = null

    if (requestedCourseId) {
      targetCourse = await tx.course.findUnique({
        where: { id: requestedCourseId },
        include: { service: true },
      })

      if (!targetCourse || targetCourse.voidedAt) {
        throw Object.assign(new Error("COURSE_NOT_FOUND"), { statusCode: 404 })
      }
      if (targetCourse.clientId !== appointment.clientId) {
        throw Object.assign(new Error("COURSE_WRONG_CLIENT"), { statusCode: 409 })
      }
      if (!targetCourse.serviceId || !targetCourse.service) {
        throw Object.assign(new Error("COURSE_SERVICE_UNAVAILABLE"), { statusCode: 409 })
      }
      if (targetCourse.paymentState === "UNPAID") {
        throw Object.assign(new Error("COURSE_NOT_PAID"), { statusCode: 409 })
      }
      if (targetCourse.expiresAt && targetCourse.expiresAt < new Date()) {
        throw Object.assign(new Error("COURSE_EXPIRED"), { statusCode: 409 })
      }

      // Moving an existing course appointment inside the same course consumes
      // no additional lesson. Switching into another/new course consumes one.
      const switchingIntoCourse = appointment.courseId !== targetCourse.id
      if (switchingIntoCourse) {
        const paymentLessonLimit = targetCourse.paymentState === "HALF_PAID"
          ? Math.ceil(Number(targetCourse.totalLessons) / 2)
          : Number(targetCourse.totalLessons)

        if (Number(targetCourse.usedLessons) >= paymentLessonLimit) {
          throw Object.assign(
            new Error(
              targetCourse.paymentState === "HALF_PAID"
                ? "COURSE_SECOND_HALF_PAYMENT_REQUIRED"
                : "COURSE_LESSONS_FINISHED"
            ),
            { statusCode: 409 },
          )
        }
      }

      targetService = targetCourse.service
    } else {
      const effectiveServiceId = requestedServiceId || appointment.serviceId
      targetService = await tx.service.findUnique({ where: { id: effectiveServiceId } })

      if (!targetService || targetService.isPackage || (!targetService.active && targetService.id !== appointment.serviceId)) {
        throw Object.assign(new Error("SERVICE_NOT_AVAILABLE"), { statusCode: 409 })
      }
    }

    const changingCourse = appointment.courseId !== (targetCourse?.id || null)
    const changingService = appointment.serviceId !== targetService.id

    // Never silently rewrite already-booked one-off cash into another service/course.
    // Admin can first correct its payment status to PENDING, then edit safely.
    if (
      appointment.paymentStatus === "PAID" &&
      !appointment.courseId &&
      (changingService || Boolean(targetCourse))
    ) {
      throw Object.assign(
        new Error("PAID_ONE_OFF_MUST_BE_PENDING_BEFORE_SERVICE_CHANGE"),
        { statusCode: 409 },
      )
    }

    const specialistId = String(dto?.specialistId || appointment.specialistId)
    const duration = Number(
      dto?.duration ||
      (changingService ? targetService.durationMinutes : appointment.duration) ||
      targetService.durationMinutes
    )

    if (![30, 60, 90, 120].includes(duration)) {
      throw Object.assign(new Error("INVALID_DURATION"), { statusCode: 400 })
    }

    const specialist = await tx.specialistProfile.findUnique({
      where: { id: specialistId },
      include: { user: { select: { active: true } } },
    })
    if (!specialist || specialist.user?.active === false) {
      throw Object.assign(new Error("SPECIALIST_NOT_AVAILABLE"), { statusCode: 409 })
    }

    let start = appointment.startTime
    if (dto?.localDate && dto?.localTime) {
      start = centerWallRange(String(dto.localDate), String(dto.localTime), duration).start
    }
    const end = new Date(start.getTime() + duration * 60000)

    // An overdue SCHEDULED record may still have its service/course corrected
    // in place. A *changed* target date/time, however, must not move backwards
    // into the past.
    const timeChanged = start.getTime() !== appointment.startTime.getTime()
    if (timeChanged && start <= new Date()) {
      throw Object.assign(new Error("MOVE_TARGET_IN_PAST"), { statusCode: 409 })
    }

    const lockKeys = [
      `client:${appointment.clientId}:${start.toISOString()}:${end.toISOString()}`,
      `specialist:${specialistId}:${start.toISOString()}:${end.toISOString()}`,
      ...(appointment.courseId ? [`course:${appointment.courseId}`] : []),
      ...(targetCourse?.id ? [`course:${targetCourse.id}`] : []),
    ].sort()

    for (const key of [...new Set(lockKeys)]) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    }

    // Re-read target course after lock so lesson/payment capacity cannot race.
    if (targetCourse && appointment.courseId !== targetCourse.id) {
      targetCourse = await tx.course.findUnique({
        where: { id: targetCourse.id },
        include: { service: true },
      })

      if (!targetCourse || targetCourse.voidedAt) {
        throw Object.assign(new Error("COURSE_NOT_FOUND"), { statusCode: 404 })
      }

      const paymentLessonLimit = targetCourse.paymentState === "HALF_PAID"
        ? Math.ceil(Number(targetCourse.totalLessons) / 2)
        : Number(targetCourse.totalLessons)

      if (targetCourse.paymentState === "UNPAID") {
        throw Object.assign(new Error("COURSE_NOT_PAID"), { statusCode: 409 })
      }
      if (Number(targetCourse.usedLessons) >= paymentLessonLimit) {
        throw Object.assign(
          new Error(
            targetCourse.paymentState === "HALF_PAID"
              ? "COURSE_SECOND_HALF_PAYMENT_REQUIRED"
              : "COURSE_LESSONS_FINISHED"
          ),
          { statusCode: 409 },
        )
      }

      targetService = targetCourse.service
    }

    const clientConflict = await tx.appointment.findFirst({
      where: {
        id: { not: appointment.id },
        clientId: appointment.clientId,
        status: { not: "CANCELLED" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    })
    if (clientConflict) {
      throw Object.assign(new Error("CLIENT_TIME_SLOT_BUSY"), { statusCode: 409 })
    }

    const blocked = await tx.specialistBlock.findFirst({
      where: {
        specialistId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    })
    if (blocked) {
      throw Object.assign(new Error("SPECIALIST_UNAVAILABLE"), { statusCode: 409 })
    }

    const conflicts = await tx.appointment.findMany({
      where: {
        id: { not: appointment.id },
        specialistId,
        status: { not: "CANCELLED" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true, serviceId: true, startTime: true, endTime: true },
    })

    if (conflicts.length) {
      if (!targetService.groupAllowed) {
        throw Object.assign(new Error("SPECIALIST_TIME_SLOT_BUSY"), { statusCode: 409 })
      }

      const sameGroup = conflicts.every((item) =>
        item.serviceId === targetService.id &&
        item.startTime.getTime() === start.getTime() &&
        item.endTime.getTime() === end.getTime()
      )

      if (!sameGroup) {
        throw Object.assign(new Error("SPECIALIST_TIME_SLOT_BUSY"), { statusCode: 409 })
      }

      const capacity = Number(targetService.maxClients || 1)
      if (conflicts.length >= capacity) {
        throw Object.assign(new Error("GROUP_SESSION_FULL"), { statusCode: 409 })
      }
    }

    if (
      changingCourse &&
      appointment.courseId &&
      Number(appointment.course?.usedLessons || 0) > 0
    ) {
      await tx.course.update({
        where: { id: appointment.courseId },
        data: {
          usedLessons: {
            decrement: 1,
          },
        },
      })
    }

    if (changingCourse && targetCourse) {
      await tx.course.update({
        where: { id: targetCourse.id },
        data: {
          usedLessons: {
            increment: 1,
          },
        },
      })
    }

    const discount = discountFor(appointment.client, false)

    let price
    let basePrice
    let discountPercent
    let discountReason
    let specialistPay
    let paymentStatus
    let paidAt

    if (targetCourse) {
      price = 0
      basePrice = targetService.price
      discountPercent = 0
      discountReason = null
      specialistPay = targetCourse.specialistPayPerSession ?? targetService.specialistPayPerSession ?? 0
      paymentStatus = "PAID"
      paidAt = null
    } else {
      price = changingService
        ? discountedPrice(targetService.price, discount.percent)
        : appointment.price
      basePrice = changingService ? targetService.price : appointment.basePrice
      discountPercent = changingService ? discount.percent : appointment.discountPercent
      discountReason = changingService ? discount.reason : appointment.discountReason
      specialistPay = changingService
        ? (targetService.specialistPayPerSession || 0)
        : appointment.specialistPay

      // Leaving a course turns the visit back into a one-off that must be paid.
      paymentStatus = appointment.courseId ? "PENDING" : appointment.paymentStatus
      paidAt = appointment.courseId ? null : appointment.paidAt
    }

    const snapshotChanged = changingCourse || changingService
    if (snapshotChanged && targetCourse) specialistPay = targetCourse.specialistPayPerSession ?? fixedPayFor(targetService, Number(targetCourse.price) / Number(targetCourse.totalLessons))
    if (snapshotChanged && !targetCourse) specialistPay = fixedPayFor(targetService, price)
    const payConfig = snapshotChanged ? (targetCourse?.payConfig || payConfigFor(targetService)) : appointment.payConfig
    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        payConfig,
        specialistId,
        serviceId: targetService.id,
        courseId: targetCourse?.id || null,
        startTime: start,
        endTime: end,
        duration,
        price,
        basePrice,
        discountPercent,
        discountReason,
        specialistPay,
        paymentStatus,
        paidAt,
      },
      include: {
        client: true,
        specialist: true,
        service: true,
        course: true,
      },
    })
  })
},

async moveScheduled(id, dto) {
  const localDate = String(dto?.localDate || "").trim()
  const localTime = String(dto?.localTime || "").trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate) || !/^\d{2}:\d{2}$/.test(localTime)) {
    const error = new Error("INVALID_MOVE_TIME")
    error.statusCode = 400
    throw error
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
    const appointment = await tx.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        client: { include: { user: { select: { active: true } } } },
        specialist: { include: { user: { select: { active: true } } } },
      },
    })

    if (!appointment) {
      const error = new Error("Appointment not found")
      error.statusCode = 404
      throw error
    }

    if (appointment.status !== "SCHEDULED") {
      const error = new Error("ONLY_SCHEDULED_CAN_MOVE")
      error.statusCode = 409
      throw error
    }

    if (appointment.client?.active === false || appointment.client?.user?.active === false) {
      const error = new Error("CLIENT_ARCHIVED")
      error.statusCode = 409
      throw error
    }

    if (appointment.specialist?.user?.active === false) {
      const error = new Error("SPECIALIST_ARCHIVED")
      error.statusCode = 409
      throw error
    }

    const duration = Number(
      appointment.duration ||
      Math.max(1, Math.round((appointment.endTime.getTime() - appointment.startTime.getTime()) / 60000))
    )

    const range = centerWallRange(localDate, localTime, duration)
    const start = range.start
    const end = range.end

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      const error = new Error("INVALID_MOVE_TIME")
      error.statusCode = 400
      throw error
    }

    if (start <= new Date()) {
      const error = new Error("MOVE_TARGET_IN_PAST")
      error.statusCode = 409
      throw error
    }

    // Lock both logical resources in deterministic order. This prevents two
    // concurrent moves/bookings from putting the same client or specialist
    // into overlapping slots before either transaction commits.
    const lockKeys = [
      `client:${appointment.clientId}:${start.toISOString()}:${end.toISOString()}`,
      `specialist:${appointment.specialistId}:${start.toISOString()}:${end.toISOString()}`,
    ].sort()

    for (const key of lockKeys) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`
    }

    const clientConflict = await tx.appointment.findFirst({
      where: {
        id: { not: appointment.id },
        clientId: appointment.clientId,
        status: { not: "CANCELLED" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    })

    if (clientConflict) {
      const error = new Error("CLIENT_TIME_SLOT_BUSY")
      error.statusCode = 409
      throw error
    }

    const blocked = await tx.specialistBlock.findFirst({
      where: {
        specialistId: appointment.specialistId,
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: { id: true },
    })

    if (blocked) {
      const error = new Error("SPECIALIST_UNAVAILABLE")
      error.statusCode = 409
      throw error
    }

    const specialistConflicts = await tx.appointment.findMany({
      where: {
        id: { not: appointment.id },
        specialistId: appointment.specialistId,
        status: { not: "CANCELLED" },
        startTime: { lt: end },
        endTime: { gt: start },
      },
      select: {
        id: true,
        serviceId: true,
        startTime: true,
        endTime: true,
      },
    })

    if (specialistConflicts.length > 0) {
      if (!appointment.service.groupAllowed) {
        const error = new Error("TIME_SLOT_BUSY")
        error.statusCode = 409
        throw error
      }

      const sameGroupSession = specialistConflicts.every((item) =>
        item.serviceId === appointment.serviceId &&
        item.startTime.getTime() === start.getTime() &&
        item.endTime.getTime() === end.getTime()
      )

      if (!sameGroupSession) {
        const error = new Error("TIME_SLOT_BUSY")
        error.statusCode = 409
        throw error
      }

      const capacity = Number(appointment.service.maxClients || 1)
      if (specialistConflicts.length >= capacity) {
        const error = new Error("GROUP_SESSION_FULL")
        error.statusCode = 409
        throw error
      }
    }

    return tx.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: start,
        endTime: end,
      },
      include: {
        client: true,
        specialist: true,
        service: true,
        course: true,
      },
    })
  })
},




async reassignSpecialist(id, specialistId) {
  if (!specialistId) {
    const error = new Error("SPECIALIST_REQUIRED")
    error.statusCode = 400
    throw error
  }

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
    const appointment = await tx.appointment.findUnique({
      where: { id },
      include: {
        service: true,
        specialist: true,
      },
    })

    if (!appointment) {
      const error = new Error("Appointment not found")
      error.statusCode = 404
      throw error
    }

    if (appointment.status !== "SCHEDULED") {
      const error = new Error("ONLY_SCHEDULED_CAN_REASSIGN")
      error.statusCode = 409
      throw error
    }

    if (appointment.specialistId === specialistId) {
      return appointment
    }

    const specialist = await tx.specialistProfile.findUnique({
      where: { id: specialistId },
      include: { user: { select: { active: true } } },
    })

    if (!specialist || specialist.user?.active === false) {
      const error = new Error("SPECIALIST_NOT_AVAILABLE")
      error.statusCode = 409
      throw error
    }

    // Serialize competing moves/bookings for the target specialist and slot.
    const bookingLockKey = `${specialistId}:${appointment.startTime.toISOString()}:${appointment.endTime.toISOString()}`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingLockKey}))`

    const blocked = await tx.specialistBlock.findFirst({
      where: {
        specialistId,
        startTime: { lt: appointment.endTime },
        endTime: { gt: appointment.startTime },
      },
      select: { id: true },
    })

    if (blocked) {
      const error = new Error("SPECIALIST_UNAVAILABLE")
      error.statusCode = 409
      throw error
    }

    const conflicts = await tx.appointment.findMany({
      where: {
        id: { not: appointment.id },
        specialistId,
        status: { not: "CANCELLED" },
        startTime: { lt: appointment.endTime },
        endTime: { gt: appointment.startTime },
      },
      select: {
        id: true,
        serviceId: true,
        startTime: true,
        endTime: true,
      },
    })

    if (conflicts.length > 0) {
      if (!appointment.service.groupAllowed) {
        const error = new Error("SPECIALIST_TIME_SLOT_BUSY")
        error.statusCode = 409
        throw error
      }

      const exactSameGroup = conflicts.every((item) =>
        item.serviceId === appointment.serviceId &&
        item.startTime.getTime() === appointment.startTime.getTime() &&
        item.endTime.getTime() === appointment.endTime.getTime()
      )

      if (!exactSameGroup) {
        const error = new Error("SPECIALIST_TIME_SLOT_BUSY")
        error.statusCode = 409
        throw error
      }

      const capacity = Number(appointment.service.maxClients || 1)
      if (conflicts.length >= capacity) {
        const error = new Error("GROUP_SESSION_FULL")
        error.statusCode = 409
        throw error
      }
    }

    return tx.appointment.update({
      where: { id: appointment.id },
      data: { specialistId },
      include: {
        client: true,
        specialist: true,
        service: true,
        course: true,
      },
    })
  })
},

async updateStatuses(id, dto) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
    const current = await tx.appointment.findUnique({ where: { id } })
    if (!current) throw Object.assign(new Error('Appointment not found'), { statusCode: 404 })
    if (current.status === 'CANCELLED' && dto.status && dto.status !== 'CANCELLED') throw Object.assign(new Error('Для отменённой записи создайте новое занятие с проверкой свободного времени.'), { statusCode: 409 })
    if (current.courseId && dto.paymentStatus === 'PENDING') throw Object.assign(new Error('Оплата занятия определяется курсом.'), { statusCode: 409 })
    const data = {}
    if (dto.status) data.status = dto.status
    if (dto.paymentStatus) {
      data.paymentStatus = dto.paymentStatus
      if (!current.courseId && dto.paymentStatus === 'PAID' && current.paymentStatus !== 'PAID') data.paidAt = new Date()
      if (dto.paymentStatus === 'PENDING') data.paidAt = null
    }
    return tx.appointment.update({ where: { id }, data, include: { client: true, specialist: true, service: true } })
  })
},

async getAvailable(query) {
  let start
  let end

  if (query.localDate && query.localTime && query.duration) {
    const range = centerWallRange(query.localDate, query.localTime, query.duration)
    start = range.start
    end = range.end
  } else {
    // Backward-compatible fallback for an older frontend during deployment.
    if (!query.startTime || !query.endTime) {
      throw new Error("localDate/localTime/duration or startTime/endTime are required")
    }

    start = new Date(query.startTime)
    end = new Date(query.endTime)
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start || end - start > 480 * 60000) {
    throw new Error("Invalid date")
  }

  const requestedService = query.serviceId
    ? await prisma.service.findUnique({ where: { id: query.serviceId } })
    : null

  const busyAppointments = await prisma.appointment.findMany({
    where: {
      ...(query.excludeAppointmentId ? { id: { not: query.excludeAppointmentId } } : {}),
      status: { not: "CANCELLED" },
      startTime: { lt: end },
      endTime: { gt: start }
    },
    select: {
      specialistId: true,
      clientId: true,
      serviceId: true,
      startTime: true,
      endTime: true,
      service: {
        select: {
          id: true,
          title: true,
          groupAllowed: true,
          maxClients: true,
          durationMinutes: true,
          price: true
        }
      }
    }
  })

  const blocks = await prisma.specialistBlock.findMany({
    where: { startTime: { lt: end }, endTime: { gt: start } },
    select: { specialistId: true }
  })

  const blockedSpecialistIds = new Set(blocks.map((block) => block.specialistId))
  const appointmentsBySpecialist = new Map()

  for (const appointment of busyAppointments) {
    const list = appointmentsBySpecialist.get(appointment.specialistId) || []
    list.push(appointment)
    appointmentsBySpecialist.set(appointment.specialistId, list)
  }

  function getJoinableGroupSession(specialistId) {
    const overlaps = appointmentsBySpecialist.get(specialistId) || []
    if (overlaps.length === 0) return null

    const first = overlaps[0]
    const exactSameSession = overlaps.every((appointment) =>
      appointment.serviceId === first.serviceId &&
      appointment.startTime.getTime() === first.startTime.getTime() &&
      appointment.endTime.getTime() === first.endTime.getTime()
    )

    const startsAtRequestedTime = first.startTime.getTime() === start.getTime()

    if (!exactSameSession || !startsAtRequestedTime || !first.service?.groupAllowed) return null

    const maxClients = Number(first.service.maxClients || 1)
    if (overlaps.length >= maxClients) return null

    return {
      specialistId,
      serviceId: first.serviceId,
      serviceTitle: first.service.title,
      durationMinutes: Math.round((first.endTime.getTime() - first.startTime.getTime()) / 60000),
      price: first.service.price,
      currentClients: overlaps.length,
      maxClients,
      remainingPlaces: Math.max(0, maxClients - overlaps.length)
    }
  }

  const allSpecialists = await prisma.specialistProfile.findMany({
    where: { user: { active: true } },
    orderBy: { fullName: "asc" }
  })

  const specialists = allSpecialists.filter((specialist) => {
    if (blockedSpecialistIds.has(specialist.id)) return false

    const overlaps = appointmentsBySpecialist.get(specialist.id) || []
    if (overlaps.length === 0) return true

    if (!requestedService) {
      return Boolean(getJoinableGroupSession(specialist.id))
    }

    if (!requestedService.groupAllowed) return false

    const sameGroupSession = overlaps.every((appointment) =>
      appointment.serviceId === requestedService.id &&
      appointment.startTime.getTime() === start.getTime() &&
      appointment.endTime.getTime() === end.getTime()
    )

    if (!sameGroupSession) return false

    const capacity = Number(requestedService.maxClients || 1)
    return overlaps.length < capacity
  })

  const joinableGroupSessions = specialists
    .map((specialist) => getJoinableGroupSession(specialist.id))
    .filter(Boolean)

  const busyClientIds = [...new Set(busyAppointments.map((appointment) => appointment.clientId))]

  const clients = await prisma.clientProfile.findMany({
    where: {
      active: true,
      id: { notIn: busyClientIds },
      OR: [
        { userId: null },
        { user: { active: true } },
      ],
    },
    orderBy: { fullName: "asc" }
  })

  return {
    specialists,
    clients,
    joinableGroupSessions,
    group: requestedService?.groupAllowed
      ? {
          serviceId: requestedService.id,
          maxClients: Number(requestedService.maxClients || 1)
        }
      : null
  }
}
}