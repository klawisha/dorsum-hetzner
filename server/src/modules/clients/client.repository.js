import { prisma } from '../../config/prisma.js'

export const ClientRepository = {

  createProfile(data) {
    return prisma.clientProfile.create({
      data
    })
  },

  getByUserId(userId) {
    return prisma.clientProfile.findUnique({
      where: { userId }
    })
  }

}