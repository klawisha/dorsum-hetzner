import prisma from "../../config/prisma.js"
import { ClientController } from './client.controller.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from "../../middleware/role.middleware.js"
import { normalizePhone } from "../auth/auth.service.js"

export async function clientRoutes(app) {
  app.post(
    '/clients/profile',
    { preHandler: [authMiddleware, roleMiddleware(['CLIENT'])] },
    ClientController.createProfile,
  )

  // The complete client directory is administrative data and must never be public.
  app.get(
    "/clients",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    ClientController.getList,
  )

  // Specialists only see clients they have actually worked / are scheduled with.
  app.get(
    "/clients/assigned",
    { preHandler: [authMiddleware, roleMiddleware(["SPECIALIST"])] },
    ClientController.getAssigned,
  )

  app.get(
    "/clients/me",
    { preHandler: [authMiddleware] },
    ClientController.getMe,
  )

  app.get(
    "/clients/:id/details",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN", "SPECIALIST"])] },
    ClientController.getClientDetails,
  )


  app.patch(
    "/clients/:id/admin-identity",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    async (req, reply) => {
      try {
        const fullName = String(req.body?.fullName || "").trim().replace(/\s+/g, " ")
        const phone = normalizePhone(req.body?.phone)

        if (fullName.length < 2 || fullName.length > 160) {
          return reply.code(400).send({ message: "Введите корректное ФИО" })
        }

        const profile = await prisma.clientProfile.findUnique({
          where: { id: req.params.id },
          include: { user: true },
        })
        if (!profile) return reply.code(404).send({ message: "CLIENT_NOT_FOUND" })
        if (!profile.active) return reply.code(409).send({ message: "CLIENT_ARCHIVED" })

        if (profile.userId) {
          const owner = await prisma.user.findUnique({
            where: { phone },
            select: { id: true },
          })
          if (owner && owner.id !== profile.userId) {
            return reply.code(409).send({
              message: "Этот номер уже является номером входа другого аккаунта. Для общего семейного номера создайте отдельную клиентскую карточку.",
            })
          }

          return prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
              where: { id: profile.userId },
              data: { phone },
              select: { id: true, phone: true, role: true },
            })
            const client = await tx.clientProfile.update({
              where: { id: profile.id },
              data: { fullName, phone },
            })
            return { user, profile: client }
          })
        }

        const client = await prisma.clientProfile.update({
          where: { id: profile.id },
          data: { fullName, phone },
        })
        return { user: null, profile: client }
      } catch (error) {
        if (error?.code === "P2002") {
          return reply.code(409).send({ message: "Этот номер уже используется другим аккаунтом" })
        }
        return reply.code(error?.statusCode || 500).send({
          message: error?.message || "Не удалось обновить клиента",
        })
      }
    },
  )

  app.patch(
    "/clients/:id/archive",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    async (req, reply) => {
      const profile = await prisma.clientProfile.findUnique({
        where: { id: req.params.id },
        include: { user: { select: { id: true, role: true } } },
      })
      if (!profile) return reply.code(404).send({ message: "CLIENT_NOT_FOUND" })
      if (!profile.active) return reply.send({ ok: true, alreadyArchived: true })

      const futureAppointment = await prisma.appointment.findFirst({
        where: {
          clientId: profile.id,
          status: "SCHEDULED",
          startTime: { gte: new Date() },
        },
        select: { id: true, startTime: true },
        orderBy: { startTime: "asc" },
      })

      if (futureAppointment) {
        return reply.code(409).send({
          message: "HAS_FUTURE_APPOINTMENTS",
          nextAppointmentAt: futureAppointment.startTime,
        })
      }

      return prisma.$transaction(async (tx) => {
        const client = await tx.clientProfile.update({
          where: { id: profile.id },
          data: { active: false },
        })

        if (profile.userId && profile.user?.role === "CLIENT") {
          await tx.user.update({
            where: { id: profile.userId },
            data: {
              active: false,
              deactivatedAt: new Date(),
              deactivatedReason: String(req.body?.reason || "Клиент архивирован администратором").slice(0, 500),
            },
          })
        }

        return { ok: true, profile: client, preservedHistory: true }
      })
    },
  )

  app.patch(
    "/clients/:id/discount-status",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    async (req, reply) => {
      const { isMilitary, isPensioner } = req.body
      if (typeof isMilitary !== "boolean" || typeof isPensioner !== "boolean") {
        return reply.code(400).send({ message: "Boolean flags required" })
      }

      return prisma.clientProfile.update({
        where: { id: req.params.id },
        data: { isMilitary, isPensioner },
      })
    },
  )

  app.patch(
    "/clients/:id/notes",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    ClientController.updateNotes,
  )

  app.put(
    "/clients/:id/card-image",
    {
      preHandler: [authMiddleware, roleMiddleware(["ADMIN"])],
      bodyLimit: 8 * 1024 * 1024,
    },
    ClientController.uploadCardImage,
  )

  app.get(
    "/clients/:id/card-image",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN", "SPECIALIST"])] },
    ClientController.getCardImage,
  )

  app.delete(
    "/clients/:id/card-image",
    { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
    ClientController.deleteCardImage,
  )
}
