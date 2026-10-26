import '../src/config/env.js'
import prisma from '../src/config/prisma.js'
import { AppointmentService } from '../src/modules/appointments/appointment.service.js'
const [id, localDate, localTime] = process.argv.slice(2)
try {
  if (!id || !localDate || !localTime) throw new Error('Usage: node scripts/set-appointment-center-time.mjs ID YYYY-MM-DD HH:MM')
  if (process.env.APPLY !== 'YES') console.log('DRY RUN. Set APPLY=YES after checking the requested date and time.')
  else {
    await AppointmentService.moveScheduled(id, { localDate, localTime })
    console.log('Appointment moved with the same conflict checks as the API.')
  }
} finally { await prisma.$disconnect() }
