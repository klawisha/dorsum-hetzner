import prisma from "../../config/prisma.js"
import { authMiddleware } from "../../middleware/auth.middleware.js"
import { roleMiddleware } from "../../middleware/role.middleware.js"
import { canReadClient } from '../../security/access.js'
import { fixedPayFor, payConfigFor } from '../payroll/pay-snapshot.js'
import { discountFor, discountedPrice } from '../finance/pricing.js'

export async function courseRoutes(app) {
  app.post("/courses",{preHandler:[authMiddleware,roleMiddleware(["ADMIN"])]},async(req,reply)=>{
    const {
      clientId,
      serviceId,
      title,
      totalLessons,
      price,
      startsAt,
      expiresAt,
      legacyImported=false,
      usedLessons=0,
      paymentMode="FULL",
    }=req.body

    if(!clientId) return reply.status(400).send({message:"Client is required"})

    const client=await prisma.clientProfile.findUnique({
      where:{id:clientId},
      include:{user:{select:{active:true}}}
    })
    if(!client) return reply.status(404).send({message:'Client not found'})
    if(client.active === false || client.user?.active === false) {
      return reply.status(409).send({message:'CLIENT_ARCHIVED'})
    }

    let service=null
    if(serviceId){
      service=await prisma.service.findUnique({where:{id:serviceId}})
      if(!service?.isPackage || !service.active) return reply.status(400).send({message:'Select a package service'})
    }

    const basePrice=service?.price ?? Number(price)
    const lessons=service?.packageSessions ?? Number(totalLessons)
    const courseTitle=service?.title ?? title

    if(
      !courseTitle ||
      !Number.isInteger(Number(lessons)) ||
      Number(lessons) <= 0 ||
      !Number.isFinite(Number(basePrice))
    ){
      return reply.status(400).send({message:'Missing required fields'})
    }

    const imported=legacyImported===true
    const initialUsed=imported?Number(usedLessons):0

    if(
      !Number.isInteger(initialUsed) ||
      initialUsed<0 ||
      initialUsed>Number(lessons)
    ){
      return reply.status(400).send({
        message:'INVALID_USED_LESSONS',
        totalLessons:Number(lessons)
      })
    }

    const normalizedPaymentMode=String(paymentMode||"FULL").toUpperCase()
    if(!["FULL","HALF"].includes(normalizedPaymentMode)){
      return reply.status(400).send({message:"INVALID_COURSE_PAYMENT_MODE"})
    }

    const discount=discountFor(client,true)
    const normalPrice=discountedPrice(Number(basePrice),discount.percent)

    // Imported courses keep the catalogue/course price for reference, but no
    // historical payment is inserted into the current Dorsum cash ledger.
    const fullPrice=imported?Number(basePrice):normalPrice
    const firstPayment=imported
      ?0
      :normalizedPaymentMode==="HALF"
        ?Math.round((fullPrice/2)*100)/100
        :fullPrice

    const paymentState=normalizedPaymentMode==="HALF"
      ?"HALF_PAID"
      :"PAID"

    const now=new Date()

    const course=await prisma.$transaction(async(tx)=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      const created=await tx.course.create({
        data:{
          clientId,
          serviceId:service?.id||null,
          title:courseTitle,
          totalLessons:Number(lessons),
          usedLessons:initialUsed,
          price:fullPrice,
          basePrice:Number(basePrice),
          discountPercent:imported?0:discount.percent,
          discountReason:imported?null:discount.reason,
          startsAt:startsAt?new Date(startsAt):null,
          expiresAt:expiresAt?new Date(expiresAt):null,
          isPaid:paymentState==="PAID",
          paidAt:paymentState==="PAID"&&!imported?now:null,
          paymentState,
          paidAmount:imported
            ?(paymentState==="HALF_PAID"
              ?Math.round((fullPrice/2)*100)/100
              :fullPrice)
            :firstPayment,
          legacyImported:imported,
          specialistPayPerSession:service?fixedPayFor(service,fullPrice/Number(lessons)):0,
          payConfig:service?payConfigFor(service):undefined,
        }
      })

      if(!imported&&firstPayment>0){
        await tx.coursePayment.create({
          data:{
            courseId:created.id,
            amount:firstPayment,
            kind:normalizedPaymentMode==="HALF"?"FIRST_HALF":"FULL",
            paidAt:now,
          }
        })
      }

      return created
    })

    return reply.status(201).send(course)
  })

  app.get('/clients/:clientId/courses', { preHandler: [authMiddleware] }, async (req, reply) => {
    if (!await canReadClient(req.user, req.params.clientId)) return reply.code(403).send({ message: 'Недостаточно прав.' })
    return prisma.course.findMany({ where: { clientId: req.params.clientId, voidedAt: null }, include: { service: true }, orderBy: { createdAt: 'desc' } })
  })
  app.get("/courses",{preHandler:[authMiddleware,roleMiddleware(["ADMIN"])]},async()=>prisma.course.findMany({where:{voidedAt:null},include:{client:true,service:true},orderBy:{createdAt:'desc'}}))

  app.delete('/courses/:id', { preHandler: [authMiddleware,roleMiddleware(['ADMIN'])] }, async(req,reply)=>{
    return prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      const course=await tx.course.findUnique({where:{id:req.params.id},include:{_count:{select:{appointments:true}},payments:true}})
      if(!course)return reply.code(404).send({message:'COURSE_NOT_FOUND'})
      if(course.voidedAt)return {ok:true,preservedHistory:true}
      if(course._count.appointments>0 || course.usedLessons>0)return reply.code(409).send({message:'COURSE_HAS_APPOINTMENTS'})
      const paid=Math.round(course.payments.reduce((sum,p)=>sum+p.amount,0)*100)/100
      const now=new Date()
      if(paid>0)await tx.coursePayment.create({data:{courseId:course.id,amount:-paid,kind:'REFUND',paidAt:now}})
      await tx.course.update({where:{id:course.id},data:{voidedAt:now,voidReason:'Отмена неиспользованного курса администратором'}})
      return {ok:true,preservedHistory:true,refundRecorded:paid,message:'Отмена отражена в учёте. Возврат денег клиенту выполните отдельно.'}
    })
  })

  app.patch('/courses/:id/complete-payment', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (req, reply) => {
    return prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201620)`
      const course = await tx.course.findUnique({ where: { id: req.params.id } })
      if (!course || course.voidedAt) return reply.code(404).send({ message: 'COURSE_NOT_FOUND' })
      if (course.paymentState === 'PAID') return course
      if (course.paymentState !== 'HALF_PAID') return reply.code(409).send({ message: 'COURSE_NOT_HALF_PAID' })
      const remaining = Math.max(0, Math.round((Number(course.price) - Number(course.paidAmount || 0)) * 100) / 100)
      const now = new Date()
      if (remaining > 0) await tx.coursePayment.create({ data: { courseId: course.id, amount: remaining, kind: 'SECOND_HALF', paidAt: now } })
      return tx.course.update({ where: { id: course.id }, data: { paymentState: 'PAID', isPaid: true, paidAmount: Number(course.price), paidAt: now } })
    })
  })

  app.patch('/courses/:id/payment', { preHandler: [authMiddleware, roleMiddleware(['ADMIN'])] }, async (_req, reply) =>
    reply.code(410).send({ message: 'Обновите страницу и используйте кнопку доплаты курса.' }))
}
