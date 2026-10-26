import { prisma } from '../../config/prisma.js'

export const AppointmentRepository = {
  create(data) {
    return prisma.appointment.create({
      data
    })
  },

  findConflicts(specialistId, startTime, endTime) {
    return prisma.appointment.findMany({
      where: {
        specialistId,
        status: 'SCHEDULED',
        startTime: {
          lt: endTime
        },
        endTime: {
          gt: startTime
        }
      }
    })
  }
}