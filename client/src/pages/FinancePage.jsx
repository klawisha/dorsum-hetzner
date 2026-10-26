import { useEffect, useMemo, useState } from 'react'
import { formatCenterDateTime } from '../utils/centerTime'
import { financeApi } from '../features/finance.api'
import SpinePullRefresh from '../components/SpinePullRefresh'
import DorsumLoader from '../components/DorsumLoader'
import FinanceMonthPulse from '../components/FinanceMonthPulse'

const money = (v) => `${Number(v || 0).toFixed(2)} грн`
const monthValue = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function FinancePage() {
  const [month, setMonth] = useState(monthValue())
  const [period, setPeriod] = useState('month')
  const [day, setDay] = useState(() => new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Kyiv',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()))
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await financeApi.summary(period, period === 'month' ? `${month}-01` : day)
      setSummary(response.data)
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Не удалось загрузить финансы')
    } finally {
      setLoading(false)
      setHasLoadedOnce(true)
    }
  }

  useEffect(() => {
    load()
  }, [month, period, day])

  const title = useMemo(
    () => new Intl.DateTimeFormat('ru-RU', period === 'month' ? { month:'long',year:'numeric',timeZone:'Europe/Kyiv' } : { day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Kyiv' })
      .format(new Date((period === 'month' ? month+'-01' : day)+'T12:00:00Z')),
    [month,day,period],
  )

  const allPayments = summary
    ? [
        ...summary.payments.appointments.map((item) => ({ ...item, type: item.service })),
        ...summary.payments.courses.map((item) => ({ ...item, type: `Курс: ${item.title}`, specialist: '—' })),
        ...(summary.payments.inventory || []).map((item) => ({
          ...item,
          type: `Инвентарь: ${item.title}`,
          specialist: '—',
        })),
      ].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))
    : []

  return (
    <div className="admin-page finance-page">
      <DorsumLoader
        active={loading && !hasLoadedOnce}
        fullscreen={false}
        label="Собираем финансовые данные"
      />
      <div className="finance-top-controls">
        <div className="finance-header">
          <div>
            <p className="finance-eyebrow">ФИНАНСЫ</p>
            <h1 style={{ marginBottom: 4 }}>Доходы и расходы центра</h1>
            <p className="finance-muted">{title}</p>
          </div>
          <div className="finance-period-controls"><select aria-label="Финансовый период" value={period} onChange={e=>setPeriod(e.target.value)}><option value="day">За день</option><option value="month">За месяц</option></select>{period === 'month' ? <input type="month" value={month} onChange={e=>setMonth(e.target.value)}/> : <input type="date" value={day} onChange={e=>setDay(e.target.value)}/>}</div>
        </div>

        {summary && !loading && (
          <div className="finance-top-insights">
            {period === 'month' && <FinanceMonthPulse summary={summary} month={month} />}
            <SpinePullRefresh onRefresh={load} refreshing={loading} />
          </div>
        )}
        {(!summary || loading) && <SpinePullRefresh onRefresh={load} refreshing={loading} />}
      </div>

      {error && <div className="finance-error">{error}</div>}
      {loading && hasLoadedOnce && <div className="finance-refreshing-note">Обновляем данные…</div>}

      {summary && !loading && (
        <>
          <div className="finance-kpis">
            <div className="finance-card"><span>Касса за {period === 'month' ? 'месяц' : 'день'}</span><strong>{money(summary.cash.total)}</strong></div>
            <div className="finance-card"><span>Разовые оплаты</span><strong>{money(summary.cash.appointments)}</strong></div>
            <div className="finance-card"><span>Курсы</span><strong>{money(summary.cash.courses)}</strong></div>
            <div className="finance-card"><span>Инвентарь</span><strong>{money(summary.cash.inventory)}</strong></div>
            <div className="finance-card"><span>Зарплата специалистов</span><strong>−{money(summary.totalPayroll)}</strong></div>
            <div className="finance-card expense"><span>Расходы</span><strong>−{money(summary.expensesTotal)}</strong></div>
            <div className="finance-card accent"><span>Чистый остаток</span><strong>{money(summary.netAfterExpenses)}</strong></div>
          </div>

          <section className="finance-section">
            <div className="finance-section-head">
              <div>
                <h2>Зарплата по специалистам</h2>
                {summary.massagePayroll?.enabled && (
                  <span className="finance-payroll-policy">
                    · {summary.massagePayroll.name}
                  </span>
                )}
              </div>
              <span>{summary.payroll.length} специалистов</span>
            </div>

            <div className="finance-specialists">
              {summary.payroll.map((person) => (
                <div className="finance-specialist-card" key={person.specialistId}>
                  <div className="finance-specialist-top">
                    <div>
                      <h3>{person.fullName}</h3>
                      <span>{person.completedSessions} проведено</span>
                      {person.massageHalfHours > 0 && (
                        <span className="finance-massage-load">
                          {person.massageHalfHours} получасов массажа
                          {person.massageTier ? ` · тариф ${person.massageTier.label}` : ''}
                        </span>
                      )}
                    </div>
                    <strong>{money(person.amount)}</strong>
                  </div>

                  {person.massageTier && (
                    <div className="finance-tier-strip">
                      <span>30 мин <b>{money(person.massageTier.pay30)}</b></span>
                      <span>60 мин <b>{money(person.massageTier.pay60)}</b></span>
                      <span>90 мин <b>{money(person.massageTier.pay90)}</b></span>
                    </div>
                  )}

                  {person.byService?.length > 0 && (
                    <div className="finance-breakdown">
                      {person.byService.map((item) => (
                        <div key={item.serviceId}>
                          <span>
                            {item.title} · {item.sessions}
                            {item.massageHalfHours > 0 ? ` · ${item.massageHalfHours}×30 мин` : ''}
                            {item.dynamicMassagePay ? ' · по сетке' : ''}
                            {item.tierWithFixedFloor ? ' · с гарантированным минимумом' : ''}
                          </span>
                          <b>{money(item.amount)}</b>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="finance-section">
            <h2>Оплаты за {period === 'month' ? 'месяц' : 'день'}</h2>
            <div className="finance-table-wrap">
              <table>
                <thead>
                  <tr><th>Дата</th><th>Клиент</th><th>Оплата</th><th>Специалист</th><th>Сумма</th></tr>
                </thead>
                <tbody>
                  {allPayments.map((item) => (
                    <tr key={`${item.type}-${item.id}`}>
                      <td data-label="Дата">{formatCenterDateTime(item.paidAt, 'ru-RU', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}</td>
                      <td data-label="Клиент">{item.client}</td>
                      <td data-label="Оплата">{item.type}</td>
                      <td data-label="Специалист">{item.specialist}</td>
                      <td data-label="Сумма"><b>{money(item.amount)}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="finance-section">
            <div className="finance-section-head">
              <div>
                <h2>Расходы за месяц</h2>
                <span>Вычитаются из чистого остатка</span>
              </div>
              <strong className="finance-expense-total">−{money(summary.expensesTotal)}</strong>
            </div>
            <div className="finance-expense-list">
              {(summary.payments.expenses || []).map((item) => (
                <div className="finance-expense-row" key={item.id}>
                  <div>
                    <strong>{item.title}</strong>
                    <span>{new Date(item.purchasedAt).toLocaleString('ru-RU')}{item.note ? ` · ${item.note}` : ''}</span>
                  </div>
                  <b>−{money(item.amount)}</b>
                </div>
              ))}
              {!(summary.payments.expenses || []).length && <div className="inventory-empty">Расходов за этот период нет.</div>}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
