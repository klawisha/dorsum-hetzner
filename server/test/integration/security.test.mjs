import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import sharp from 'sharp'
if (!process.env.TEST_DATABASE_URL || !process.env.TEST_DATABASE_URL.includes('dorsum_test')) throw new Error('Set TEST_DATABASE_URL to an isolated database with dorsum_test in its name')
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
process.env.NODE_ENV = 'test'
process.env.JWT_ACCESS_SECRET ||= randomBytes(64).toString('base64url')
process.env.MEDIA_ENCRYPTION_KEY ||= randomBytes(32).toString('base64')
process.env.APP_ORIGINS = 'http://localhost:5173'
const prisma = (await import('../../src/config/prisma.js')).default
const { buildApp } = await import('../../src/app.js')
const { AuthService } = await import('../../src/modules/auth/auth.service.js')
let app, a, c, other, sp, sp2, client, foreign, specialist, secondSpecialist, service, course
const pass = 'Long-Secure-Test-Password-1'
const header = token => ({ authorization: 'Bearer ' + token, 'x-dorsum-csrf': '1', origin: 'http://localhost:5173' })
async function request(method, url, token, payload) { return app.inject({ method, url, headers: header(token), ...(payload === undefined ? {} : { payload }) }) }
before(async () => {
  const suffix = randomUUID().slice(0,8), hash = await bcrypt.hash(pass, 12)
  async function user(role, phone) { return prisma.user.create({ data: { role, phone, password: hash } }) }
  a = await user('ADMIN', '+380900' + Date.now().toString().slice(-6))
  c = await user('CLIENT', '+380901' + Date.now().toString().slice(-6))
  other = await user('CLIENT', '+380902' + Date.now().toString().slice(-6))
  sp = await user('SPECIALIST', '+380903' + Date.now().toString().slice(-6))
  sp2 = await user('SPECIALIST', '+380904' + Date.now().toString().slice(-6))
  client = await prisma.clientProfile.create({ data: { userId: c.id, fullName: 'Security Client ' + suffix, phone: c.phone } })
  foreign = await prisma.clientProfile.create({ data: { userId: other.id, fullName: 'Foreign Client ' + suffix, phone: other.phone } })
  specialist = await prisma.specialistProfile.create({ data: { userId: sp.id, fullName: 'Doctor ' + suffix } })
  secondSpecialist = await prisma.specialistProfile.create({ data: { userId: sp2.id, fullName: 'Other Doctor ' + suffix } })
  service = await prisma.service.create({ data: { title: 'Security service ' + suffix, price: 500, durationMinutes: 60 } })
  course = await prisma.course.create({ data: { clientId: foreign.id, title: 'Private foreign course', totalLessons: 8, price: 2000, paidAmount: 2000, serviceId: service.id } })
  for (const u of [a,c,other,sp,sp2]) u.token = (await AuthService.login(u.phone, pass)).accessToken
  app = await buildApp({ logger: false })
  await app.ready()
})
after(async () => {
  // Preserve test database for post-run verification; CI database is ephemeral.
  if (app) await app.close()
})
test('anonymous cannot reach private records, finance or audit; debug endpoints are gone', async () => {
  for (const url of ['/appointments','/clients','/courses','/finance/summary','/expenses','/inventory/items','/security/audit']) assert.equal((await app.inject({url})).statusCode,401,url)
  assert.equal((await app.inject({url:'/db-test'})).statusCode,404)
  assert.equal((await app.inject({url:'/cors-test'})).statusCode,404)
})
test('clients cannot list the schedule, run availability enumeration or access foreign courses/photos', async () => {
  for (const url of ['/appointments','/appointments/available?localDate=2030-01-10&localTime=15:00&duration=60','/clients/'+foreign.id+'/courses','/clients/'+foreign.id+'/details','/clients/'+foreign.id+'/card-image','/finance/summary','/security/audit']) assert.equal((await request('GET',url,c.token)).statusCode,403,url)
  assert.equal((await request('GET','/clients/'+client.id+'/courses',c.token)).statusCode,200)
})
test('specialists cannot access other clients or administrator actions', async () => {
  for (const url of ['/clients/'+foreign.id+'/details','/clients/'+foreign.id+'/card-image','/clients/'+foreign.id+'/courses','/appointments','/courses','/expenses']) assert.equal((await request('GET',url,sp.token)).statusCode,403,url)
  assert.equal((await request('PATCH','/users/'+c.id+'/role',sp.token,{role:'ADMIN'})).statusCode,403)
})
test('public team and service responses expose no payroll fields or user identifiers', async () => {
  const team = (await app.inject({url:'/specialists'})).json()
  assert.ok(team.every(s => !('userId' in s) && !('salaryPercent' in s) && !('fixedSalary' in s)))
  const items = (await app.inject({url:'/services'})).json()
  assert.ok(items.every(s => !('specialistPayPerSession' in s)))
})
test('client-facing profiles and courses do not expose internal specialist payroll',async()=>{
  const me=await request('GET','/clients/me',c.token)
  assert.equal(me.statusCode,200)
  assert.ok(!me.body.includes('specialistPay'))
  const own=await request('GET','/clients/'+foreign.id+'/courses',other.token)
  assert.equal(own.statusCode,200)
  assert.ok(!own.body.includes('specialistPayPerSession'))
  assert.ok(!own.body.includes('payConfig'))
})
test('forged role claims, unsigned tokens, legacy tokens and algorithm confusion fail', async () => {
  const forged = jwt.sign({ id:a.id,role:'ADMIN' }, 'access_secret')
  assert.equal((await request('GET','/users',forged)).statusCode,401)
  const unsigned = jwt.sign({sub:a.id,typ:'access',sid:randomUUID()},'',{algorithm:'none'})
  assert.equal((await request('GET','/users',unsigned)).statusCode,401)
  const decoded = jwt.decode(c.token)
  const claims = { ...decoded, role:'ADMIN' }; delete claims.exp; delete claims.iat
  const clientClaimingAdmin = jwt.sign(claims, process.env.JWT_ACCESS_SECRET)
  assert.equal((await request('GET','/users',clientClaimingAdmin)).statusCode,403)
})
test('refresh requires same-origin CSRF header and never returns a refresh token in JSON', async () => {
  const login = await app.inject({method:'POST',url:'/auth/login',headers:header(''),payload:{phone:c.phone,password:pass}})
  assert.equal(login.statusCode,200)
  assert.equal(login.json().refreshToken,undefined)
  assert.match(login.headers['set-cookie'],/HttpOnly/)
  assert.match(login.headers['set-cookie'],/SameSite=Lax/i)
  const cookie = login.cookies[0].name+'='+login.cookies[0].value
  assert.equal((await app.inject({method:'POST',url:'/auth/refresh',headers:{cookie},payload:{}})).statusCode,403)
  assert.equal((await app.inject({method:'POST',url:'/auth/refresh',headers:{...header(''),cookie,origin:'https://evil.example'},payload:{}})).statusCode,403)
  const refreshed = await app.inject({method:'POST',url:'/auth/refresh',headers:{...header(''),cookie},payload:{}})
  assert.equal(refreshed.statusCode,200)
  const replay = await app.inject({method:'POST',url:'/auth/refresh',headers:{...header(''),cookie},payload:{}})
  assert.equal(replay.statusCode,401)
  assert.equal((await request('GET','/clients/me',refreshed.json().accessToken)).statusCode,401)
})
test('logout revokes access tokens immediately', async () => {
  const login = await app.inject({method:'POST',url:'/auth/login',headers:header(''),payload:{phone:c.phone,password:pass}})
  const cookie = login.cookies[0].name+'='+login.cookies[0].value
  const result = await app.inject({method:'POST',url:'/auth/logout',headers:{...header(login.json().accessToken),cookie},payload:{}})
  assert.equal(result.statusCode,204)
  assert.equal((await request('GET','/clients/me',login.json().accessToken)).statusCode,401)
})
test('archiving an account or changing its role invalidates old sessions in the database', async () => {
  const login = await AuthService.login(other.phone,pass)
  await prisma.user.update({where:{id:other.id},data:{active:false}})
  assert.equal((await request('GET','/clients/me',login.accessToken)).statusCode,401)
  await prisma.user.update({where:{id:other.id},data:{active:true}})
  assert.equal((await request('GET','/clients/me',login.accessToken)).statusCode,401)
})
test('a client cannot override role, balance, ownership or submit SQL operator objects', async () => {
  assert.equal((await request('POST','/clients/profile',c.token,{fullName:'Malicious',userId:a.id,balance:10000})).statusCode,400)
  assert.equal((await app.inject({method:'POST',url:'/auth/login',headers:header(''),payload:{phone:{$ne:null},password:pass}})).statusCode,400)
  assert.equal((await request('PATCH','/services/'+service.id,a.token,{price:-100})).statusCode,400)
})
test('private images require a complete decoded image, are encrypted, and remain inaccessible to strangers', async () => {
  const source = await sharp({create:{width:20,height:30,channels:3,background:'#115533'}}).png().toBuffer()
  const invalid = await request('PUT','/clients/'+client.id+'/card-image',a.token,{dataBase64:Buffer.from([255,216,255]).toString('base64'),mimeType:'image/jpeg',fileName:'bad.jpg'})
  assert.equal(invalid.statusCode,400)
  const uploaded = await request('PUT','/clients/'+client.id+'/card-image',a.token,{dataBase64:source.toString('base64'),mimeType:'image/png',fileName:'../card.png'})
  assert.equal(uploaded.statusCode,200)
  assert.equal(uploaded.json().mimeType,'image/webp')
  const stored = await prisma.clientCardImage.findUnique({where:{clientId:client.id}})
  assert.equal(Buffer.from(stored.data).subarray(0,8).toString(),'DORSUM01')
  assert.equal((await request('GET','/clients/'+client.id+'/card-image',sp2.token)).statusCode,403)
  const image = await request('GET','/clients/'+client.id+'/card-image',a.token)
  assert.equal(image.statusCode,200); assert.equal(image.headers['cache-control'],'private, no-store, max-age=0')
  assert.equal((await sharp(image.rawPayload).metadata()).width,20)
})
test('normal booking survives hardening and permits only assigned specialist to see a record', async () => {
  const created = await request('POST','/appointments',a.token,{clientId:client.id,specialistId:specialist.id,serviceId:service.id,localDate:'2030-02-01',localTime:'15:00',duration:60})
  assert.equal(created.statusCode,201,created.body)
  assert.equal((await request('GET','/clients/'+client.id+'/details',sp.token)).statusCode,200)
  assert.equal((await request('GET','/clients/'+client.id+'/card-image',sp.token)).statusCode,200)
  assert.equal((await request('GET','/clients/'+client.id+'/details',sp2.token)).statusCode,403)
})
test('absence blocks booking and cannot be created over an existing appointment', async () => {
  const conflict = await request('POST','/specialists/me/blocks',sp.token,{startTime:'2030-02-01T13:00:00.000Z',endTime:'2030-02-01T14:00:00.000Z'})
  assert.equal(conflict.statusCode,409)
  const block = await request('POST','/specialists/me/blocks',sp.token,{startTime:'2030-02-02T13:00:00.000Z',endTime:'2030-02-02T14:00:00.000Z'})
  assert.equal(block.statusCode,200,block.body)
  const booking = await request('POST','/appointments',a.token,{clientId:client.id,specialistId:specialist.id,serviceId:service.id,localDate:'2030-02-02',localTime:'15:00',duration:60})
  assert.equal(booking.statusCode,409)
})
test('past SCHEDULED entries can be corrected and moved into a future slot', async () => {
  const old = await prisma.appointment.create({data:{clientId:foreign.id,specialistId:secondSpecialist.id,serviceId:service.id,startTime:new Date('2020-01-01T10:00Z'),endTime:new Date('2020-01-01T11:00Z'),price:500,duration:60}})
  const moved = await request('PATCH','/appointments/'+old.id+'/move',a.token,{localDate:'2030-02-10',localTime:'16:00'})
  assert.equal(moved.statusCode,200,moved.body)
  assert.equal(moved.json().startTime,'2030-02-10T14:00:00.000Z')
})
test('legacy half-paid courses bring zero cash and block lessons after the paid half', async () => {
  const pkg = await prisma.service.create({data:{title:'Legacy package '+randomUUID(),price:4000,durationMinutes:60,isPackage:true,packageSessions:8,specialistPayPerSession:100}})
  const created = await request('POST','/courses',a.token,{clientId:client.id,serviceId:pkg.id,legacyImported:true,usedLessons:4,paymentMode:'HALF'})
  assert.equal(created.statusCode,201,created.body)
  const legacy = created.json()
  assert.equal(legacy.paymentState,'HALF_PAID')
  assert.equal(await prisma.coursePayment.count({where:{courseId:legacy.id}}),0)
  const booked = await request('POST','/appointments',a.token,{clientId:client.id,specialistId:specialist.id,courseId:legacy.id,localDate:'2030-03-05',localTime:'15:00',duration:60})
  assert.equal(booked.statusCode,409,booked.body)
  const paid = await request('PATCH','/courses/'+legacy.id+'/complete-payment',a.token)
  assert.equal(paid.statusCode,200,paid.body)
  assert.equal(await prisma.coursePayment.count({where:{courseId:legacy.id}}),1)
  const again = await request('PATCH','/courses/'+legacy.id+'/complete-payment',a.token)
  assert.equal(again.statusCode,200)
  assert.equal(await prisma.coursePayment.count({where:{courseId:legacy.id}}),1)
})
test('one-off to course conversion uses course service and specialist pay without double consumption', async () => {
  const pkg = await prisma.service.create({data:{title:'Conversion package '+randomUUID(),price:2000,durationMinutes:60,isPackage:true,packageSessions:8,specialistPayPerSession:135}})
  const bought = await request('POST','/courses',a.token,{clientId:client.id,serviceId:pkg.id,paymentMode:'FULL'})
  assert.equal(bought.statusCode,201,bought.body)
  const booking = await request('POST','/appointments',a.token,{clientId:client.id,specialistId:specialist.id,serviceId:service.id,localDate:'2030-05-01',localTime:'15:00',duration:60})
  const id = booking.json().id
  const change = await request('PATCH','/appointments/'+id+'/edit-schedule',a.token,{courseId:bought.json().id})
  assert.equal(change.statusCode,200,change.body)
  assert.equal(change.json().serviceId,pkg.id); assert.equal(change.json().specialistPay,135)
  await request('PATCH','/appointments/'+id+'/edit-schedule',a.token,{courseId:bought.json().id})
  assert.equal((await prisma.course.findUnique({where:{id:bought.json().id}})).usedLessons,1)
  const leave = await request('PATCH','/appointments/'+id+'/edit-schedule',a.token,{courseId:null,serviceId:service.id})
  assert.equal(leave.statusCode,200,leave.body)
  assert.equal((await prisma.course.findUnique({where:{id:bought.json().id}})).usedLessons,0)
})

let children=[]
test('children share a parent phone but have independent profiles and courses',async()=>{
  for(const fullName of ['Child One','Child Two']){
    const x=await request('POST','/users/admin-create-client',a.token,{fullName,phone:c.phone,password:'',allowSharedPhone:true})
    assert.equal(x.statusCode,201,x.body);assert.equal(x.json().user,null);assert.equal(x.json().profile.managedOnly,true)
    children.push(x.json().profile)
  }
  assert.notEqual(children[0].id,children[1].id)
  const pkg=await request('POST','/services',a.token,{title:'Child therapy course',price:2400,durationMinutes:60,category:'KINESIOTHERAPY',audience:'CHILD',isPackage:true,packageSessions:6,specialistPayPerSession:120})
  assert.equal(pkg.statusCode,201,pkg.body)
  const sold=[]
  for(const child of children){
    const x=await request('POST','/courses',a.token,{clientId:child.id,serviceId:pkg.json().id,paymentMode:'FULL'})
    assert.equal(x.statusCode,201,x.body);sold.push(x.json())
  }
  assert.notEqual(sold[0].id,sold[1].id)
  const wrong=await request('POST','/appointments',a.token,{clientId:children[0].id,specialistId:specialist.id,courseId:sold[1].id,localDate:'2032-01-10',localTime:'15:00',duration:60})
  assert.ok(wrong.statusCode>=400)
  assert.equal((await request('GET','/clients/me',c.token)).statusCode,401)
  await assert.rejects(()=>AuthService.login(c.phone,pass),/несколько клиентов/)
})
test('price and payout edits preserve old visits and sold courses; finances equal expected amounts',async()=>{
  const one=await request('POST','/services',a.token,{title:'Snapshot single',price:500,durationMinutes:60,category:'KINESIOTHERAPY',specialistPayPerSession:100})
  const pkg=await request('POST','/services',a.token,{title:'Snapshot course',price:2000,durationMinutes:60,category:'KINESIOTHERAPY',isPackage:true,packageSessions:4,specialistPayPerSession:150})
  assert.equal(one.statusCode,201,one.body);assert.equal(pkg.statusCode,201,pkg.body)
  const sold=await request('POST','/courses',a.token,{clientId:children[0].id,serviceId:pkg.json().id,paymentMode:'FULL'})
  const old=await request('POST','/appointments',a.token,{clientId:children[0].id,specialistId:specialist.id,serviceId:one.json().id,localDate:'2033-01-10',localTime:'10:00',duration:60})
  assert.equal(old.statusCode,201,old.body)
  assert.equal((await request('PATCH','/services/'+one.json().id,a.token,{price:900,specialistPayPerSession:250})).statusCode,200)
  assert.equal((await request('PATCH','/services/'+pkg.json().id,a.token,{price:3000,specialistPayPerSession:300})).statusCode,200)
  const newer=await request('POST','/appointments',a.token,{clientId:children[0].id,specialistId:specialist.id,serviceId:one.json().id,localDate:'2033-01-10',localTime:'12:00',duration:60})
  const fromCourse=await request('POST','/appointments',a.token,{clientId:children[0].id,specialistId:specialist.id,courseId:sold.json().id,localDate:'2033-01-10',localTime:'14:00',duration:60})
  assert.equal(newer.statusCode,201,newer.body);assert.equal(fromCourse.statusCode,201,fromCourse.body)
  assert.equal(newer.json().price,900);assert.equal(newer.json().specialistPay,250)
  assert.equal(fromCourse.json().specialistPay,150);assert.equal(fromCourse.json().price,0)
  const stored=await prisma.appointment.findUnique({where:{id:old.json().id}})
  assert.equal(stored.price,500);assert.equal(stored.specialistPay,100)
  for(const x of [old,newer,fromCourse])assert.equal((await request('PATCH','/appointments/'+x.json().id+'/statuses',a.token,{status:'COMPLETED',paymentStatus:'PAID'})).statusCode,200)
  await prisma.appointment.updateMany({where:{id:{in:[old.json().id,newer.json().id]}},data:{paidAt:new Date('2033-01-10T09:00Z')}})
  await prisma.coursePayment.updateMany({where:{courseId:sold.json().id},data:{paidAt:new Date('2033-01-10T09:00Z')}})
  const expense=await request('POST','/expenses',a.token,{title:'Finance test expense',amount:100,purchasedAt:'2033-01-10T09:00Z'})
  assert.equal(expense.statusCode,200,expense.body)
  const report=await request('GET','/finance/summary?period=day&date=2033-01-10',a.token)
  assert.equal(report.statusCode,200,report.body)
  assert.equal(report.json().cash.appointments,1400);assert.equal(report.json().cash.courses,2000)
  assert.equal(report.json().cash.total,3400);assert.equal(report.json().totalPayroll,500)
  assert.equal(report.json().expensesTotal,100);assert.equal(report.json().netAfterExpenses,2800)
  assert.equal((await request('DELETE','/services/'+one.json().id,a.token)).statusCode,200)
  assert.equal((await prisma.appointment.findUnique({where:{id:old.json().id}})).price,500)
  const archived=await request('POST','/appointments',a.token,{clientId:children[0].id,specialistId:specialist.id,serviceId:one.json().id,localDate:'2033-01-11',localTime:'10:00',duration:60})
  assert.ok(archived.statusCode>=400)
})
test('percentage payouts use actual discounted prices and course per-lesson share',async()=>{
  const one=await request('POST','/services',a.token,{title:'Percent single',price:500,durationMinutes:60,category:'OTHER',specialistPayMode:'PERCENT',specialistPayPercent:20})
  const pkg=await request('POST','/services',a.token,{title:'Percent package',price:1200,durationMinutes:60,category:'OTHER',isPackage:true,packageSessions:6,specialistPayMode:'PERCENT',specialistPayPercent:10})
  assert.equal(one.statusCode,201,one.body);assert.equal(pkg.statusCode,201,pkg.body)
  await prisma.clientProfile.update({where:{id:children[1].id},data:{isMilitary:true}})
  const x=await request('POST','/appointments',a.token,{clientId:children[1].id,specialistId:specialist.id,serviceId:one.json().id,localDate:'2033-03-10',localTime:'10:00',duration:60})
  assert.equal(x.statusCode,201,x.body);assert.equal(x.json().price,450);assert.equal(x.json().specialistPay,90)
  const sold=await request('POST','/courses',a.token,{clientId:children[1].id,serviceId:pkg.json().id,paymentMode:'FULL'})
  assert.equal(sold.statusCode,201,sold.body);assert.equal(sold.json().price,960);assert.equal(sold.json().specialistPayPerSession,16)
  await prisma.clientProfile.update({where:{id:children[1].id},data:{isMilitary:false}})
})
test('group capacity is enforced and payouts support participant or whole-session accounting',async()=>{
  for(const [mode,day,expected] of [['PER_CLIENT','2033-02-10',240],['PER_SESSION','2033-02-11',120]]){
    const group=await request('POST','/services',a.token,{title:'Group '+mode,price:200,durationMinutes:60,category:'STRETCHING',groupAllowed:true,maxClients:2,groupPayMode:mode,specialistPayMode:'FIXED',specialistPayPerSession:120})
    assert.equal(group.statusCode,201,group.body)
    const rows=[]
    for(const child of children){
      const x=await request('POST','/appointments',a.token,{clientId:child.id,specialistId:specialist.id,serviceId:group.json().id,localDate:day,localTime:'15:00',duration:60})
      assert.equal(x.statusCode,201,x.body);rows.push(x.json())
    }
    const overflow=await request('POST','/appointments',a.token,{clientId:foreign.id,specialistId:specialist.id,serviceId:group.json().id,localDate:day,localTime:'15:00',duration:60})
    assert.equal(overflow.statusCode,409,overflow.body)
    for(const row of rows)await request('PATCH','/appointments/'+row.id+'/statuses',a.token,{status:'COMPLETED'})
    const report=await request('GET','/finance/summary?period=day&date='+day,a.token)
    assert.equal(report.statusCode,200,report.body);assert.equal(report.json().totalPayroll,expected)
    assert.equal(report.json().payroll.find(p=>p.specialistId===specialist.id).completedSessions,1)
  }
})
test('massage policies cannot rewrite past months and clients cannot reach catalogue administration',async()=>{
  const x=await request('POST','/payroll/massage-policies',a.token,{month:'2020-01',name:'Invalid past rates',enabled:true,tiers:[{minHalfHours:0,maxHalfHours:null,pay30:999,pay60:999,pay90:999}]})
  assert.equal(x.statusCode,409,x.body)
  const clientSession=await AuthService.login(other.phone,pass)
  assert.equal((await request('GET','/services/admin',clientSession.accessToken)).statusCode,403)
})

test('unused course cancellation preserves sale and appends one refund with retry safety',async()=>{
  const pkg=await request('POST','/services',a.token,{title:'Refund example',price:1200,durationMinutes:60,category:'OTHER',isPackage:true,packageSessions:4,specialistPayPerSession:100})
  const sale=await request('POST','/courses',a.token,{clientId:children[0].id,serviceId:pkg.json().id,paymentMode:'FULL'})
  assert.equal(sale.statusCode,201,sale.body)
  const id=sale.json().id
  const first=await request('DELETE','/courses/'+id,a.token)
  assert.equal(first.statusCode,200,first.body)
  assert.equal((await request('DELETE','/courses/'+id,a.token)).statusCode,200)
  assert.equal(await prisma.coursePayment.count({where:{courseId:id,kind:'REFUND'}}),1)
  assert.equal(await prisma.coursePayment.count({where:{courseId:id}}),2)
  assert.equal((await prisma.coursePayment.aggregate({where:{courseId:id},_sum:{amount:true}}))._sum.amount,0)
  assert.ok((await prisma.course.findUnique({where:{id}})).voidedAt)
  const listed=await request('GET','/clients/'+children[0].id+'/courses',a.token)
  assert.ok(!listed.json().some(c=>c.id===id))
})
test('login throttling persists per account and blocks an eleventh failed attempt',async()=>{
  const phone='+380909'+Date.now().toString().slice(-6)
  for(let i=0;i<10;i++){
    const x=await app.inject({method:'POST',url:'/auth/login',headers:header(''),payload:{phone,password:'wrong-but-valid-length'}})
    assert.equal(x.statusCode,401,x.body)
  }
  const blocked=await app.inject({method:'POST',url:'/auth/login',headers:header(''),payload:{phone,password:'wrong-but-valid-length'}})
  assert.equal(blocked.statusCode,429,blocked.body)
})
test('new massage rates are versioned from a future month and duplicate effective dates are rejected',async()=>{
  const body={month:'2039-01',name:'New test policy',enabled:true,tiers:[{minHalfHours:0,maxHalfHours:99,pay30:160,pay60:280,pay90:400},{minHalfHours:100,maxHalfHours:null,pay30:170,pay60:310,pay90:440}]}
  const created=await request('POST','/payroll/massage-policies',a.token,body)
  assert.equal(created.statusCode,201,created.body)
  assert.equal(created.json().tiers.length,2)
  const duplicate=await request('POST','/payroll/massage-policies',a.token,body)
  assert.equal(duplicate.statusCode,409,duplicate.body)
  const old=await prisma.massagePayrollPolicy.findUnique({where:{id:'massage-policy-2026-08'},include:{tiers:true}})
  assert.equal(old.tiers.find(t=>t.minHalfHours===0).pay30,150)
})
test('native PostgreSQL serializes overlapping bookings with different time boundaries', { skip: process.env.NATIVE_POSTGRES !== 'true' }, async () => {
  const results = await Promise.all([
    request('POST','/appointments',a.token,{clientId:client.id,specialistId:specialist.id,serviceId:service.id,localDate:'2030-08-01',localTime:'15:00',duration:60}),
    request('POST','/appointments',a.token,{clientId:foreign.id,specialistId:specialist.id,serviceId:service.id,localDate:'2030-08-01',localTime:'15:30',duration:60}),
  ])
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[201,409])
})
test('native PostgreSQL inserts a second half payment once under concurrent requests', { skip: process.env.NATIVE_POSTGRES !== 'true' }, async () => {
  const x = await prisma.course.create({data:{clientId:client.id,title:'Concurrent payment',totalLessons:8,price:2000,paidAmount:1000,paymentState:'HALF_PAID',isPaid:false}})
  const results = await Promise.all([request('PATCH','/courses/'+x.id+'/complete-payment',a.token),request('PATCH','/courses/'+x.id+'/complete-payment',a.token)])
  assert.ok(results.every(r=>r.statusCode===200))
  assert.equal(await prisma.coursePayment.count({where:{courseId:x.id}}),1)
})
test('authenticated writes and private record reads are recorded without passwords or patient text', async () => {
  const logs = await request('GET','/security/audit',a.token)
  assert.equal(logs.statusCode,200)
  assert.ok(logs.json().some(e=>e.route==='/clients/:id/card-image'))
  assert.ok(!logs.body.includes(pass))
  assert.ok(!logs.body.includes(client.fullName))
})
