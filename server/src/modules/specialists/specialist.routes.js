import prisma from "../../config/prisma.js"

export async function specialistRoutes(app) {

  app.get("/specialists", async () => {

    return prisma.specialistProfile.findMany({
      where: { user: { active: true } },
      select: { id: true, fullName: true, specializations: true, color: true },
      orderBy: { fullName: "asc" },
    })

  })

}