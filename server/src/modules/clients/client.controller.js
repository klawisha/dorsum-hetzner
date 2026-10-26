import { ClientService } from './client.service.js'
import prisma from "../../config/prisma.js"

import { sanitizeImage } from '../../security/image.js'
import { encryptMedia, decryptMedia } from '../../security/media-crypto.js'
import { canReadClient } from '../../security/access.js'
function safeFileName(value) {
  return String(value || 'client-card').replace(/[\\/\0\r\n]/g, '_').replace(/[^a-zA-Z0-9._()\-\u0400-\u04FF ]/g, '_').slice(0, 110).replace(/\.[^.]+$/, '') + '.webp'
}
const clientCardMetaSelect = {
  id: true,
  fileName: true,
  mimeType: true,
  byteSize: true,
  updatedAt: true,
}

function clientListSelect({ specialistId = null } = {}) {
  return {
    id: true,
    fullName: true,
    phone: true,
    birthDate: true,
    notes: true,
    isMilitary: true,
    isPensioner: true,
    active: true,
    managedOnly: true,
    createdAt: true,
    user: {
      select: {
        id: true,
        phone: true,
        email: true,
      },
    },
    courses: {
      where: { voidedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        totalLessons: true,
        usedLessons: true,
        price: true,
        discountPercent: true,
        isPaid: true,
        paymentState: true,
        paidAmount: true,
      },
    },
    appointments: {
      where: {
        status: "SCHEDULED",
        startTime: { gte: new Date() },
        ...(specialistId ? { specialistId } : {}),
      },
      orderBy: { startTime: "asc" },
      take: 1,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        service: { select: { title: true } },
        specialist: { select: { fullName: true } },
      },
    },
    cardImage: {
      select: clientCardMetaSelect,
    },
  }
}

export const ClientController = {
  async createProfile(req, reply) {
    try {
      const profile = await ClientService.createProfile(req.user.id, req.body)
      return reply.status(201).send(profile)
    } catch (error) {
      return reply.status(400).send({ message: error.message })
    }
  },

  async getList(req, reply) {
    const clients = await prisma.clientProfile.findMany({
      where: {
        active: true,
        OR: [
          { userId: null },
          { user: { active: true } },
        ],
      },
      select: clientListSelect(),
      orderBy: { fullName: "asc" },
    })

    return reply.send(clients.map(({ notes, ...client }) => ({
      ...client,
      hasNotes: Boolean(notes),
    })))
  },

  async getAssigned(req, reply) {
    const specialist = await prisma.specialistProfile.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })

    if (!specialist) {
      return reply.status(404).send({ message: "Specialist profile not found" })
    }

    const clients = await prisma.clientProfile.findMany({
      where: {
        active: true,
        OR: [
          { userId: null },
          { user: { active: true } },
        ],
        appointments: {
          some: { specialistId: specialist.id, status: { not: "CANCELLED" } },
        },
      },
      select: clientListSelect({ specialistId: specialist.id }),
      orderBy: { fullName: "asc" },
    })

    return reply.send(clients.map(({ notes, ...client }) => ({
      ...client,
      hasNotes: Boolean(notes),
    })))
  },

  async getMe(req, reply) {
    try {
      const userId = req.user.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          email: true,
          role: true,
          clientProfile: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              birthDate: true,
              balance: true,
              isMilitary: true,
              isPensioner: true,
              createdAt: true,
            },
          },
        },
      })

      const courses = await prisma.course.findMany({
        where: { client: { userId }, voidedAt: null },
        orderBy: { createdAt: "desc" },
      })

      const appointments = await prisma.appointment.findMany({
        where: { client: { userId } },
        include: { specialist: { select: { id: true, fullName: true, color: true } }, service: { select: { id: true, title: true, price: true, durationMinutes: true, category: true } } },
        orderBy: { startTime: "desc" },
      })

      return { user, appointments, courses }
    } catch (error) {
      return reply.status(500).send({ message: error.message })
    }
  },

  async getClientDetails(req, reply) {
    try {
      const { id } = req.params

      if (req.user.role === "SPECIALIST") {
        const allowed = await canReadClient(req.user, id)
        if (!allowed) {
          return reply.status(403).send({ message: "CLIENT_ACCESS_DENIED" })
        }
      }

      const client = await prisma.clientProfile.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              phone: true,
              email: true,
              role: true,
            },
          },
          cardImage: {
            select: clientCardMetaSelect,
          },
          courses: {
            where: { voidedAt: null },
            orderBy: { createdAt: "desc" },
          },
          appointments: {
            where: req.user.role === 'SPECIALIST' ? { specialist: { userId: req.user.id } } : {},
            include: {
              specialist: true,
              service: true,
              course: true,
            },
            orderBy: { startTime: "desc" },
          },
        },
      })

      if (!client) {
        return reply.status(404).send({ message: "Client not found" })
      }

      return reply.send(client)
    } catch (error) {
      return reply.status(500).send({ message: error.message })
    }
  },

  async updateNotes(req, reply) {
    const notes = typeof req.body?.notes === "string" ? req.body.notes.trim() : ""

    if (notes.length > 5000) {
      return reply.status(400).send({ message: "CLIENT_NOTES_TOO_LONG" })
    }

    const client = await prisma.clientProfile.update({
      where: { id: req.params.id },
      data: { notes: notes || null },
      select: { id: true, notes: true },
    })

    return reply.send(client)
  },

  async uploadCardImage(req, reply) {
    const { dataBase64, mimeType, fileName } = req.body || {}

    const { buffer, mimeType: detectedMime } = await sanitizeImage(dataBase64, mimeType)
    const stored = encryptMedia(buffer, 'client-card:' + req.params.id)

    const exists = await prisma.clientProfile.findUnique({
      where: { id: req.params.id },
      select: { id: true },
    })

    if (!exists) {
      return reply.status(404).send({ message: "Client not found" })
    }

    const cardImage = await prisma.clientCardImage.upsert({
      where: { clientId: req.params.id },
      create: {
        clientId: req.params.id,
        fileName: safeFileName(fileName),
        mimeType: detectedMime,
        byteSize: buffer.length,
        data: stored,
      },
      update: {
        fileName: safeFileName(fileName),
        mimeType: detectedMime,
        byteSize: buffer.length,
        data: stored,
      },
      select: clientCardMetaSelect,
    })

    return reply.send(cardImage)
  },

  async getCardImage(req, reply) {
    if (req.user.role === "SPECIALIST") {
      const allowed = await canReadClient(req.user, req.params.id)
      if (!allowed) {
        return reply.status(403).send({ message: "CLIENT_ACCESS_DENIED" })
      }
    }

    const cardImage = await prisma.clientCardImage.findUnique({
      where: { clientId: req.params.id },
      select: {
        fileName: true,
        mimeType: true,
        data: true,
      },
    })

    if (!cardImage) {
      return reply.status(404).send({ message: "CARD_IMAGE_NOT_FOUND" })
    }

    reply.header("Content-Type", cardImage.mimeType)
    reply.header("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(cardImage.fileName)}`)
    reply.header("Cache-Control", "private, no-store, max-age=0")
    reply.header("X-Content-Type-Options", "nosniff")
    return reply.send(decryptMedia(cardImage.data, 'client-card:' + req.params.id))
  },

  async deleteCardImage(req, reply) {
    const existing = await prisma.clientCardImage.findUnique({
      where: { clientId: req.params.id },
      select: { id: true },
    })

    if (!existing) {
      return reply.status(204).send()
    }

    await prisma.clientCardImage.delete({ where: { id: existing.id } })
    return reply.status(204).send()
  },
}
