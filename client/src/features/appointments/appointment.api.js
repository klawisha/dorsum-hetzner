/*import { api } from "../../api/axios"

export const appointmentApi = {

  getAll: () =>
    api.get("/appointments"),

  create: (data) =>
    api.post("/appointments", data),



}*/

import { api } from "../../api/axios"

export const appointmentApi = {

  getAll: () =>
    api.get("/appointments"),

  create: (data) =>
    api.post("/appointments", data),

  getClients: () =>
    api.get("/clients"),

  getSpecialists: () =>
    api.get("/specialists"),

  getServices: () =>
    api.get("/services"),
  
  getMy: () =>
  api.get("/appointments/my"),

  delete: (id) =>
  api.delete(`/appointments/${id}`),

  updateStatuses: (id, data) =>
  api.patch(`/appointments/${id}/statuses`, data),

  reassignSpecialist: (id, specialistId) =>
    api.patch(`/appointments/${id}/specialist`, { specialistId }),

  move: (id, data) =>
    api.patch(`/appointments/${id}/move`, data),

  editSchedule: (id, data) =>
    api.patch(`/appointments/${id}/edit-schedule`, data),

/*async getAvailable(query) {
  const start = new Date(query.startTime)
  const end = new Date(query.endTime)

  if (!query.startTime || !query.endTime) {
    throw new Error("startTime and endTime are required")
  }

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid date")
  }

  const busyAppointments =
    await prisma.appointment.findMany({
      where: {
        status: {
          not: "CANCELLED"
        },
        startTime: {
          lt: end
        },
        endTime: {
          gt: start
        }
      },
      select: {
        specialistId: true,
        clientId: true
      }
    })

  const busySpecialistIds =
    busyAppointments.map((a) => a.specialistId)

  const busyClientIds =
    busyAppointments.map((a) => a.clientId)

  const specialists =
    await prisma.specialistProfile.findMany({
      where: {
        id: {
          notIn: busySpecialistIds
        }
      },
      orderBy: {
        fullName: "asc"
      }
    })

  const clients =
    await prisma.clientProfile.findMany({
      where: {
        id: {
          notIn: busyClientIds
        }
      },
      orderBy: {
        fullName: "asc"
      }
    })

  return {
    specialists,
    clients
  }
}*/

getAvailable: ({ localDate, localTime, duration, serviceId, excludeAppointmentId }) =>
  api.get("/appointments/available", {
    params: {
      localDate,
      localTime,
      duration,
      ...(serviceId ? { serviceId } : {}),
      ...(excludeAppointmentId ? { excludeAppointmentId } : {})
    }
  }),
}
