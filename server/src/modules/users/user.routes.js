import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'
import bcrypt from 'bcrypt'
import { validatePassword } from '../../security/password.js'
import { normalizePhone } from '../auth/auth.service.js'


const ALLOWED_SPECIALIZATIONS = [
  'MASSAGE_THERAPIST',
  'REHABILITATION_SPECIALIST',
  'TRAINER',
  'DOCTOR',
]

function validateAdminCreatedAccount(body = {}) {
  const fullName = String(body.fullName || '').trim()
  const password = String(body.password || '')
  const phone = normalizePhone(body.phone)

  if (fullName.length < 2 || fullName.length > 160) {
    const error = new Error('Введите корректное ФИО')
    error.statusCode = 400
    throw error
  }

  validatePassword(password)

  return { fullName, phone, password }
}

function accountCreationError(reply, error) {
  if (error?.code === 'P2002') {
    return reply.status(409).send({ message: 'Пользователь с таким телефоном уже существует' })
  }

  return reply.status(error?.statusCode || 500).send({
    message: error?.message || 'Не удалось создать пользователя',
  })
}

export async function userRoutes(app) {

  app.post('/users/admin-create-client', {
    preHandler: [authMiddleware, roleMiddleware(['ADMIN'])],
  }, async (req, reply) => {
    try {
      const fullName = String(req.body?.fullName || '').trim().replace(/\s+/g, ' ')
      const phone = normalizePhone(req.body?.phone)
      const allowSharedPhone = req.body?.allowSharedPhone === true
      const password = String(req.body?.password || '')
      const isMilitary = Boolean(req.body?.isMilitary)
      const isPensioner = Boolean(req.body?.isPensioner)

      if (fullName.length < 2 || fullName.length > 160) {
        return reply.status(400).send({ message: 'Введите корректное ФИО' })
      }

      if (!allowSharedPhone) validatePassword(password)

      const created = await prisma.$transaction(async (tx) => {
        const [existingUser, existingProfiles] = await Promise.all([
          tx.user.findUnique({
            where: { phone },
            include: { clientProfile: true, specialistProfile: true },
          }),
          tx.clientProfile.findMany({
            where: { phone, active: true },
            select: { id: true, fullName: true, userId: true },
          }),
        ])

        // Explicit ADMIN-only dependent profile. No new User is created, so the
        // shared phone does not become a second credential/identity.
        if (allowSharedPhone) {
          if (existingProfiles.length === 0 && !existingUser) {
            const error = new Error('Для общего номера сначала должен существовать основной клиент')
            error.statusCode = 409
            throw error
          }

          const profile = await tx.clientProfile.create({
            data: {
              userId: null,
              fullName,
              phone,
              isMilitary,
              isPensioner,
              active: true,
              managedOnly: true,
            },
            select: {
              id: true,
              fullName: true,
              phone: true,
              isMilitary: true,
              isPensioner: true,
              managedOnly: true,
            },
          })

          return {
            user: null,
            profile,
            sharedPhone: true,
            loginDisabled: true,
          }
        }

        if (existingUser?.active) {
          const error = new Error('Пользователь с таким телефоном уже существует')
          error.statusCode = 409
          throw error
        }

        if (existingProfiles.length > 0 && !existingUser) {
          const error = new Error('Этот номер уже используется клиентской карточкой. Используйте режим общего номера.')
          error.statusCode = 409
          throw error
        }

        const hash = await bcrypt.hash(password, 12)

        if (existingUser && !existingUser.active) {
          if (existingUser.role !== 'CLIENT' || !existingUser.clientProfile) {
            const error = new Error('Этот телефон принадлежит архивированному аккаунту другой роли')
            error.statusCode = 409
            throw error
          }

          const user = await tx.user.update({
            where: { id: existingUser.id },
            data: {
              active: true,
              deactivatedAt: null,
              deactivatedReason: null,
              password: hash,
              role: 'CLIENT',
            },
            select: { id: true, phone: true, role: true, createdAt: true },
          })

          const profile = await tx.clientProfile.update({
            where: { userId: existingUser.id },
            data: {
              fullName,
              phone,
              isMilitary,
              isPensioner,
              active: true,
              managedOnly: false,
            },
            select: {
              id: true,
              fullName: true,
              phone: true,
              isMilitary: true,
              isPensioner: true,
              managedOnly: true,
            },
          })

          return { user, profile, reactivated: true }
        }

        const user = await tx.user.create({
          data: {
            phone,
            password: hash,
            role: 'CLIENT',
          },
          select: {
            id: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        })

        const profile = await tx.clientProfile.create({
          data: {
            userId: user.id,
            fullName,
            phone,
            isMilitary,
            isPensioner,
            active: true,
            managedOnly: false,
          },
          select: {
            id: true,
            fullName: true,
            phone: true,
            isMilitary: true,
            isPensioner: true,
            managedOnly: true,
          },
        })

        return { user, profile }
      })

      return reply.status(201).send(created)
    } catch (error) {
      return accountCreationError(reply, error)
    }
  })

  app.post('/users/admin-create-specialist', {
    preHandler: [authMiddleware, roleMiddleware(['ADMIN'])],
  }, async (req, reply) => {
    try {
      const { fullName, phone, password } = validateAdminCreatedAccount(req.body)
      const specializations = Array.isArray(req.body?.specializations)
        ? [...new Set(req.body.specializations)]
        : []
      const color = String(req.body?.color || '#0b8560').trim()

      if (
        specializations.length === 0 ||
        specializations.some((item) => !ALLOWED_SPECIALIZATIONS.includes(item))
      ) {
        return reply.status(400).send({ message: 'Выберите хотя бы одну корректную специализацию' })
      }

      if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return reply.status(400).send({ message: 'Некорректный цвет специалиста' })
      }

      const hash = await bcrypt.hash(password, 12)

      const created = await prisma.$transaction(async (tx) => {
        const existing = await tx.user.findUnique({
          where: { phone },
          include: { clientProfile: true, specialistProfile: true },
        })

        if (existing?.active) {
          const error = new Error('Пользователь с таким телефоном уже существует')
          error.statusCode = 409
          throw error
        }

        if (existing && !existing.active) {
          if (existing.role !== 'SPECIALIST' || !existing.specialistProfile) {
            const error = new Error('Этот телефон принадлежит архивированному аккаунту другой роли')
            error.statusCode = 409
            throw error
          }

          const user = await tx.user.update({
            where: { id: existing.id },
            data: {
              active: true,
              deactivatedAt: null,
              deactivatedReason: null,
              password: hash,
              role: 'SPECIALIST',
            },
            select: { id: true, phone: true, role: true, createdAt: true },
          })

          const profile = await tx.specialistProfile.update({
            where: { userId: existing.id },
            data: { fullName, specializations, color },
            select: { id: true, fullName: true, specializations: true, color: true },
          })

          return { user, profile, reactivated: true }
        }

        const user = await tx.user.create({
          data: {
            phone,
            password: hash,
            role: 'SPECIALIST',
          },
          select: {
            id: true,
            phone: true,
            role: true,
            createdAt: true,
          },
        })

        const profile = await tx.specialistProfile.create({
          data: {
            userId: user.id,
            fullName,
            specialization: 'Specialist',
            specializations,
            color,
          },
          select: {
            id: true,
            fullName: true,
            specializations: true,
            color: true,
          },
        })

        return { user, profile }
      })

      return reply.status(201).send(created)
    } catch (error) {
      return accountCreationError(reply, error)
    }
  })

  app.get('/users', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (req) => {
    const search = String(req.query.search || '').trim()
    return prisma.user.findMany({
      where: {
        active: true,
        role: { in: ['ADMIN', 'SPECIALIST'] },
        ...(search ? { OR: [
          { phone: { contains: search } },
          { email: { contains: search, mode: 'insensitive' } },
          { clientProfile: { fullName: { contains: search, mode: 'insensitive' } } },
          { specialistProfile: { fullName: { contains: search, mode: 'insensitive' } } }
        ] } : {})
      },
      select: { id: true, phone: true, email: true, role: true, active: true, createdAt: true, clientProfile: true, specialistProfile: true },
      orderBy: { createdAt: 'desc' }
    })
  })


  app.patch('/users/:id/identity', {
    preHandler: [authMiddleware, roleMiddleware(['ADMIN'])],
  }, async (req, reply) => {
    try {
      const { id } = req.params
      const fullName = String(req.body?.fullName || '').trim().replace(/\s+/g, ' ')
      const phone = normalizePhone(req.body?.phone)

      if (fullName.length < 2 || fullName.length > 160) {
        return reply.status(400).send({ message: 'Введите корректное ФИО' })
      }
      if (!phone) {
        return reply.status(400).send({ message: 'Введите корректный телефон' })
      }

      const current = await prisma.user.findUnique({
        where: { id },
        include: { clientProfile: true, specialistProfile: true },
      })
      if (!current) return reply.status(404).send({ message: 'Пользователь не найден' })
      if (!current.active) return reply.status(409).send({ message: 'Сначала восстановите архивированный аккаунт' })
      if (!['CLIENT', 'SPECIALIST'].includes(current.role)) {
        return reply.status(400).send({ message: 'Эта форма предназначена для клиентов и специалистов' })
      }

      const phoneOwner = await prisma.user.findUnique({ where: { phone }, select: { id: true } })
      if (phoneOwner && phoneOwner.id !== id) {
        return reply.status(409).send({ message: 'Этот номер телефона уже используется другим аккаунтом' })
      }

      const updated = await prisma.$transaction(async (tx) => {
        const user = await tx.user.update({
          where: { id },
          data: { phone },
          select: { id: true, phone: true, role: true },
        })

        if (current.role === 'CLIENT') {
          if (!current.clientProfile) throw Object.assign(new Error('Профиль клиента не найден'), { statusCode: 409 })
          const profile = await tx.clientProfile.update({
            where: { userId: id },
            data: { fullName, phone },
          })
          return { user, profile }
        }

        if (!current.specialistProfile) throw Object.assign(new Error('Профиль специалиста не найден'), { statusCode: 409 })
        const profile = await tx.specialistProfile.update({
          where: { userId: id },
          data: { fullName },
        })
        return { user, profile }
      })

      return reply.send(updated)
    } catch (error) {
      if (error?.code === 'P2002') {
        return reply.status(409).send({ message: 'Этот номер телефона уже используется другим аккаунтом' })
      }
      return reply.status(error?.statusCode || 500).send({ message: error?.message || 'Не удалось обновить данные' })
    }
  })


  app.patch('/users/:id/archive', {
    preHandler: [authMiddleware, roleMiddleware(['ADMIN'])],
  }, async (req, reply) => {
    const { id } = req.params

    if (id === req.user.id) {
      return reply.status(400).send({ message: 'Нельзя архивировать собственный аккаунт администратора' })
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        clientProfile: { select: { id: true, fullName: true } },
        specialistProfile: { select: { id: true, fullName: true } },
      },
    })

    if (!user) return reply.status(404).send({ message: 'Пользователь не найден' })
    if (user.role === 'ADMIN') return reply.status(400).send({ message: 'Удаление администратора через эту функцию запрещено' })
    if (!user.active) return reply.send({ ok: true, alreadyArchived: true })

    const profileId = user.role === 'CLIENT'
      ? user.clientProfile?.id
      : user.specialistProfile?.id

    if (!profileId) {
      return reply.status(409).send({ message: 'У пользователя отсутствует профиль. Архивирование остановлено для проверки данных.' })
    }

    const now = new Date()
    const futureAppointment = user.role === 'CLIENT'
      ? await prisma.appointment.findFirst({
          where: {
            clientId: profileId,
            status: 'SCHEDULED',
            startTime: { gte: now },
          },
          select: { id: true, startTime: true },
          orderBy: { startTime: 'asc' },
        })
      : await prisma.appointment.findFirst({
          where: {
            specialistId: profileId,
            status: 'SCHEDULED',
            startTime: { gte: now },
          },
          select: { id: true, startTime: true },
          orderBy: { startTime: 'asc' },
        })

    if (futureAppointment) {
      return reply.status(409).send({
        message: 'HAS_FUTURE_APPOINTMENTS',
        nextAppointmentAt: futureAppointment.startTime,
      })
    }

    const reason = String(req.body?.reason || 'Архивировано администратором').trim().slice(0, 500)

    const archived = await prisma.user.update({
      where: { id },
      data: {
        active: false,
        deactivatedAt: new Date(),
        deactivatedReason: reason || 'Архивировано администратором',
      },
      select: {
        id: true,
        phone: true,
        role: true,
        active: true,
        deactivatedAt: true,
      },
    })

    return reply.send({
      ok: true,
      user: archived,
      preservedHistory: true,
    })
  })

  app.patch('/users/:id/specializations', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (req, reply) => {
    const allowed = ALLOWED_SPECIALIZATIONS
    const { specializations } = req.body
    if (!Array.isArray(specializations) || specializations.some(x => !allowed.includes(x))) return reply.status(400).send({ message: 'Invalid specializations' })
    const profile = await prisma.specialistProfile.findUnique({ where: { userId: req.params.id } })
    if (!profile) return reply.status(404).send({ message: 'Specialist profile not found' })
    return prisma.specialistProfile.update({ where: { userId: req.params.id }, data: { specializations } })
  })

  app.patch('/users/:id/role', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (req, reply) => {
    const { id } = req.params, { role } = req.body
    if (id === req.user.id) return reply.code(409).send({ message: 'Собственную роль нельзя изменить.' })
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201621)`
      const current = await tx.user.findUnique({ where: { id }, include: { clientProfile: true, specialistProfile: true } })
      if (!current || !current.active) return reply.code(404).send({ message: 'Пользователь не найден.' })
      if (current.role === 'ADMIN' && role !== 'ADMIN' && await tx.user.count({ where: { role: 'ADMIN', active: true } }) <= 1) return reply.code(409).send({ message: 'Нельзя изменить роль последнего администратора.' })
      const fullName = current.clientProfile?.fullName || current.specialistProfile?.fullName || 'Пользователь'
      if (role === 'CLIENT' && !current.clientProfile) await tx.clientProfile.create({ data: { userId: id, fullName, phone: current.phone } })
      if (role === 'SPECIALIST' && !current.specialistProfile) await tx.specialistProfile.create({ data: { userId: id, fullName, specializations: ['REHABILITATION_SPECIALIST'] } })
      return tx.user.update({ where: { id }, data: { role }, select: { id: true, phone: true, email: true, role: true } })
    })
  })

  app.patch('/users/:id/specialist-color', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (req, reply) => {
    const { color } = req.body
    if (!color || !/^#[0-9A-Fa-f]{6}$/.test(color)) return reply.status(400).send({ message: 'Invalid color' })
    const profile = await prisma.specialistProfile.findUnique({ where: { userId: req.params.id } })
    if (!profile) return reply.status(404).send({ message: 'Specialist profile not found' })
    return prisma.specialistProfile.update({ where: { userId: req.params.id }, data: { color } })
  })
}
