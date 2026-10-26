import prisma from '../../config/prisma.js'
import { authMiddleware } from '../../middleware/auth.middleware.js'
import { roleMiddleware } from '../../middleware/role.middleware.js'
import {
  halfHourUnits,
  selectMassageTier,
  specialistAppointmentPay,
  tierLabel,
} from '../payroll/massage-payroll.js'

import { centerPeriodRange } from '../../utils/finance-range.js'
import { roundMoney, sessionKey, tracksMassage } from '../payroll/pay-snapshot.js'
const range = centerPeriodRange
const monthRange = date => centerPeriodRange('month',date)

async function activeMassagePolicy(monthStart, monthEnd) {
  return prisma.massagePayrollPolicy.findFirst({
    where: {
      effectiveFrom: { lt: monthEnd },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gt: monthStart } },
      ],
    },
    include: {
      tiers: { orderBy: [{ sortOrder: 'asc' }, { minHalfHours: 'asc' }] },
    },
    orderBy: { effectiveFrom: 'desc' },
  })
}

export async function financeRoutes(app) {
  app.get('/finance/summary', {
    preHandler: [authMiddleware, roleMiddleware(['ADMIN'])],
  }, async (req) => {
    const period = req.query.period === 'month' ? 'month' : 'day'
    const { start, end } = range(period, req.query.date)
    const { start: workloadStart, end: workloadEnd } = monthRange(req.query.date)

    const [
      appointments,
      courses,
      specialists,
      massageWorkload,
      massagePolicy,
      inventorySales,
      expenses,
    ] = await Promise.all([
      prisma.appointment.findMany({
        where: { paymentStatus: 'PAID', paidAt: { gte: start, lt: end } },
        include: { service: true, specialist: true, client: true },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.coursePayment.findMany({
        where: { paidAt: { gte: start, lt: end } },
        include: {
          course: {
            include: { client: true, service: true },
          },
        },
        orderBy: { paidAt: 'desc' },
      }),
      prisma.specialistProfile.findMany({
        include: {
          appointments: {
            where: { status: 'COMPLETED', startTime: { gte: start, lt: end } },
            include: { service: true, client: true },
            orderBy: { startTime: 'asc' },
          },
        },
        orderBy: { fullName: 'asc' },
      }),
      prisma.appointment.findMany({
        where: {
          status: 'COMPLETED',
          startTime: { gte: workloadStart, lt: workloadEnd },
        },
        include: { service: true },
      }),
      activeMassagePolicy(workloadStart, workloadEnd),
      prisma.inventorySale.findMany({
        where: {
          soldAt: { gte: start, lt: end },
          voidedAt: null,
        },
        include: { item: true, client: true },
        orderBy: { soldAt: 'desc' },
      }),
      prisma.expense.findMany({
        where: {
          purchasedAt: { gte: start, lt: end },
          voidedAt: null,
        },
        include: { receipt: { select: { id: true, fileName: true, mimeType: true, byteSize: true } } },
        orderBy: { purchasedAt: 'desc' },
      }),
    ])

    const halfHoursBySpecialist = new Map()
    const countedWork = new Set()
    for (const appointment of massageWorkload) {
      if (!tracksMassage(appointment)) continue
      const workKey = appointment.payConfig?.isGroup ? sessionKey(appointment) : appointment.id
      if (countedWork.has(workKey)) continue
      countedWork.add(workKey)
      halfHoursBySpecialist.set(
        appointment.specialistId,
        (halfHoursBySpecialist.get(appointment.specialistId) || 0) + halfHourUnits(appointment)
      )
    }

    const paidAppointments = appointments.filter((appointment) => !appointment.courseId)
    const appointmentCash = paidAppointments.reduce((sum, appointment) => sum + appointment.price, 0)
    const courseCash = courses.reduce((sum, payment) => sum + payment.amount, 0)
    const inventoryCash = inventorySales.reduce((sum, sale) => sum + sale.total, 0)
    const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0)

    const payroll = specialists.map((specialist) => {
      const massageHalfHours = halfHoursBySpecialist.get(specialist.id) || 0
      const tier = selectMassageTier(massagePolicy, massageHalfHours)

      let amount = 0
      const breakdown = {}
      const paidGroups = new Set(), physicalSessions = new Set(), byServiceSessions = new Set()

      for (const appointment of specialist.appointments) {
        const groupKey = sessionKey(appointment)
        const cfg = appointment.payConfig
        physicalSessions.add(cfg?.isGroup ? groupKey : appointment.id)
        let pay = specialistAppointmentPay(appointment, tier)
        if (cfg?.isGroup && cfg.groupPayMode === 'PER_SESSION') {
          if (paidGroups.has(groupKey)) pay = 0
          else paidGroups.add(groupKey)
        }
        amount = roundMoney(amount + pay)

        const key = appointment.serviceId
        if (!breakdown[key]) {
          breakdown[key] = {
            serviceId: key,
            title: appointment.service.title,
            sessions: 0,
            amount: 0,
            massageHalfHours: 0,
            dynamicMassagePay: false,
            tierWithFixedFloor: false,
          }
        }

        const entryKey = key + ':' + (cfg?.isGroup ? groupKey : appointment.id)
        if (!byServiceSessions.has(entryKey)) { breakdown[key].sessions += 1; byServiceSessions.add(entryKey) }
        breakdown[key].amount = roundMoney(breakdown[key].amount + pay)

        if (tracksMassage(appointment)) {
          breakdown[key].massageHalfHours += halfHourUnits(appointment)
        }

        if ((cfg ? cfg.mode === 'MASSAGE_TIER' : appointment.service.massageTieredPay) && massagePolicy?.enabled && tier) {
          breakdown[key].dynamicMassagePay = true
          if (cfg?.massageUseHigherOfTierAndFixed ?? appointment.service.massageUseHigherOfTierAndFixed) {
            breakdown[key].tierWithFixedFloor = true
          }
        }
      }

      return {
        specialistId: specialist.id,
        fullName: specialist.fullName,
        amount,
        completedSessions: physicalSessions.size,
        completedParticipants: specialist.appointments.length,
        massageHalfHours,
        massageTier: tier
          ? {
              label: tierLabel(tier),
              pay30: tier.pay30,
              pay60: tier.pay60,
              pay90: tier.pay90,
            }
          : null,
        byService: Object.values(breakdown),
      }
    })

    const totalCash = roundMoney(appointmentCash + courseCash + inventoryCash)
    const totalPayroll = roundMoney(payroll.reduce((sum, item) => sum + item.amount, 0))
    const netAfterExpenses = roundMoney(totalCash - totalPayroll - expenseTotal)

    return {
      period: { start, end },
      cash: {
        appointments: roundMoney(appointmentCash),
        courses: roundMoney(courseCash),
        inventory: roundMoney(inventoryCash),
        total: totalCash,
      },
      payroll,
      totalPayroll,
      expensesTotal: roundMoney(expenseTotal),
      afterPayroll: roundMoney(totalCash - totalPayroll),
      netAfterExpenses,
      massagePayroll: {
        enabled: Boolean(massagePolicy?.enabled),
        policyId: massagePolicy?.id || null,
        name: massagePolicy?.name || null,
        effectiveFrom: massagePolicy?.effectiveFrom || null,
        effectiveTo: massagePolicy?.effectiveTo || null,
        tiers: massagePolicy?.tiers || [],
      },
      payments: {
        appointments: paidAppointments.map((appointment) => ({
          id: appointment.id,
          paidAt: appointment.paidAt,
          amount: appointment.price,
          client: appointment.client.fullName,
          service: appointment.service.title,
          specialist: appointment.specialist.fullName,
        })),
        courses: courses.map((payment) => ({
          id: payment.id,
          courseId: payment.courseId,
          paidAt: payment.paidAt,
          amount: payment.amount,
          kind: payment.kind,
          client: payment.course.client.fullName,
          title: payment.course.title,
        })),
        inventory: inventorySales.map((sale) => ({
          id: sale.id,
          paidAt: sale.soldAt,
          amount: sale.total,
          client: sale.client?.fullName || 'Розничная продажа',
          title: `${sale.item.name} × ${sale.quantity}`,
        })),
        expenses: expenses.map((expense) => ({
          id: expense.id,
          purchasedAt: expense.purchasedAt,
          amount: expense.amount,
          title: expense.title,
          note: expense.note,
          receipt: expense.receipt,
        })),
      },
    }
  })
}
