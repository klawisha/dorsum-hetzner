import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'
import { httpError } from '../../security/errors.js'
import { SERVICE_CATALOG } from './catalog.js'
const publicFields = { id:true,title:true,price:true,durationMinutes:true,category:true,isPackage:true,packageSessions:true,groupAllowed:true,maxClients:true,audience:true }
export async function ensureServiceCatalog() {
  for (const [title,price,durationMinutes,category,isPackage,packageSessions,specialistPayPerSession,active=true] of SERVICE_CATALOG) {
    if (await prisma.service.findFirst({where:{title}})) continue
    const massage = ['MASSAGE','APPARATUS_MASSAGE'].includes(category)
    await prisma.service.create({data:{
      title,price,durationMinutes,category,isPackage,packageSessions,specialistPayPerSession,active,
      massageHalfHourTracking:massage,massageTieredPay:massage,specialistPayMode:massage?'MASSAGE_TIER':'FIXED',
      massagePayClassMinutes:massage?durationMinutes:null,
      massageUseHigherOfTierAndFixed:title.toLowerCase()==='массаж спины (60 минут)',
    }})
  }
}
function normalizeService(data, existing = {}) {
  const result = { ...data }
  const merged = { ...existing, ...data }
  if (merged.isPackage && (!Number.isInteger(merged.packageSessions) || merged.packageSessions < 1)) throw httpError(400,'Укажите количество занятий в курсе.')
  if (!merged.isPackage) result.packageSessions = null
  if (!merged.groupAllowed) result.maxClients = 1
  else if (!Number.isInteger(merged.maxClients) || merged.maxClients < 2) throw httpError(400,'Для группы укажите минимум 2 места.')
  if (merged.groupPayMode === 'PER_SESSION' && merged.specialistPayMode === 'PERCENT') throw httpError(400,'Для выплаты за группу целиком выберите фиксированную сумму.')
  if (data.specialistPayMode) {
    result.massageTieredPay = data.specialistPayMode === 'MASSAGE_TIER'
    if (result.massageTieredPay) result.massageHalfHourTracking = true
  }
  if (merged.specialistPayMode === 'MASSAGE_TIER' && ![30,60,90].includes(Number(merged.massagePayClassMinutes || merged.durationMinutes))) throw httpError(400,'Для массажной сетки выберите класс 30, 60 или 90 минут.')
  return result
}
export async function serviceRoutes(app) {
  const admin = [authMiddleware,roleMiddleware(['ADMIN'])]
  app.get('/services',async()=>prisma.service.findMany({where:{active:true},select:publicFields,orderBy:[{category:'asc'},{title:'asc'}]}))
  app.get('/services/admin',{preHandler:admin},async()=>prisma.service.findMany({orderBy:[{active:'desc'},{category:'asc'},{title:'asc'}]}))
  app.post('/services',{preHandler:admin},async(req,reply)=>{
    const data=normalizeService(req.body)
    return reply.code(201).send(await prisma.service.create({data}))
  })
  app.patch('/services/:id',{preHandler:admin},async(req,reply)=>{
    return prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      const existing=await tx.service.findUnique({where:{id:req.params.id},include:{_count:{select:{appointments:true,courses:true}}}})
      if(!existing) throw httpError(404,'Услуга не найдена.')
      if(req.body.isPackage !== undefined && req.body.isPackage !== existing.isPackage && (existing._count.appointments || existing._count.courses)) throw httpError(409,'Услуга уже использовалась. Создайте новую услугу для смены типа «курс / разовая».')
      const data=normalizeService(req.body,existing)
      return tx.service.update({where:{id:existing.id},data})
    })
  })
  app.delete('/services/:id',{preHandler:admin},async req=>{
    await prisma.service.update({where:{id:req.params.id},data:{active:false}})
    return {ok:true,preservedHistory:true}
  })
  // Seeding is an explicit operations task and never overwrites live prices.
  app.post('/services/seed-price-list',{preHandler:admin},async()=>{
    await ensureServiceCatalog()
    return {ok:true,message:'Добавлены только отсутствующие услуги. Существующие цены не изменены.'}
  })
}
