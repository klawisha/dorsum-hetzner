import prisma from '../config/prisma.js'
export async function canReadClient(user, clientId) {
  if (user.role === 'ADMIN') return true
  if (user.role === 'CLIENT') return Boolean(await prisma.clientProfile.findFirst({ where: { id: clientId, userId: user.id, active: true }, select: { id: true } }))
  if (user.role === 'SPECIALIST') return Boolean(await prisma.appointment.findFirst({ where: { clientId, status: { not: 'CANCELLED' }, specialist: { userId: user.id } }, select: { id: true } }))
  return false
}
