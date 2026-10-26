import { chromium as playwright } from '@playwright/test'
import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const cwd=fileURLToPath(new URL('../',import.meta.url))
const output=resolve(cwd,'test-results')
mkdirSync(output,{recursive:true})
const child=spawn(process.execPath,[resolve(cwd,'node_modules/vite/bin/vite.js'),'--port','4173','--strictPort'],{cwd,stdio:'ignore',env:process.env})
const base='http://127.0.0.1:4173'
for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await new Promise(r=>setTimeout(r,200))}
const executablePath=process.env.DORSUM_CHROMIUM_EXECUTABLE
let browser
const results=[]
const errors=[]
try {
 browser=await playwright.launch({executablePath,args:process.env.DORSUM_CHROMIUM_ARGS?JSON.parse(process.env.DORSUM_CHROMIUM_ARGS):undefined,headless:true})
 const context=await browser.newContext()
 const page=await context.newPage()
 page.on('pageerror',e=>errors.push(e.message))
 const service={id:'demo-service',title:'Индивидуальное занятие с реабилитологом',price:720,durationMinutes:60,category:'KINESIOTHERAPY',audience:'ALL',isPackage:false,groupAllowed:false,maxClients:1,specialistPayMode:'FIXED',specialistPayPerSession:120,active:true}
 const pkg={...service,id:'demo-package',title:'Детский курс кинезиотерапии',isPackage:true,packageSessions:12,audience:'CHILD',price:7200}
 const specialist={id:'demo-specialist',fullName:'Тестовый специалист',color:'#3b82f6',specializations:['REHABILITATION_SPECIALIST']}
 const client={id:'demo-client',fullName:'Тестовый ребёнок',phone:'+380671111111',active:true,managedOnly:true,courses:[],appointments:[],user:null}
 const start=new Date();start.setUTCHours(10,0,0,0)
 const end=new Date(start.getTime()+3600000)
 const appointment={id:'demo-appointment',clientId:client.id,specialistId:specialist.id,serviceId:service.id,client,specialist,service,startTime:start.toISOString(),endTime:end.toISOString(),duration:60,status:'SCHEDULED',paymentStatus:'PAID',price:720,course:null,courseId:null,specialistPay:120}
 const course={id:'demo-course',clientId:client.id,client,service:pkg,title:pkg.title,totalLessons:12,usedLessons:3,price:7200,paidAmount:3600,paymentState:'HALF_PAID',isPaid:false,legacyImported:false}
 const summary={period:{start:start.toISOString(),end:end.toISOString()},cash:{appointments:720,courses:3600,inventory:0,total:4320},payroll:[],totalPayroll:0,expensesTotal:0,netAfterExpenses:4320,afterPayroll:4320,massagePayroll:{enabled:true,tiers:[]},payments:{appointments:[],courses:[],inventory:[],expenses:[]}}
 await page.route(base+'/api/**',async route=>{
   const url=new URL(route.request().url()), path=url.pathname.replace(/^\/api/,'')
   let body=[]
   if(path==='/auth/refresh')body={user:{id:'demo-admin',role:'ADMIN',phone:'+380671111110'},accessToken:'demo-test-token'}
   else if(path==='/services/admin'||path==='/services')body=[service,pkg]
   else if(path==='/clients')body=[client,{...client,id:'demo-client-two',fullName:'Второй ребёнок'}]
   else if(path==='/courses')body=[course]
   else if(path==='/appointments')body=[appointment]
   else if(path==='/specialists')body=[specialist]
   else if(path==='/finance/summary')body=summary
   else if(path.endsWith('/courses'))body=[course]
   else if(path==='/appointments/available')body={clients:[client],specialists:[specialist],joinableGroupSessions:[]}
   else if(path.endsWith('/details'))body={...client,appointments:[appointment],courses:[course]}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)})
 })
 for(const width of [320,375,390,768,1024,1440]){
   await page.setViewportSize({width,height:width===1024?768:1000})
   for(const path of ['/admin/services','/admin/courses','/admin/clients','/admin/finance','/admin','/']){
     await page.goto(base+path);await page.waitForTimeout(500)
     await page.waitForTimeout(350)
     const measurement=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth}))
     results.push({width,path,...measurement})
     if(measurement.scroll>width+2)errors.push('Horizontal overflow '+width+' '+path+' '+measurement.scroll)
     if(path==='/admin/services'){
       await page.getByRole('button',{name:'Детский курс',exact:true}).click()
       await page.waitForTimeout(100)
       const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}))
       if(m.scroll>width+2)errors.push('Editor overflow '+width)
       results.push({width,path:path+' / child editor',...m})
       if(process.env.UI_SCREENSHOTS==='1')await page.screenshot({path:resolve(output,'services-'+width+'.png'),fullPage:true})
     }
     if(path==='/admin' && await page.locator('.fc-event').count()) {
       await page.locator('.fc-event').first().click({force:true})
       await page.getByRole('button',{name:'Открыть занятие',exact:true}).click()
       await page.locator('.appointment-admin-editor').waitFor({state:'visible'})
       const fit=await page.evaluate(()=>{
         const editor=document.querySelector('.appointment-admin-editor')
         const bounds=editor.getBoundingClientRect()
         return {scroll:document.documentElement.scrollWidth,width:innerWidth,controlsFit:[...editor.querySelectorAll('input,select')].every(e=>{const r=e.getBoundingClientRect();return r.left>=bounds.left-2&&r.right<=bounds.right+2})}
       })
       results.push({width,path:'/admin / appointment editor',...fit})
       if(fit.scroll>width+2||!fit.controlsFit)errors.push('Appointment editor overflow '+width)
     }
   }
 }
 writeFileSync(resolve(output,'ui-smoke.json'),JSON.stringify({results,errors},null,2))
 console.log(JSON.stringify({checks:results.length,errors},null,2))
} finally { if(browser)await browser.close();child.kill('SIGTERM');if(child.exitCode===null)await new Promise(r=>{child.once('exit',r);setTimeout(r,2000)}) }
if(errors.length)process.exit(1)

