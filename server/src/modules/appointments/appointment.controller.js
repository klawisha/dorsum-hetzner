import { AppointmentService } from './appointment.service.js'

export const AppointmentController = {
    async create(req, reply) {
     try {
          const result = await AppointmentService.create(req.body)

         return reply.status(201).send(result)

     } catch (e) {
          return reply.status(e.statusCode || 400).send({
            message: e.message
          })
      }
     },

   async getAll(req, reply) {

    const appointments =
    await AppointmentService.getAll()

    return reply.send(appointments)
  },

  async getMyAppointments(req, reply) {
  try {
    const appointments =
      await AppointmentService.getMyAppointments(req.user.id)

    return reply.send(appointments)
  } catch (error) {
    return reply.status(400).send({
      message: error.message
    })
  }
},

async delete(req, reply) {
  try {
    await AppointmentService.delete(req.params.id)

    return reply.send({
      message: "Appointment deleted"
    })
  } catch (error) {
    return reply.status(400).send({
      message: error.message
    })
  }
},

async updateStatuses(req, reply) {
  try {
    const appointment =
      await AppointmentService.updateStatuses(
        req.params.id,
        req.body
      )

    return reply.send(appointment)
  } catch (error) {
    return reply.status(400).send({
      message: error.message
    })
  }
},

async reassignSpecialist(req, reply) {
  try {
    const appointment = await AppointmentService.reassignSpecialist(
      req.params.id,
      req.body?.specialistId
    )

    return reply.send(appointment)
  } catch (error) {
    return reply.status(error.statusCode || 400).send({
      message: error.message
    })
  }
},

async moveScheduled(req, reply) {
  try {
    const appointment = await AppointmentService.moveScheduled(
      req.params.id,
      req.body
    )

    return reply.send(appointment)
  } catch (error) {
    return reply.status(error.statusCode || 400).send({
      message: error.message
    })
  }
},

async editScheduled(req, reply) {
  try {
    return reply.send(await AppointmentService.editScheduled(req.params.id, req.body))
  } catch (error) {
    return reply.status(error.statusCode || 400).send({ message: error.message })
  }
}
}