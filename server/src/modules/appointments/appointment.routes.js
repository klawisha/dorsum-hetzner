import { AppointmentController } from './appointment.controller.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from "../../middleware/role.middleware.js"
import { AppointmentService } from "./appointment.service.js"

export async function appointmentRoutes(app) {

  app.post(
    '/appointments',
    {
      preHandler: [
        authMiddleware,
        roleMiddleware(["ADMIN"])
      ]
    },
    AppointmentController.create
  )

  app.get(
  "/appointments",
  {
    preHandler: [authMiddleware, roleMiddleware(["ADMIN"])]
  },
  AppointmentController.getAll
)

app.get(
  "/appointments/my",
  {
    preHandler: [authMiddleware, roleMiddleware(["SPECIALIST"])]
  },
  AppointmentController.getMyAppointments
)

app.get(
  "/appointments/available",
  {
    preHandler: [
      authMiddleware, roleMiddleware(["ADMIN"])
    ]
  },
  async (req, reply) => {
    try {
      const result =
        await AppointmentService.getAvailable(req.query)

      return reply.send(result)
    } catch (error) {
      return reply.status(400).send({
        message: error.message
      })
    }
  }
)

app.delete(
  "/appointments/:id",
  {
    preHandler: [
      authMiddleware,
      roleMiddleware(["ADMIN"])
    ]
  },
  AppointmentController.delete
)




app.patch(
  "/appointments/:id/edit-schedule",
  { preHandler: [authMiddleware, roleMiddleware(["ADMIN"])] },
  AppointmentController.editScheduled
)

app.patch(
  "/appointments/:id/move",
  {
    preHandler: [
      authMiddleware,
      roleMiddleware(["ADMIN"])
    ]
  },
  AppointmentController.moveScheduled
)

app.patch(
  "/appointments/:id/specialist",
  {
    preHandler: [
      authMiddleware,
      roleMiddleware(["ADMIN"])
    ]
  },
  AppointmentController.reassignSpecialist
)

app.patch(
  "/appointments/:id/statuses",
  {
    preHandler: [
      authMiddleware,
      roleMiddleware(["ADMIN"])
    ]
  },
  AppointmentController.updateStatuses
)

}