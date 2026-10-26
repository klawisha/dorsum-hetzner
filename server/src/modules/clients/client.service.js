import { ClientRepository } from './client.repository.js'

export const ClientService = {

  async createProfile(userId, data) {

    const existing = await ClientRepository.getByUserId(userId)

    if (existing) {
      throw new Error('Profile already exists')
    }

    return ClientRepository.createProfile({
      fullName: data.fullName.trim(),
      phone: data.phone || null,
      birthDate: data.birthDate ? new Date(data.birthDate) : null,
      userId
    })
  }

}