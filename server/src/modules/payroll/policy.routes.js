import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'
import { centerWallTimeToUtc } from '../../utils/center-time.js'
import { httpError } from '../../security/errors.js'
export async function payrollPolicyRoutes(app) {
  const admin=[authMiddleware,roleMiddleware(['ADMIN'])]
  app.get('/payroll/massage-policies',{preHandler:admin},async()=>prisma.massagePayrollPolicy.findMany({include:{tiers:{orderBy:{minHalfHours:'asc'}}},orderBy:{effectiveFrom:'desc'}}))
  app.post('/payroll/massage-policies',{preHandler:admin},async(req,reply)=>{
    const {month,name,enabled,tiers}=req.body
    const now=new Date()
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit'}).format(now)
    if(month<=parts) throw httpError(409,'Новая сетка применяется с будущего месяца. Прошлые начисления сохраняются.')
    const sorted=[...tiers].sort((a,b)=>a.minHalfHours-b.minHalfHours)
    if(sorted[0].minHalfHours!==0 || sorted.at(-1).maxHalfHours!==null ||
       sorted.some((tier,i)=>(tier.maxHalfHours!==null && tier.maxHalfHours<tier.minHalfHours) || (i>0 && (sorted[i-1].maxHalfHours===null || tier.minHalfHours!==sorted[i-1].maxHalfHours+1)))) throw httpError(400,'Диапазоны должны идти подряд от 0 до последнего диапазона без верхней границы.')
    const effectiveFrom=centerWallTimeToUtc(month+'-01','00:00')
    const created = await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(78201622)`
      if(await tx.massagePayrollPolicy.findFirst({where:{effectiveFrom}})) throw httpError(409,'На этот месяц сетка уже создана.')
      const next=await tx.massagePayrollPolicy.findFirst({where:{effectiveFrom:{gt:effectiveFrom}},orderBy:{effectiveFrom:'asc'}})
      await tx.massagePayrollPolicy.updateMany({where:{effectiveFrom:{lt:effectiveFrom},OR:[{effectiveTo:null},{effectiveTo:{gt:effectiveFrom}}]},data:{effectiveTo:effectiveFrom}})
      return tx.massagePayrollPolicy.create({data:{name,enabled,effectiveFrom,effectiveTo:next?.effectiveFrom||null,tiers:{create:sorted.map((tier,index)=>({...tier,sortOrder:index}))}},include:{tiers:true}})
    })
    return reply.code(201).send(created)
  })
}
